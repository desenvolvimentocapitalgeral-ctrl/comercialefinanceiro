import { prisma } from "@/lib/db/client";
import { calcularCiclo } from "@/lib/calculos/ciclo";

export type ResultadoEstorno = { sucesso: true } | { sucesso: false; erro: string; codigo: string };

/**
 * Estorno de comissão (Prompt 3, §6.4). Comissão já paga NUNCA é editada
 * diretamente — nasce um EstornoComissao, deduzido do próximo pagamento
 * regular do representante (ver aplicarCompensacoesPendentes em
 * gerarPagamento). A ApuracaoComissao original permanece intacta como
 * registro histórico do que foi de fato calculado e pago.
 */
export async function criarEstornoComissao(
  apuracaoComissaoId: string,
  motivo: string,
  valorEstornado: number,
  descontarDeProximoPagamento: boolean,
  usuarioId: string,
): Promise<ResultadoEstorno> {
  const apuracao = await prisma.apuracaoComissao.findUnique({ where: { id: apuracaoComissaoId } });
  if (!apuracao) return { sucesso: false, erro: "Apuração não encontrada.", codigo: "NAO_ENCONTRADA" };

  if (apuracao.status !== "PAGA") {
    return { sucesso: false, erro: "Só é possível estornar comissões já pagas.", codigo: "STATUS_INVALIDO" };
  }

  if (valorEstornado <= 0 || valorEstornado > Number(apuracao.valorComissao) + 0.01) {
    return { sucesso: false, erro: "Valor do estorno inválido — não pode exceder o valor da comissão paga.", codigo: "VALOR_INVALIDO" };
  }

  const cicloDoEstorno = calcularCiclo(new Date()).cicloId;

  await prisma.$transaction(async (tx) => {
    const estorno = await tx.estornoComissao.create({
      data: { apuracaoComissaoId, motivo, valorEstornado, cicloDoEstorno, descontarDeProximoPagamento, criadoPorUsuarioId: usuarioId },
    });

    await tx.logAuditoria.create({
      data: {
        entidade: "EstornoComissao",
        entidadeId: estorno.id,
        acao: "CRIACAO",
        valorNovo: { apuracaoComissaoId, valorEstornado, descontarDeProximoPagamento },
        usuarioId,
        motivo,
      },
    });
  });

  return { sucesso: true };
}
