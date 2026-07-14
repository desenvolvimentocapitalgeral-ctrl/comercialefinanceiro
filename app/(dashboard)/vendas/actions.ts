"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { calcularCiclo } from "@/lib/calculos/ciclo";
import { parseDataLocal } from "@/lib/utils/data";
import { gerarParcelas } from "@/lib/servicos/gerarParcelas";
import { vendaManualSchema, type VendaManualFormValues } from "@/lib/validacoes/venda";

export type ResultadoVenda = { sucesso: true } | { sucesso: false; erro: string; codigo: string };

async function exigirSessaoAdminFinanceiro() {
  const sessao = await auth();
  if (!sessao?.user || (sessao.user.perfil !== "ADMIN" && sessao.user.perfil !== "FINANCEIRO")) return null;
  return sessao;
}

export async function criarVendaManual(dadosBrutos: VendaManualFormValues): Promise<ResultadoVenda> {
  const sessao = await exigirSessaoAdminFinanceiro();
  if (!sessao) return { sucesso: false, erro: "Sem permissão.", codigo: "SEM_PERMISSAO" };

  const parsed = vendaManualSchema.safeParse(dadosBrutos);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos.", codigo: "VALIDACAO" };
  }
  const dados = parsed.data;
  const dataVenda = parseDataLocal(dados.dataVenda);

  // Regra de ouro (Prompt 2, Parte A §3.1): toda venda referencia o contrato
  // vigente NA DATA DA VENDA, nunca o vigente hoje. Sem contrato cobrindo essa
  // data, a venda não pode ser lançada — nunca cair num contrato "mais próximo".
  const contratoVigente = await prisma.contrato.findFirst({
    where: {
      representanteId: dados.representanteId,
      vigenciaInicio: { lte: dataVenda },
      OR: [{ vigenciaFim: null }, { vigenciaFim: { gte: dataVenda } }],
    },
    orderBy: { vigenciaInicio: "desc" },
  });

  if (!contratoVigente) {
    return {
      sucesso: false,
      erro: "Este representante não tem contrato vigente na data da venda informada.",
      codigo: "SEM_CONTRATO_VIGENTE",
    };
  }

  const cicloId = calcularCiclo(dataVenda).cicloId;
  const parcelas = gerarParcelas(dados.valorTotal, dados.quantidadeParcelas, dataVenda);

  const venda = await prisma.$transaction(async (tx) => {
    const novaVenda = await tx.venda.create({
      data: {
        empresaId: sessao.user.empresaId,
        clienteId: dados.clienteId,
        produtoId: dados.produtoId,
        representanteId: dados.representanteId,
        contratoId: contratoVigente.id,
        dataVenda,
        cicloId,
        valorTotal: dados.valorTotal,
        quantidadeParcelas: dados.quantidadeParcelas,
        dosesVendidas: dados.dosesVendidas ?? null,
        descontoConcedidoPorDose: dados.descontoConcedidoPorDose ?? null,
        origem: "MANUAL",
        parcelas: {
          create: parcelas.map((p) => ({
            numeroParcela: p.numeroParcela,
            valorParcela: p.valorParcela,
            dataVencimento: p.dataVencimento,
            status: "PENDENTE",
          })),
        },
      },
    });

    await tx.logAuditoria.create({
      data: { entidade: "Venda", entidadeId: novaVenda.id, acao: "CRIACAO", valorNovo: dados, usuarioId: sessao.user.id },
    });

    return novaVenda;
  });

  revalidatePath("/vendas");
  revalidatePath("/contas-a-receber");
  return { sucesso: true };
}
