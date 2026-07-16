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
  let valorBonusFixo = 0;
  let valorComissaoVariavel = 0;

  if (regra.tipoMeta === "QUANTIDADE_DOSES") {
    // Meta em doses conta por VENDA/FATURAMENTO — nunca por recebimento
    // (confirmado com o usuário): a dose entra na meta do ciclo assim que a
    // venda é lançada, independente de a parcela já ter sido paga. Isso é
    // diferente da comissão (que segue RECEBIMENTO) e do baseCiclo desta
    // regra, que só se aplica ao motor de meta em valor de faturamento
    // abaixo — regra.baseCiclo é ignorado aqui de propósito.
    const vendasNoCiclo = vendas
      .filter((v) => v.cicloId === cicloId)
      .map((v) => ({
        vendaId: v.id,
        dataValidacao: v.dataVenda,
        doses: v.dosesVendidas ?? 0,
        // Comissão (diferente da meta em doses, que conta por venda) segue
        // RECEBIMENTO: soma das baixas já registradas nas parcelas desta
        // venda, nunca o valorTotal faturado — senão a comissão variável
        // embutiria receita que o cliente ainda não pagou.
        valorRecebido: v.parcelas.reduce((acc, p) => acc + p.baixas.reduce((a, b) => a + Number(b.valorRecebido), 0), 0),
      }));

    metaValor = regra.metaQuantidadeDoses ?? 0;
    const resultado = calcularBonificacaoMetaDoses({
      vendas: vendasNoCiclo,
      metaDoses: metaValor,
      percentualSemMeta: Number(regra.percentualSemMeta),
      percentualExcedente: Number(regra.percentualExcedente ?? 0),
      bonusFixoValor: Number(regra.bonusFixoValor),
      limiarExcedenteDoses: regra.limiarExcedenteDoses ?? undefined,
    });

    dosesApuradas = resultado.dosesApuradas;
    bateuMeta = resultado.bateuMeta;
    valorBonificacao = resultado.valorTotal;
    // "Bonificação" = parte fixa (só quando bate a meta); "Comissão" = parte
    // percentual (flat sem-meta OU sobre o excedente) — nunca a mesma coisa,
    // mesmo que hoje sejam pagas juntas no mesmo valorBonificacao total.
    valorBonusFixo = resultado.bonusFixo ?? 0;
    valorComissaoVariavel = resultado.comissaoSobreExcedente ?? resultado.valorComissaoSemMeta ?? 0;
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
    // motor VALOR_FATURAMENTO é tudo-ou-nada: o único componente é o bônus fixo, sem parte variável de comissão
    valorBonusFixo = valorBonificacao;
    valorComissaoVariavel = 0;
  }

  // Atingimento sempre compara a meta contra a mesma unidade em que ela foi definida:
  // doses contra doses, R$ contra R$ — nunca valorApurado (R$) contra uma meta em doses.
  const numeradorAtingimento = regra.tipoMeta === "QUANTIDADE_DOSES" ? (dosesApuradas ?? 0) : valorApurado;
  const percentualAtingimento = metaValor > 0 ? Math.round((numeradorAtingimento / metaValor) * 10000) / 100 : 0;

  await prisma.$transaction(async (tx) => {
    await tx.apuracaoBonificacao.upsert({
      where: { representanteId_regraBonificacaoId_cicloId: { representanteId, regraBonificacaoId, cicloId } },
      update: {
        valorApurado,
        dosesApuradas,
        metaValor,
        percentualAtingimento,
        bateuMeta,
        valorBonificacao,
        valorBonusFixo,
        valorComissaoVariavel,
        status: "PENDENTE",
      },
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
        valorBonusFixo,
        valorComissaoVariavel,
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
