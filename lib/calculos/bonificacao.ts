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
  dataValidacao: Date; // mantido para o motor de faturamento/relatórios — não usado no rateio (que é por receita, não por ordem cronológica)
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
  // Fração (0 a 1) de cada venda que corresponde a excedente da meta — usada para
  // projetar, por parcela ainda não recebida, quanto dela vai virar comissão
  // quando o cliente pagar (linha do tempo de comissão futura). !bateuMeta = 1
  // para todas (percentualSemMeta incide sobre tudo); bateuMeta = proporção de
  // doses desta venda que ficou acima do limiar de excedente.
  fracaoExcedentePorVenda: Record<string, number>;
}

/**
 * Motor META: se a meta de doses do ciclo não é batida, aplica percentual flat
 * sobre TODO o valor recebido. Se é batida, paga bônus fixo + percentual só
 * sobre o valor das doses que EXCEDEM o limiar de excedente — rateado
 * PROPORCIONALMENTE À RECEITA de cada venda (não por ordem cronológica):
 * cada venda "empresta" uma fatia do limiar proporcional à sua participação
 * na receita total do ciclo; o que sobra de doses acima dessa fatia é
 * excedente, valorizado ao preço por dose da própria venda. Mesmo método da
 * planilha de referência (memória de cálculo) usada pela empresa — decisão
 * confirmada com o usuário em 2026-07-16, depois de uma inconsistência entre
 * este motor (que antes usava FIFO cronológico) e a planilha.
 */
export function calcularBonificacaoMetaDoses(params: {
  vendas: VendaParaMetaDoses[];
  metaDoses: number;
  percentualSemMeta: number;
  percentualExcedente: number;
  bonusFixoValor: number;
  limiarExcedenteDoses?: number; // a partir de qual dose o percentualExcedente passa a incidir; default = metaDoses
}): ResultadoBonificacaoMetaDoses {
  const { vendas, metaDoses, percentualSemMeta, percentualExcedente, bonusFixoValor } = params;
  const limiarExcedente = params.limiarExcedenteDoses ?? metaDoses;

  const totalDoses = vendas.reduce((acc, v) => acc + v.doses, 0);
  const totalRecebido = vendas.reduce((acc, v) => acc + v.valorRecebido, 0);

  if (totalDoses < metaDoses) {
    const valorComissaoSemMeta = arredondar(totalRecebido * (percentualSemMeta / 100));
    return {
      bateuMeta: false,
      dosesApuradas: totalDoses,
      valorComissaoSemMeta,
      valorTotal: valorComissaoSemMeta,
      fracaoExcedentePorVenda: Object.fromEntries(vendas.map((v) => [v.vendaId, 1])),
    };
  }

  let valorExcedente = 0;
  const fracaoExcedentePorVenda: Record<string, number> = {};

  for (const venda of vendas) {
    const participacaoReceita = totalRecebido > 0 ? venda.valorRecebido / totalRecebido : 0;
    const dosesEmprestadasAoLimiar = limiarExcedente * participacaoReceita;
    const dosesExcedentesDestaVenda = Math.max(0, venda.doses - dosesEmprestadasAoLimiar);
    const valorPorDose = venda.doses > 0 ? venda.valorRecebido / venda.doses : 0;

    valorExcedente += dosesExcedentesDestaVenda * valorPorDose;
    fracaoExcedentePorVenda[venda.vendaId] = venda.doses > 0 ? dosesExcedentesDestaVenda / venda.doses : 0;
  }

  const comissaoSobreExcedente = arredondar(valorExcedente * (percentualExcedente / 100));

  return {
    bateuMeta: true,
    dosesApuradas: totalDoses,
    bonusFixo: bonusFixoValor,
    comissaoSobreExcedente,
    valorTotal: arredondar(bonusFixoValor + comissaoSobreExcedente),
    fracaoExcedentePorVenda,
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
