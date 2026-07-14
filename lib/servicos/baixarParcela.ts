import { prisma } from "@/lib/db/client";
import { calcularCiclo } from "@/lib/calculos/ciclo";
import { gerarApuracaoComissao } from "@/lib/servicos/gerarApuracaoComissao";

export type ResultadoBaixa = { sucesso: true } | { sucesso: false; erro: string; codigo: string };

/**
 * Ponto único de baixa de parcela (Prompt 3, §2.2) — usado tanto pela tela
 * manual quanto pela futura importação em lote. Nunca atualizar
 * Parcela.status fora daqui.
 */
export async function baixarParcela(
  parcelaId: string,
  dataRecebimento: Date,
  valorRecebido: number,
  usuarioId: string,
  motivo: string,
): Promise<ResultadoBaixa> {
  const parcela = await prisma.parcela.findUnique({ where: { id: parcelaId }, include: { baixas: true } });
  if (!parcela) return { sucesso: false, erro: "Parcela não encontrada.", codigo: "NAO_ENCONTRADA" };

  if (parcela.status === "CANCELADA" || parcela.status === "RENEGOCIADA") {
    return { sucesso: false, erro: "Esta parcela não pode mais receber baixas.", codigo: "STATUS_INVALIDO" };
  }

  const jaRecebido = parcela.baixas.reduce((acc, b) => acc + Number(b.valorRecebido), 0);
  const saldoEmAberto = Number(parcela.valorParcela) - jaRecebido;

  if (valorRecebido <= 0 || valorRecebido > saldoEmAberto + 0.01) {
    return { sucesso: false, erro: `Valor recebido não pode exceder o saldo em aberto (R$ ${saldoEmAberto.toFixed(2)}).`, codigo: "VALOR_INVALIDO" };
  }

  const cicloId = calcularCiclo(dataRecebimento).cicloId;
  const totalAposBaixa = jaRecebido + valorRecebido;
  const novoStatus = totalAposBaixa >= Number(parcela.valorParcela) - 0.01 ? "RECEBIDA" : "RECEBIDA_PARCIAL";

  await prisma.$transaction(async (tx) => {
    const baixa = await tx.baixaParcela.create({
      data: { parcelaId, dataRecebimento, valorRecebido, cicloId },
    });

    await tx.parcela.update({ where: { id: parcelaId }, data: { status: novoStatus } });

    await tx.logAuditoria.create({
      data: {
        entidade: "Parcela",
        entidadeId: parcelaId,
        acao: "BAIXA",
        valorAnterior: { status: parcela.status },
        valorNovo: { status: novoStatus, valorRecebido },
        usuarioId,
        motivo,
      },
    });

    await gerarApuracaoComissao(tx, baixa.id, usuarioId);
  });

  return { sucesso: true };
}
