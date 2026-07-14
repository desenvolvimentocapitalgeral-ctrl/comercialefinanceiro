/**
 * Motor de cálculo de bonificação. O bônus pago é sempre um valor fixo em R$
 * (confirmado nos contratos reais), mas a META que dispara esse bônus pode ser
 * medida em quantidade de doses OU em valor de faturamento — nunca as duas ao
 * mesmo tempo no mesmo contrato. Ver docs/especificacao-completa.md, Prompt 2
 * Parte A §1.2 e §1.4.
 */

export interface FaixaEscalonada {
  atingimentoMinimo: number; // percentual, ex: 80, 100, 120
  percentual: number;
}

export interface VendaParaMetaDoses {
  vendaId: string;
  dataValidacao: Date; // data de entrega/venda usada para ordenação cronológica (FIFO)
  doses: number;
  valorRecebido: number;
}

export interface ResultadoBonificacaoMetaDoses {
  bateuMeta: boolean;
  dosesApuradas: number;
  valorComissaoSemMeta?: number; // presente quando !bateuMeta
  bonusFixo?: number; // presente quando bateuMeta
  comissaoSobreExcedente?: number; // presente quando bateuMeta
  valorTotal: number;
}

/**
 * Motor META: se a meta de doses do ciclo não é batida, aplica percentual flat
 * sobre TODO o valor recebido. Se é batida, paga bônus fixo + percentual só
 * sobre o valor das doses que EXCEDEM a meta — alocadas em ordem cronológica
 * (as primeiras N doses "completam" a meta e não geram comissão percentual).
 */
export function calcularBonificacaoMetaDoses(params: {
  vendas: VendaParaMetaDoses[];
  metaDoses: number;
  percentualSemMeta: number;
  percentualExcedente: number;
  bonusFixoValor: number;
}): ResultadoBonificacaoMetaDoses {
  const { vendas, metaDoses, percentualSemMeta, percentualExcedente, bonusFixoValor } = params;

  const ordenadas = [...vendas].sort((a, b) => a.dataValidacao.getTime() - b.dataValidacao.getTime());
  const totalDoses = ordenadas.reduce((acc, v) => acc + v.doses, 0);
  const totalRecebido = ordenadas.reduce((acc, v) => acc + v.valorRecebido, 0);

  if (totalDoses < metaDoses) {
    const valorComissaoSemMeta = arredondar(totalRecebido * (percentualSemMeta / 100));
    return {
      bateuMeta: false,
      dosesApuradas: totalDoses,
      valorComissaoSemMeta,
      valorTotal: valorComissaoSemMeta,
    };
  }

  // aloca doses/valor cronologicamente até completar a meta; o restante é excedente
  let dosesAlocadasNaMeta = 0;
  let valorExcedente = 0;

  for (const venda of ordenadas) {
    if (dosesAlocadasNaMeta >= metaDoses) {
      // venda inteira é excedente
      valorExcedente += venda.valorRecebido;
      continue;
    }

    const dosesRestantesParaMeta = metaDoses - dosesAlocadasNaMeta;

    if (venda.doses <= dosesRestantesParaMeta) {
      // venda inteira ainda cabe dentro da meta
      dosesAlocadasNaMeta += venda.doses;
    } else {
      // venda cruza a fronteira da meta: parte dentro, parte excedente (proporcional ao valor por dose)
      const dosesExcedentesDestaVenda = venda.doses - dosesRestantesParaMeta;
      const valorPorDose = venda.valorRecebido / venda.doses;
      valorExcedente += dosesExcedentesDestaVenda * valorPorDose;
      dosesAlocadasNaMeta = metaDoses;
    }
  }

  const comissaoSobreExcedente = arredondar(valorExcedente * (percentualExcedente / 100));

  return {
    bateuMeta: true,
    dosesApuradas: totalDoses,
    bonusFixo: bonusFixoValor,
    comissaoSobreExcedente,
    valorTotal: arredondar(bonusFixoValor + comissaoSobreExcedente),
  };
}

/** Bonificação por faturamento com bônus fixo simples ao cruzar um piso (DESC_POL1/POLV3_LEGACY). */
export function calcularBonificacaoValorFixoPorFaturamento(params: {
  valorApuradoNoCiclo: number;
  faturamentoMinimo: number;
  bonusFixoValor: number;
}): { bateuMeta: boolean; percentualAtingimento: number; valorBonificacao: number } {
  const { valorApuradoNoCiclo, faturamentoMinimo, bonusFixoValor } = params;
  const percentualAtingimento = faturamentoMinimo > 0 ? arredondar((valorApuradoNoCiclo / faturamentoMinimo) * 100) : 0;
  const bateuMeta = valorApuradoNoCiclo >= faturamentoMinimo;

  return {
    bateuMeta,
    percentualAtingimento,
    valorBonificacao: bateuMeta ? bonusFixoValor : 0,
  };
}

/** Resolve a faixa escalonada aplicável a um percentual de atingimento — usa a faixa mais alta cujo mínimo foi alcançado. */
export function resolverFaixaEscalonada(
  faixas: FaixaEscalonada[],
  percentualAtingimento: number,
): FaixaEscalonada | null {
  const ordenadas = [...faixas].sort((a, b) => b.atingimentoMinimo - a.atingimentoMinimo);
  return ordenadas.find((faixa) => percentualAtingimento >= faixa.atingimentoMinimo) ?? null;
}

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}
