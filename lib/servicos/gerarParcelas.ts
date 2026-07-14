import { addMonths } from "date-fns";

export interface ParcelaGerada {
  numeroParcela: number;
  valorParcela: number;
  dataVencimento: Date;
}

/**
 * Divide o valor total da venda em N parcelas de vencimento mensal, a partir
 * de um mês após a data da venda. Distribui o valor em centavos para evitar
 * arredondamento perdido/duplicado — a última parcela absorve o resto.
 */
export function gerarParcelas(valorTotal: number, quantidadeParcelas: number, dataVenda: Date): ParcelaGerada[] {
  const totalCentavos = Math.round(valorTotal * 100);
  const baseCentavos = Math.floor(totalCentavos / quantidadeParcelas);
  const resto = totalCentavos - baseCentavos * quantidadeParcelas;

  return Array.from({ length: quantidadeParcelas }, (_, indice) => {
    const numeroParcela = indice + 1;
    const centavosDestaParcela = baseCentavos + (numeroParcela === quantidadeParcelas ? resto : 0);
    return {
      numeroParcela,
      valorParcela: centavosDestaParcela / 100,
      dataVencimento: addMonths(dataVenda, numeroParcela),
    };
  });
}
