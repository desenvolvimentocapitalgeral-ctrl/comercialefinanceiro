import { describe, it, expect } from "vitest";
import {
  resolverPercentualPorTabelaDesconto,
  calcularComissaoPorTabelaDesconto,
  calcularComissaoPercentualFixo,
  calcularRessarcimentoRiscoComercial,
  type FaixaDescontoComissao,
} from "@/lib/calculos/comissao";

// Fixture sintética (não reproduz nenhuma tabela contratual real) — só valida o
// formato de degraus decrescentes por desconto concedido.
const TABELA_DESC_POL1: FaixaDescontoComissao[] = [
  { descontoMinimo: 0, descontoMaximo: 0, percentualComissao: 30 },
  { descontoMinimo: -5, descontoMaximo: -1, percentualComissao: 22 },
  { descontoMinimo: -8, descontoMaximo: -6, percentualComissao: 16 },
  { descontoMinimo: -13, descontoMaximo: -9, percentualComissao: 10 },
];

describe("resolverPercentualPorTabelaDesconto", () => {
  it("resolve o percentual exato quando não há desconto", () => {
    expect(resolverPercentualPorTabelaDesconto(TABELA_DESC_POL1, 0)).toBe(30);
  });

  it("resolve a faixa correta para um desconto intermediário", () => {
    expect(resolverPercentualPorTabelaDesconto(TABELA_DESC_POL1, -3)).toBe(22);
  });

  it("mantém o piso da última faixa para desconto mais agressivo que qualquer degrau cadastrado", () => {
    expect(resolverPercentualPorTabelaDesconto(TABELA_DESC_POL1, -50)).toBe(10);
  });

  it("retorna null para tabela vazia", () => {
    expect(resolverPercentualPorTabelaDesconto([], -3)).toBeNull();
  });
});

describe("calcularComissaoPorTabelaDesconto", () => {
  it("calcula a comissão corretamente com desconto informado", () => {
    const resultado = calcularComissaoPorTabelaDesconto({
      valorRecebido: 1000,
      tabela: TABELA_DESC_POL1,
      descontoConcedidoPorDose: -3,
    });
    expect(resultado.bloqueado).toBe(false);
    if (!resultado.bloqueado) {
      expect(resultado.percentualAplicado).toBe(22);
      expect(resultado.valorComissao).toBe(220);
    }
  });

  it("bloqueia o cálculo quando o desconto concedido não foi informado (lacuna do ERP)", () => {
    const resultado = calcularComissaoPorTabelaDesconto({
      valorRecebido: 1000,
      tabela: TABELA_DESC_POL1,
      descontoConcedidoPorDose: null,
    });
    expect(resultado.bloqueado).toBe(true);
    if (resultado.bloqueado) {
      expect(resultado.motivo).toBe("DESCONTO_CONCEDIDO_NAO_INFORMADO");
    }
  });
});

describe("calcularComissaoPercentualFixo", () => {
  it("calcula normalmente com percentual definido", () => {
    const resultado = calcularComissaoPercentualFixo({ valorRecebido: 500, percentual: 8 });
    expect(resultado.bloqueado).toBe(false);
    if (!resultado.bloqueado) expect(resultado.valorComissao).toBe(40);
  });

  it("bloqueia (SEM_TABELA_COMISSAO) quando o contrato não tem percentual definido", () => {
    const resultado = calcularComissaoPercentualFixo({ valorRecebido: 500, percentual: null });
    expect(resultado.bloqueado).toBe(true);
    if (resultado.bloqueado) expect(resultado.motivo).toBe("SEM_TABELA_COMISSAO");
  });
});

describe("calcularRessarcimentoRiscoComercial", () => {
  it("calcula 50% de ressarcimento sobre a comissão apurada em venda de risco excepcional", () => {
    expect(calcularRessarcimentoRiscoComercial(200, 50)).toBe(100);
  });
});
