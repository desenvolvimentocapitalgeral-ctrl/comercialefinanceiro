import { describe, it, expect } from "vitest";
import { gerarParcelas } from "@/lib/servicos/gerarParcelas";

describe("gerarParcelas", () => {
  it("divide igualmente quando o valor é exatamente divisível", () => {
    const parcelas = gerarParcelas(1000, 4, new Date(2026, 6, 11));
    expect(parcelas.map((p) => p.valorParcela)).toEqual([250, 250, 250, 250]);
  });

  it("a última parcela absorve o resto de arredondamento, sem perder centavos", () => {
    const parcelas = gerarParcelas(100, 3, new Date(2026, 6, 11));
    const soma = parcelas.reduce((acc, p) => acc + p.valorParcela, 0);
    expect(soma).toBeCloseTo(100, 2);
    expect(parcelas.map((p) => p.valorParcela)).toEqual([33.33, 33.33, 33.34]);
  });

  it("vencimentos são mensais, a partir de um mês após a data da venda", () => {
    const parcelas = gerarParcelas(300, 3, new Date(2026, 6, 11));
    expect(parcelas[0].dataVencimento).toEqual(new Date(2026, 7, 11));
    expect(parcelas[1].dataVencimento).toEqual(new Date(2026, 8, 11));
    expect(parcelas[2].dataVencimento).toEqual(new Date(2026, 9, 11));
  });

  it("numera as parcelas sequencialmente a partir de 1", () => {
    const parcelas = gerarParcelas(300, 3, new Date(2026, 6, 11));
    expect(parcelas.map((p) => p.numeroParcela)).toEqual([1, 2, 3]);
  });

  it("funciona com uma única parcela (à vista)", () => {
    const parcelas = gerarParcelas(500, 1, new Date(2026, 6, 11));
    expect(parcelas).toHaveLength(1);
    expect(parcelas[0].valorParcela).toBe(500);
  });
});
