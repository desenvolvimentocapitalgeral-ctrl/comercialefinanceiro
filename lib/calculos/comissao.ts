/**
 * Motor de cálculo de comissão. É polimórfico porque os contratos reais da empresa
 * usam fórmulas distintas (ver docs/especificacao-completa.md, Prompt 2 Parte A §1.1):
 * DESC_POL1/DESC_POL2/POLV3_LEGACY calculam o percentual a partir de uma tabela de
 * desconto por dose; FIXO usa um percentual único; SEMTAB nunca calcula (bloqueado).
 * O motor META (comissão sem/com meta batida) vive em bonificacao.ts porque no
 * contrato real ele está descrito como cláusula de bonificação, não de comissão.
 */

export interface FaixaDescontoComissao {
  descontoMinimo: number; // ex: -1, -2 ... -13 (negativo = desconto em R$ por dose)
  descontoMaximo: number;
  percentualComissao: number;
}

export type ResultadoComissao =
  | { bloqueado: false; percentualAplicado: number; valorComissao: number }
  | { bloqueado: true; motivo: string };

/**
 * Resolve o percentual de comissão a partir do desconto concedido por dose,
 * usando a tabela vigente da Política Comercial. Abaixo do menor degrau
 * cadastrado, mantém o piso da última faixa (comportamento confirmado no
 * contrato real: "abaixo de R$-13,00 mantém o último percentual").
 */
export function resolverPercentualPorTabelaDesconto(
  tabela: FaixaDescontoComissao[],
  descontoConcedido: number,
): number | null {
  if (tabela.length === 0) return null;

  const ordenada = [...tabela].sort((a, b) => b.descontoMinimo - a.descontoMinimo);

  for (const faixa of ordenada) {
    if (descontoConcedido >= faixa.descontoMinimo) {
      return faixa.percentualComissao;
    }
  }

  // desconto mais agressivo que qualquer faixa cadastrada -> usa o piso (última faixa, menor desconto mínimo)
  return ordenada[ordenada.length - 1].percentualComissao;
}

interface CalcularComissaoPorTabelaParams {
  valorRecebido: number;
  tabela: FaixaDescontoComissao[];
  descontoConcedidoPorDose: number | null; // null = dado manual ainda não preenchido (ver lacuna do ERP)
}

export function calcularComissaoPorTabelaDesconto({
  valorRecebido,
  tabela,
  descontoConcedidoPorDose,
}: CalcularComissaoPorTabelaParams): ResultadoComissao {
  if (descontoConcedidoPorDose === null) {
    return { bloqueado: true, motivo: "DESCONTO_CONCEDIDO_NAO_INFORMADO" };
  }

  const percentual = resolverPercentualPorTabelaDesconto(tabela, descontoConcedidoPorDose);
  if (percentual === null) {
    return { bloqueado: true, motivo: "TABELA_DESCONTO_VAZIA" };
  }

  return {
    bloqueado: false,
    percentualAplicado: percentual,
    valorComissao: arredondar(valorRecebido * (percentual / 100)),
  };
}

interface CalcularComissaoPercentualFixoParams {
  valorRecebido: number;
  percentual: number | null;
}

/** Usado pelo motor FIXO e por qualquer contrato com percentual único simples (sem tabela). */
export function calcularComissaoPercentualFixo({
  valorRecebido,
  percentual,
}: CalcularComissaoPercentualFixoParams): ResultadoComissao {
  if (percentual === null) {
    return { bloqueado: true, motivo: "SEM_TABELA_COMISSAO" };
  }
  return {
    bloqueado: false,
    percentualAplicado: percentual,
    valorComissao: arredondar(valorRecebido * (percentual / 100)),
  };
}

/** Ressarcimento parcial (ex: 50%) sobre uma comissão já apurada, em vendas autorizadas
 * excepcionalmente com crédito reprovado que ficaram inadimplentes por mais de 30 dias. */
export function calcularRessarcimentoRiscoComercial(
  valorComissaoApurada: number,
  percentualRessarcimento: number,
): number {
  return arredondar(valorComissaoApurada * (percentualRessarcimento / 100));
}

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}
