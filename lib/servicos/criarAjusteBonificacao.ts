import { prisma } from "@/lib/db/client";

export type ResultadoAjuste = { sucesso: true } | { sucesso: false; erro: string; codigo: string };

/**
 * Ajuste de bonificação (Prompt 3, §6.4). Bonificação já paga NUNCA é
 * editada diretamente — nasce um AjusteBonificacao (valor positivo ou
 * negativo), deduzido/somado no próximo pagamento regular do
 * representante. A ApuracaoBonificacao original permanece intacta.
 */
export async function criarAjusteBonificacao(
  apuracaoBonificacaoId: string,
  motivo: string,
  valorAjuste: number,
  usuarioId: string,
): Promise<ResultadoAjuste> {
  const apuracao = await prisma.apuracaoBonificacao.findUnique({ where: { id: apuracaoBonificacaoId } });
  if (!apuracao) return { sucesso: false, erro: "Apuração não encontrada.", codigo: "NAO_ENCONTRADA" };

  if (apuracao.status !== "PAGA") {
    return { sucesso: false, erro: "Só é possível ajustar bonificações já pagas.", codigo: "STATUS_INVALIDO" };
  }

  if (valorAjuste === 0) {
    return { sucesso: false, erro: "Informe um valor de ajuste diferente de zero.", codigo: "VALOR_INVALIDO" };
  }

  await prisma.$transaction(async (tx) => {
    const ajuste = await tx.ajusteBonificacao.create({
      data: { apuracaoBonificacaoId, motivo, valorAjuste, criadoPorUsuarioId: usuarioId },
    });

    await tx.logAuditoria.create({
      data: {
        entidade: "AjusteBonificacao",
        entidadeId: ajuste.id,
        acao: "CRIACAO",
        valorNovo: { apuracaoBonificacaoId, valorAjuste },
        usuarioId,
        motivo,
      },
    });
  });

  return { sucesso: true };
}
