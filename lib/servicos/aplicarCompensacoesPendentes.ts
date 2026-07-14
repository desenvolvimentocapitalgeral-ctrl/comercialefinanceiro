import type { Prisma } from "@prisma/client";

type TransacaoPrisma = Prisma.TransactionClient;

export interface Compensacao {
  totalDeduzido: number;
  quantidade: number;
}

/**
 * Deduz do próximo pagamento regular os estornos de comissão ainda não
 * compensados (Prompt 3, §6.4) — nunca edita a ApuracaoComissao original,
 * só reduz o valor do novo Pagamento e marca o estorno como compensado.
 */
export async function aplicarEstornosComissaoPendentes(tx: TransacaoPrisma, representanteId: string): Promise<Compensacao> {
  const pendentes = await tx.estornoComissao.findMany({
    where: { compensado: false, descontarDeProximoPagamento: true, apuracaoComissao: { representanteId } },
  });

  if (pendentes.length === 0) return { totalDeduzido: 0, quantidade: 0 };

  await tx.estornoComissao.updateMany({ where: { id: { in: pendentes.map((e) => e.id) } }, data: { compensado: true } });

  return { totalDeduzido: pendentes.reduce((acc, e) => acc + Number(e.valorEstornado), 0), quantidade: pendentes.length };
}

/**
 * Aplica no próximo pagamento regular os ajustes de bonificação ainda não
 * compensados (Prompt 3, §6.4) — valor pode ser positivo ou negativo.
 */
export async function aplicarAjustesBonificacaoPendentes(tx: TransacaoPrisma, representanteId: string): Promise<Compensacao> {
  const pendentes = await tx.ajusteBonificacao.findMany({
    where: { compensado: false, apuracaoBonificacao: { representanteId } },
  });

  if (pendentes.length === 0) return { totalDeduzido: 0, quantidade: 0 };

  await tx.ajusteBonificacao.updateMany({ where: { id: { in: pendentes.map((a) => a.id) } }, data: { compensado: true } });

  return { totalDeduzido: pendentes.reduce((acc, a) => acc - Number(a.valorAjuste), 0), quantidade: pendentes.length };
}
