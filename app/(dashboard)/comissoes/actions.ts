"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { parseDataLocal } from "@/lib/utils/data";
import { criarEstornoComissao, type ResultadoEstorno } from "@/lib/servicos/criarEstornoComissao";
import { aplicarEstornosComissaoPendentes } from "@/lib/servicos/aplicarCompensacoesPendentes";

export type ResultadoAcao = { sucesso: true } | { sucesso: false; erro: string; codigo: string };

async function exigirSessaoAdminFinanceiro() {
  const sessao = await auth();
  if (!sessao?.user || (sessao.user.perfil !== "ADMIN" && sessao.user.perfil !== "FINANCEIRO")) return null;
  return sessao;
}

/** PENDENTE → APROVADA em lote (Prompt 1, Parte C §7.2, passo 2). */
export async function aprovarApuracoes(apuracaoIds: string[]): Promise<ResultadoAcao> {
  const sessao = await exigirSessaoAdminFinanceiro();
  if (!sessao) return { sucesso: false, erro: "Sem permissão.", codigo: "SEM_PERMISSAO" };

  if (apuracaoIds.length === 0) {
    return { sucesso: false, erro: "Selecione ao menos uma apuração.", codigo: "SELECAO_VAZIA" };
  }

  const apuracoes = await prisma.apuracaoComissao.findMany({ where: { id: { in: apuracaoIds } } });
  const invalidas = apuracoes.filter((a) => a.status !== "PENDENTE");
  if (invalidas.length > 0) {
    return { sucesso: false, erro: "Só é possível aprovar apurações com status Pendente.", codigo: "STATUS_INVALIDO" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.apuracaoComissao.updateMany({ where: { id: { in: apuracaoIds } }, data: { status: "APROVADA" } });
    for (const id of apuracaoIds) {
      await tx.logAuditoria.create({
        data: { entidade: "ApuracaoComissao", entidadeId: id, acao: "APROVACAO", usuarioId: sessao.user.id },
      });
    }
  });

  revalidatePath("/comissoes");
  return { sucesso: true };
}

/**
 * APROVADA → PAGA (Prompt 1, Parte C §7.2, passo 3). Nunca mistura
 * representantes diferentes no mesmo Pagamento — validação obrigatória.
 */
export async function gerarPagamento(apuracaoIds: string[], dataPagamentoStr: string): Promise<ResultadoAcao> {
  const sessao = await exigirSessaoAdminFinanceiro();
  if (!sessao) return { sucesso: false, erro: "Sem permissão.", codigo: "SEM_PERMISSAO" };

  if (apuracaoIds.length === 0) {
    return { sucesso: false, erro: "Selecione ao menos uma apuração.", codigo: "SELECAO_VAZIA" };
  }
  if (!dataPagamentoStr) {
    return { sucesso: false, erro: "Informe a data do pagamento.", codigo: "DATA_OBRIGATORIA" };
  }

  const apuracoes = await prisma.apuracaoComissao.findMany({ where: { id: { in: apuracaoIds } } });

  const invalidas = apuracoes.filter((a) => a.status !== "APROVADA");
  if (invalidas.length > 0) {
    return { sucesso: false, erro: "Só é possível pagar apurações com status Aprovada.", codigo: "STATUS_INVALIDO" };
  }

  const representantesDistintos = new Set(apuracoes.map((a) => a.representanteId));
  if (representantesDistintos.size > 1) {
    return { sucesso: false, erro: "Um pagamento não pode misturar apurações de representantes diferentes.", codigo: "REPRESENTANTES_MISTURADOS" };
  }

  const representanteId = apuracoes[0].representanteId;
  const valorBruto = apuracoes.reduce((acc, a) => acc + Number(a.valorComissao), 0);
  const dataPagamento = parseDataLocal(dataPagamentoStr);

  await prisma.$transaction(async (tx) => {
    const compensacao = await aplicarEstornosComissaoPendentes(tx, representanteId);
    const valorTotal = Math.max(0, valorBruto - compensacao.totalDeduzido);

    const pagamento = await tx.pagamento.create({
      data: {
        representanteId,
        tipo: "REGULAR",
        dataPagamento,
        valorTotal,
        aprovadoPorUsuarioId: sessao.user.id,
        itens: {
          create: apuracoes.map((a) => ({
            apuracaoComissaoId: a.id,
            valor: a.valorComissao,
            valorPago: a.valorComissao,
          })),
        },
      },
    });

    await tx.apuracaoComissao.updateMany({ where: { id: { in: apuracaoIds } }, data: { status: "PAGA" } });

    await tx.logAuditoria.create({
      data: {
        entidade: "Pagamento",
        entidadeId: pagamento.id,
        acao: "CRIACAO",
        valorNovo: {
          representanteId,
          valorBruto,
          estornosCompensados: compensacao.quantidade,
          valorDeduzidoPorEstornos: compensacao.totalDeduzido,
          valorTotal,
          quantidadeApuracoes: apuracaoIds.length,
        },
        usuarioId: sessao.user.id,
      },
    });
  });

  revalidatePath("/comissoes");
  return { sucesso: true };
}

/** Estorno de comissão já paga (Prompt 3, §6.4) — deduzido do próximo pagamento regular. */
export async function estornarComissao(
  apuracaoComissaoId: string,
  motivo: string,
  valorEstornado: number,
  descontarDeProximoPagamento: boolean,
): Promise<ResultadoEstorno> {
  const sessao = await exigirSessaoAdminFinanceiro();
  if (!sessao) return { sucesso: false, erro: "Sem permissão.", codigo: "SEM_PERMISSAO" };

  if (!motivo || motivo.trim().length === 0) {
    return { sucesso: false, erro: "Informe o motivo do estorno.", codigo: "MOTIVO_OBRIGATORIO" };
  }

  const resultado = await criarEstornoComissao(apuracaoComissaoId, motivo, valorEstornado, descontarDeProximoPagamento, sessao.user.id);

  if (resultado.sucesso) revalidatePath("/comissoes");
  return resultado;
}
