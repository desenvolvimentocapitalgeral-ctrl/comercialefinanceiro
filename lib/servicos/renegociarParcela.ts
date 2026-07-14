import { prisma } from "@/lib/db/client";
import { addMonths } from "date-fns";

export type ResultadoRenegociacao = { sucesso: true } | { sucesso: false; erro: string; codigo: string };

/**
 * Renegociação de parcela (Prompt 3, §6.2). A parcela original nunca é
 * editada/excluída — vira RENEGOCIADA — e o saldo em aberto é redistribuído
 * em novas parcelas vinculadas via parcelaOrigemRenegociacaoId. Juros/multa
 * de renegociação não entram na base de cálculo de comissão por padrão
 * (as novas parcelas carregam apenas o saldo original, sem acréscimo).
 */
export async function renegociarParcela(
  parcelaId: string,
  novaQuantidadeParcelas: number,
  primeiroVencimento: Date,
  usuarioId: string,
  motivo: string,
): Promise<ResultadoRenegociacao> {
  const parcela = await prisma.parcela.findUnique({ where: { id: parcelaId }, include: { baixas: true, venda: true } });
  if (!parcela) return { sucesso: false, erro: "Parcela não encontrada.", codigo: "NAO_ENCONTRADA" };

  if (parcela.status !== "PENDENTE" && parcela.status !== "RECEBIDA_PARCIAL") {
    return { sucesso: false, erro: "Só é possível renegociar parcelas pendentes ou parcialmente recebidas.", codigo: "STATUS_INVALIDO" };
  }

  const jaRecebido = parcela.baixas.reduce((acc, b) => acc + Number(b.valorRecebido), 0);
  const saldoEmAberto = Number(parcela.valorParcela) - jaRecebido;

  if (saldoEmAberto <= 0) {
    return { sucesso: false, erro: "Esta parcela não tem saldo em aberto para renegociar.", codigo: "SEM_SALDO" };
  }

  if (novaQuantidadeParcelas < 1) {
    return { sucesso: false, erro: "Informe ao menos 1 nova parcela.", codigo: "QUANTIDADE_INVALIDA" };
  }

  const ultimaNumeracao = await prisma.parcela.aggregate({
    where: { vendaId: parcela.vendaId },
    _max: { numeroParcela: true },
  });
  const proximoNumero = (ultimaNumeracao._max.numeroParcela ?? 0) + 1;

  const totalCentavos = Math.round(saldoEmAberto * 100);
  const baseCentavos = Math.floor(totalCentavos / novaQuantidadeParcelas);
  const resto = totalCentavos - baseCentavos * novaQuantidadeParcelas;

  await prisma.$transaction(async (tx) => {
    await tx.parcela.update({ where: { id: parcelaId }, data: { status: "RENEGOCIADA" } });

    for (let indice = 0; indice < novaQuantidadeParcelas; indice++) {
      const centavosDestaParcela = baseCentavos + (indice === novaQuantidadeParcelas - 1 ? resto : 0);
      await tx.parcela.create({
        data: {
          vendaId: parcela.vendaId,
          numeroParcela: proximoNumero + indice,
          valorParcela: centavosDestaParcela / 100,
          dataVencimento: addMonths(primeiroVencimento, indice),
          status: "PENDENTE",
          parcelaOrigemRenegociacaoId: parcelaId,
        },
      });
    }

    await tx.venda.update({
      where: { id: parcela.vendaId },
      data: { quantidadeParcelas: { increment: novaQuantidadeParcelas } },
    });

    await tx.logAuditoria.create({
      data: {
        entidade: "Parcela",
        entidadeId: parcelaId,
        acao: "RENEGOCIACAO",
        valorAnterior: { status: parcela.status, saldoEmAberto },
        valorNovo: { status: "RENEGOCIADA", novasParcelas: novaQuantidadeParcelas },
        usuarioId,
        motivo,
      },
    });
  });

  return { sucesso: true };
}
