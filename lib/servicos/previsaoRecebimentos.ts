import type { RegraBonificacao } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { resolverVigenciaPorCiclo } from "@/lib/calculos/ciclo";
import { calcularComissaoPercentualFixo } from "@/lib/calculos/comissao";
import { calcularBonificacaoMetaDoses, type ResultadoBonificacaoMetaDoses } from "@/lib/calculos/bonificacao";

export interface ItemPrevisaoMes {
  mesChave: string; // "2026-09", pelo mês de vencimento da parcela
  qtdParcelas: number;
  valorPendente: number;
  valorCalculavel: number; // determinável hoje: percentual fixo, ou excedente do motor de doses (a fração já é conhecida pelas doses vendidas, não depende do dinheiro ter entrado)
  valorAApurar: number; // depende de dado manual (desconto por dose) que só chega depois
}

export interface PrevisaoRepresentante {
  representanteId: string;
  representanteNome: string;
  porMes: ItemPrevisaoMes[];
  totalPendente: number;
  totalCalculavel: number;
  totalAApurar: number;
}

function mesChaveDe(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Projeta, por representante e por mês de vencimento, quanto de comissão está
 * pendente de recebimento do cliente. Cobre tanto o motor FIXO (percentual
 * único, por parcela) quanto o motor META em doses (RegraBonificacao
 * QUANTIDADE_DOSES) — cuja fração de excedente por venda já é conhecida hoje
 * (depende de doses vendidas, não de dinheiro recebido), então entra em
 * "calculável", não em "a apurar". Motores por tabela de desconto (DESC_POL1/
 * DESC_POL2/POLV3_LEGACY/SEMTAB) continuam em "a apurar" — dependem de um
 * dado manual (desconto concedido) que só é preenchido depois.
 */
export async function calcularPrevisaoRecebimentos(empresaId: string): Promise<PrevisaoRepresentante[]> {
  const parcelasPendentes = await prisma.parcela.findMany({
    where: { status: "PENDENTE", venda: { representante: { empresaId } } },
    include: {
      venda: {
        include: {
          representante: { select: { id: true, nome: true } },
          contrato: { include: { regrasComissao: true, regrasBonificacao: true } },
        },
      },
    },
    orderBy: { dataVencimento: "asc" },
  });

  // cache por (contratoId + cicloId) do resultado do motor de doses, pra não recalcular por parcela
  const cacheMetaDoses = new Map<string, ResultadoBonificacaoMetaDoses>();

  async function fracaoExcedenteDaVenda(vendaId: string, representanteId: string, contratoId: string, cicloId: string, regraBonif: RegraBonificacao): Promise<number> {
    const chave = `${contratoId}:${cicloId}`;
    if (!cacheMetaDoses.has(chave)) {
      const vendasDoCiclo = await prisma.venda.findMany({
        where: { representanteId, contratoId, cicloId },
        include: { parcelas: { include: { baixas: true } } },
      });
      const resultado = calcularBonificacaoMetaDoses({
        vendas: vendasDoCiclo.map((v) => ({
          vendaId: v.id,
          dataValidacao: v.dataVenda,
          doses: v.dosesVendidas ?? 0,
          valorRecebido: v.parcelas.reduce((acc, p) => acc + p.baixas.reduce((a, b) => a + Number(b.valorRecebido), 0), 0),
        })),
        metaDoses: regraBonif.metaQuantidadeDoses ?? 0,
        percentualSemMeta: Number(regraBonif.percentualSemMeta),
        percentualExcedente: Number(regraBonif.percentualExcedente ?? 0),
        bonusFixoValor: Number(regraBonif.bonusFixoValor),
        limiarExcedenteDoses: regraBonif.limiarExcedenteDoses ?? undefined,
      });
      cacheMetaDoses.set(chave, resultado);
    }
    const resultado = cacheMetaDoses.get(chave)!;
    return resultado.fracaoExcedentePorVenda[vendaId] ?? 0;
  }

  const representantesMap = new Map<string, PrevisaoRepresentante>();

  for (const parcela of parcelasPendentes) {
    const venda = parcela.venda;
    const valorParcela = Number(parcela.valorParcela);
    const regraComissao = resolverVigenciaPorCiclo(venda.contrato.regrasComissao, venda.cicloId);

    let calculavel = 0;
    let aApurar = 0;

    if (regraComissao?.tipoCalculo === "FIXO" && regraComissao.percentual !== null) {
      const resultado = calcularComissaoPercentualFixo({ valorRecebido: valorParcela, percentual: Number(regraComissao.percentual) });
      if (!resultado.bloqueado) calculavel = resultado.valorComissao;
      else aApurar = valorParcela;
    } else if (regraComissao?.tipoCalculo === "META") {
      const regraBonif = resolverVigenciaPorCiclo(venda.contrato.regrasBonificacao, venda.cicloId);
      if (regraBonif?.tipoMeta === "QUANTIDADE_DOSES") {
        const fracao = await fracaoExcedenteDaVenda(venda.id, venda.representanteId, venda.contratoId, venda.cicloId, regraBonif);
        const cacheado = cacheMetaDoses.get(`${venda.contratoId}:${venda.cicloId}`)!;
        const percentual = cacheado.bateuMeta ? Number(regraBonif.percentualExcedente ?? 0) : Number(regraBonif.percentualSemMeta);
        calculavel = Math.round(valorParcela * fracao * (percentual / 100) * 100) / 100;
      }
      // VALOR_FATURAMENTO é tudo-ou-nada — bônus fixo, sem parte variável a projetar por parcela.
    } else {
      // DESC_POL1 / DESC_POL2 / POLV3_LEGACY / SEMTAB dependem do desconto concedido por dose (dado manual do ERP)
      aApurar = valorParcela;
    }

    const mesChave = mesChaveDe(parcela.dataVencimento);

    if (!representantesMap.has(venda.representanteId)) {
      representantesMap.set(venda.representanteId, {
        representanteId: venda.representanteId,
        representanteNome: venda.representante.nome,
        porMes: [],
        totalPendente: 0,
        totalCalculavel: 0,
        totalAApurar: 0,
      });
    }
    const rep = representantesMap.get(venda.representanteId)!;
    rep.totalPendente += valorParcela;
    rep.totalCalculavel += calculavel;
    rep.totalAApurar += aApurar;

    let item = rep.porMes.find((m) => m.mesChave === mesChave);
    if (!item) {
      item = { mesChave, qtdParcelas: 0, valorPendente: 0, valorCalculavel: 0, valorAApurar: 0 };
      rep.porMes.push(item);
    }
    item.qtdParcelas += 1;
    item.valorPendente += valorParcela;
    item.valorCalculavel += calculavel;
    item.valorAApurar += aApurar;
  }

  const representantes = [...representantesMap.values()];
  for (const rep of representantes) rep.porMes.sort((a, b) => a.mesChave.localeCompare(b.mesChave));
  representantes.sort((a, b) => b.totalPendente - a.totalPendente);

  return representantes;
}
