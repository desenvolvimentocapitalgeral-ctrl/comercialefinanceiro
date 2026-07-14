"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { calcularCiclo } from "@/lib/calculos/ciclo";
import { calcularApuracaoBonificacao, type ResultadoApuracaoBonificacao } from "@/lib/servicos/gerarApuracaoBonificacao";

export type ResultadoAcao = { sucesso: true } | { sucesso: false; erro: string; codigo: string };

async function exigirSessaoAdminFinanceiro() {
  const sessao = await auth();
  if (!sessao?.user || (sessao.user.perfil !== "ADMIN" && sessao.user.perfil !== "FINANCEIRO")) return null;
  return sessao;
}

export async function recalcularBonificacaoCicloAtual(regraBonificacaoId: string): Promise<ResultadoApuracaoBonificacao> {
  const sessao = await exigirSessaoAdminFinanceiro();
  if (!sessao) return { sucesso: false, erro: "Sem permissão.", codigo: "SEM_PERMISSAO" };

  const cicloId = calcularCiclo(new Date()).cicloId;
  const resultado = await calcularApuracaoBonificacao(regraBonificacaoId, cicloId, sessao.user.id);

  if (resultado.sucesso) revalidatePath("/bonificacoes");
  return resultado;
}

export async function aprovarBonificacoes(apuracaoIds: string[]): Promise<ResultadoAcao> {
  const sessao = await exigirSessaoAdminFinanceiro();
  if (!sessao) return { sucesso: false, erro: "Sem permissão.", codigo: "SEM_PERMISSAO" };

  if (apuracaoIds.length === 0) return { sucesso: false, erro: "Selecione ao menos uma apuração.", codigo: "SELECAO_VAZIA" };

  const apuracoes = await prisma.apuracaoBonificacao.findMany({ where: { id: { in: apuracaoIds } } });
  if (apuracoes.some((a) => a.status !== "PENDENTE")) {
    return { sucesso: false, erro: "Só é possível aprovar apurações com status Pendente.", codigo: "STATUS_INVALIDO" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.apuracaoBonificacao.updateMany({ where: { id: { in: apuracaoIds } }, data: { status: "APROVADA" } });
    for (const id of apuracaoIds) {
      await tx.logAuditoria.create({ data: { entidade: "ApuracaoBonificacao", entidadeId: id, acao: "APROVACAO", usuarioId: sessao.user.id } });
    }
  });

  revalidatePath("/bonificacoes");
  return { sucesso: true };
}

export async function gerarPagamentoBonificacao(apuracaoIds: string[], dataPagamentoStr: string): Promise<ResultadoAcao> {
  const sessao = await exigirSessaoAdminFinanceiro();
  if (!sessao) return { sucesso: false, erro: "Sem permissão.", codigo: "SEM_PERMISSAO" };

  if (apuracaoIds.length === 0) return { sucesso: false, erro: "Selecione ao menos uma apuração.", codigo: "SELECAO_VAZIA" };
  if (!dataPagamentoStr) return { sucesso: false, erro: "Informe a data do pagamento.", codigo: "DATA_OBRIGATORIA" };

  const apuracoes = await prisma.apuracaoBonificacao.findMany({ where: { id: { in: apuracaoIds } } });
  if (apuracoes.some((a) => a.status !== "APROVADA")) {
    return { sucesso: false, erro: "Só é possível pagar apurações com status Aprovada.", codigo: "STATUS_INVALIDO" };
  }
  const representantesDistintos = new Set(apuracoes.map((a) => a.representanteId));
  if (representantesDistintos.size > 1) {
    return { sucesso: false, erro: "Um pagamento não pode misturar apurações de representantes diferentes.", codigo: "REPRESENTANTES_MISTURADOS" };
  }

  const { parseDataLocal } = await import("@/lib/utils/data");
  const representanteId = apuracoes[0].representanteId;
  const valorTotal = apuracoes.reduce((acc, a) => acc + Number(a.valorBonificacao), 0);
  const dataPagamento = parseDataLocal(dataPagamentoStr);

  await prisma.$transaction(async (tx) => {
    const pagamento = await tx.pagamento.create({
      data: {
        representanteId,
        tipo: "REGULAR",
        dataPagamento,
        valorTotal,
        aprovadoPorUsuarioId: sessao.user.id,
        itens: { create: apuracoes.map((a) => ({ apuracaoBonificacaoId: a.id, valor: a.valorBonificacao, valorPago: a.valorBonificacao })) },
      },
    });

    await tx.apuracaoBonificacao.updateMany({ where: { id: { in: apuracaoIds } }, data: { status: "PAGA" } });

    await tx.logAuditoria.create({
      data: {
        entidade: "Pagamento",
        entidadeId: pagamento.id,
        acao: "CRIACAO",
        valorNovo: { representanteId, valorTotal, quantidadeApuracoes: apuracaoIds.length, tipo: "bonificacao" },
        usuarioId: sessao.user.id,
      },
    });
  });

  revalidatePath("/bonificacoes");
  return { sucesso: true };
}
