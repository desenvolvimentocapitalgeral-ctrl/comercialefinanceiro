"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { calcularCiclo } from "@/lib/calculos/ciclo";
import { parseDataLocal } from "@/lib/utils/data";
import { contratoSchema, type ContratoFormValues } from "@/lib/validacoes/contrato";

export type ResultadoContrato =
  | { sucesso: true }
  | { sucesso: false; erro: string; codigo: "SEM_PERMISSAO" | "VALIDACAO" }
  | { sucesso: false; erro: string; codigo: "SOBREPOSICAO_VIGENCIA"; contratoAnteriorId: string; contratoAnteriorNumero: string | null };

async function exigirSessaoAdmin() {
  const sessao = await auth();
  if (!sessao?.user || sessao.user.perfil !== "ADMIN") return null;
  return sessao;
}

function subtrairUmDia(data: Date): Date {
  const nova = new Date(data);
  nova.setDate(nova.getDate() - 1);
  return nova;
}

export async function criarContrato(
  dadosBrutos: ContratoFormValues,
  confirmarEncerramentoAnterior = false,
  metadadosIA?: { resumoIA?: string; clausulasDuvidosas?: string[] },
): Promise<ResultadoContrato> {
  const sessao = await exigirSessaoAdmin();
  if (!sessao) return { sucesso: false, erro: "Apenas ADMIN pode criar/editar contratos.", codigo: "SEM_PERMISSAO" };

  const parsed = contratoSchema.safeParse(dadosBrutos);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos.", codigo: "VALIDACAO" };
  }
  const dados = parsed.data;

  if (dados.temBonificacao && !dados.regraBonificacao) {
    return { sucesso: false, erro: "Preencha a regra de bonificação ou desmarque a opção.", codigo: "VALIDACAO" };
  }

  const vigenciaInicio = parseDataLocal(dados.vigenciaInicio);
  const vigenciaFim = dados.vigenciaFim ? parseDataLocal(dados.vigenciaFim) : null;
  const cicloIdInicio = calcularCiclo(vigenciaInicio).cicloId;

  // Prompt 2, Parte A §3.2: nunca permitir dois contratos ATIVO simultâneos com vigência sobreposta.
  const contratoAtivoExistente = await prisma.contrato.findFirst({
    where: {
      representanteId: dados.representanteId,
      status: "ATIVO",
      OR: [{ vigenciaFim: null }, { vigenciaFim: { gte: vigenciaInicio } }],
    },
  });

  if (contratoAtivoExistente && !confirmarEncerramentoAnterior) {
    return {
      sucesso: false,
      erro: "Já existe um contrato ativo vigente para este representante.",
      codigo: "SOBREPOSICAO_VIGENCIA",
      contratoAnteriorId: contratoAtivoExistente.id,
      contratoAnteriorNumero: contratoAtivoExistente.numero,
    };
  }

  await prisma.$transaction(async (tx) => {
    if (contratoAtivoExistente && confirmarEncerramentoAnterior) {
      await tx.contrato.update({
        where: { id: contratoAtivoExistente.id },
        data: { vigenciaFim: subtrairUmDia(vigenciaInicio), status: "ENCERRADO" },
      });
      await tx.logAuditoria.create({
        data: {
          entidade: "Contrato",
          entidadeId: contratoAtivoExistente.id,
          acao: "ENCERRAMENTO_AUTOMATICO",
          valorAnterior: { status: "ATIVO", vigenciaFim: contratoAtivoExistente.vigenciaFim },
          valorNovo: { status: "ENCERRADO", vigenciaFim: subtrairUmDia(vigenciaInicio) },
          usuarioId: sessao.user.id,
          motivo: "Encerrado automaticamente pela criação de um novo contrato vigente.",
        },
      });
    }

    const contrato = await tx.contrato.create({
      data: {
        representanteId: dados.representanteId,
        numero: dados.numero || null,
        vigenciaInicio,
        vigenciaFim,
        status: "ATIVO",
        statusAssinatura: "PENDENTE_ASSINATURA_CONTRATADA",
        multaConfidencialidadeMultiplicador: dados.multaConfidencialidadeMultiplicador ?? null,
        multaNaoConcorrenciaMultiplicador: dados.multaNaoConcorrenciaMultiplicador ?? null,
        multaDescumprimentoPercentual: dados.multaDescumprimentoPercentual ?? null,
        resumoIA: metadadosIA?.resumoIA ?? null,
        clausulasDuvidosas: metadadosIA?.clausulasDuvidosas && metadadosIA.clausulasDuvidosas.length > 0 ? metadadosIA.clausulasDuvidosas : undefined,
        regrasComissao: {
          create: {
            tipoCalculo: dados.regraComissao.tipoCalculo,
            percentual: dados.regraComissao.percentual ?? null,
            momentoApuracao: dados.regraComissao.momentoApuracao,
            aplicaSobre: dados.regraComissao.aplicaSobre || null,
            condicoesEspeciais: dados.regraComissao.condicoesEspeciais || null,
            vigenciaCicloInicio: cicloIdInicio,
          },
        },
        ...(dados.temBonificacao && dados.regraBonificacao
          ? {
              regrasBonificacao: {
                create: {
                  tipoCalculo: dados.regraBonificacao.tipoCalculo,
                  tipoMeta: dados.regraBonificacao.tipoMeta,
                  metaQuantidadeDoses: dados.regraBonificacao.metaQuantidadeDoses ?? null,
                  metaValorFaturamento: dados.regraBonificacao.metaValorFaturamento ?? null,
                  baseCiclo: dados.regraBonificacao.baseCiclo,
                  bonusFixoValor: dados.regraBonificacao.bonusFixoValor,
                  percentualSemMeta: dados.regraBonificacao.percentualSemMeta,
                  percentualExcedente: dados.regraBonificacao.percentualExcedente ?? null,
                  condicoesPerda: dados.regraBonificacao.condicoesPerda || null,
                  vigenciaCicloInicio: cicloIdInicio,
                },
              },
            }
          : {}),
      },
    });

    await tx.logAuditoria.create({
      data: {
        entidade: "Contrato",
        entidadeId: contrato.id,
        acao: "CRIACAO",
        valorNovo: dados,
        usuarioId: sessao.user.id,
      },
    });
  });

  revalidatePath("/contratos");
  revalidatePath("/representantes");
  return { sucesso: true };
}
