import { prisma } from "@/lib/db/client";
import { calcularBonificacaoMetaDoses, calcularBonificacaoValorFixoPorFaturamento } from "@/lib/calculos/bonificacao";

export type ResultadoApuracaoBonificacao = { sucesso: true } | { sucesso: false; erro: string; codigo: string };

/**
 * Apuração por CICLO FECHADO, não por parcela (Prompt 1, Parte C §8.2) —
 * diferente de comissão, não é disparada por um evento único; é recalculada
 * sob demanda (tela de Bonificações) enquanto ainda não estiver
 * aprovada/paga. Nunca sobrescreve uma apuração já aprovada ou paga.
 */
export async function calcularApuracaoBonificacao(
  regraBonificacaoId: string,
  cicloId: string,
  usuarioId: string,
): Promise<ResultadoApuracaoBonificacao> {
  const regra = await prisma.regraBonificacao.findUnique({ where: { id: regraBonificacaoId }, include: { contrato: true } });
  if (!regra) return { sucesso: false, erro: "Regra de bonificação não encontrada.", codigo: "NAO_ENCONTRADA" };

  const representanteId = regra.contrato.representanteId;

  const existente = await prisma.apuracaoBonificacao.findUnique({
    where: { representanteId_regraBonificacaoId_cicloId: { representanteId, regraBonificacaoId, cicloId } },
  });
  if (existente && (existente.status === "APROVADA" || existente.status === "PAGA")) {
    return { sucesso: false, erro: "Esta apuração já foi aprovada/paga e não pode ser recalculada.", codigo: "JA_APROVADA" };
  }

  const vendas = await prisma.venda.findMany({
    where: { representanteId, contratoId: regra.contratoId },
    include: { parcelas: { include: { baixas: true } } },
  });

  let valorApurado = 0;
  let dosesApuradas: number | null = null;
  let metaValor = 0;
  let bateuMeta = false;
  let valorBonificacao = 0;

  if (regra.tipoMeta === "QUANTIDADE_DOSES") {
    const vendasNoCiclo = vendas
      .map((v) => {
        const valorRecebidoNoCiclo =
          regra.baseCiclo === "RECEBIMENTO"
            ? v.parcelas.flatMap((p) => p.baixas).filter((b) => b.cicloId === cicloId).reduce((acc, b) => acc + Number(b.valorRecebido), 0)
            : v.cicloId === cicloId
              ? Number(v.valorTotal)
              : 0;
        return { vendaId: v.id, dataValidacao: v.dataVenda, doses: v.dosesVendidas ?? 0, valorRecebido: valorRecebidoNoCiclo };
      })
      .filter((v) => v.valorRecebido > 0);

    metaValor = regra.metaQuantidadeDoses ?? 0;
    const resultado = calcularBonificacaoMetaDoses({
      vendas: vendasNoCiclo,
      metaDoses: metaValor,
      percentualSemMeta: Number(regra.percentualSemMeta),
      percentualExcedente: Number(regra.percentualExcedente ?? 0),
      bonusFixoValor: Number(regra.bonusFixoValor),
    });

    dosesApuradas = resultado.dosesApuradas;
    bateuMeta = resultado.bateuMeta;
    valorBonificacao = resultado.valorTotal;
    valorApurado = vendasNoCiclo.reduce((acc, v) => acc + v.valorRecebido, 0);
  } else {
    valorApurado = vendas
      .filter((v) => (regra.baseCiclo === "FATURAMENTO" ? v.cicloId === cicloId : v.parcelas.some((p) => p.baixas.some((b) => b.cicloId === cicloId))))
      .reduce((acc, v) => {
        if (regra.baseCiclo === "RECEBIMENTO") {
          return acc + v.parcelas.flatMap((p) => p.baixas).filter((b) => b.cicloId === cicloId).reduce((a, b) => a + Number(b.valorRecebido), 0);
        }
        return acc + Number(v.valorTotal);
      }, 0);

    metaValor = Number(regra.metaValorFaturamento ?? 0);
    const resultado = calcularBonificacaoValorFixoPorFaturamento({
      valorApuradoNoCiclo: valorApurado,
      faturamentoMinimo: metaValor,
      bonusFixoValor: Number(regra.bonusFixoValor),
    });
    bateuMeta = resultado.bateuMeta;
    valorBonificacao = resultado.valorBonificacao;
  }

  // Atingimento sempre compara a meta contra a mesma unidade em que ela foi definida:
  // doses contra doses, R$ contra R$ — nunca valorApurado (R$) contra uma meta em doses.
  const numeradorAtingimento = regra.tipoMeta === "QUANTIDADE_DOSES" ? (dosesApuradas ?? 0) : valorApurado;
  const percentualAtingimento = metaValor > 0 ? Math.round((numeradorAtingimento / metaValor) * 10000) / 100 : 0;

  await prisma.$transaction(async (tx) => {
    await tx.apuracaoBonificacao.upsert({
      where: { representanteId_regraBonificacaoId_cicloId: { representanteId, regraBonificacaoId, cicloId } },
      update: { valorApurado, dosesApuradas, metaValor, percentualAtingimento, bateuMeta, valorBonificacao, status: "PENDENTE" },
      create: {
        representanteId,
        contratoId: regra.contratoId,
        regraBonificacaoId,
        cicloId,
        valorApurado,
        dosesApuradas,
        metaValor,
        percentualAtingimento,
        bateuMeta,
        valorBonificacao,
        status: "PENDENTE",
      },
    });

    await tx.logAuditoria.create({
      data: {
        entidade: "ApuracaoBonificacao",
        entidadeId: `${representanteId}:${regraBonificacaoId}:${cicloId}`,
        acao: existente ? "RECALCULO" : "CRIACAO",
        valorNovo: { valorApurado, bateuMeta, valorBonificacao },
        usuarioId,
      },
    });
  });

  return { sucesso: true };
}
