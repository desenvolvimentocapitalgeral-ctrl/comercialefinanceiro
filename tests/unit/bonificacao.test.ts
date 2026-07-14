import { describe, it, expect } from "vitest";
import {
  calcularBonificacaoMetaDoses,
  calcularBonificacaoValorFixoPorFaturamento,
  resolverFaixaEscalonada,
  type VendaParaMetaDoses,
  type FaixaEscalonada,
} from "@/lib/calculos/bonificacao";

// Parâmetros sintéticos (não reproduzem nenhum contrato real) — só validam o
// comportamento do motor META documentado na especificação.
describe("calcularBonificacaoMetaDoses", () => {
  const metaDoses = 500;
  const percentualSemMeta = 25;
  const percentualExcedente = 10;
  const bonusFixoValor = 4000;

  it("aplica percentual flat sobre tudo recebido quando a meta NÃO é batida", () => {
    const vendas: VendaParaMetaDoses[] = [
      { vendaId: "v1", dataValidacao: new Date(2026, 5, 15), doses: 180, valorRecebido: 3000 },
    ];
    const resultado = calcularBonificacaoMetaDoses({ vendas, metaDoses, percentualSemMeta, percentualExcedente, bonusFixoValor });

    expect(resultado.bateuMeta).toBe(false);
    expect(resultado.dosesApuradas).toBe(180);
    expect(resultado.valorTotal).toBeCloseTo(750, 2);
  });

  it("paga bônus fixo + comissão só sobre o excedente quando a meta é batida exatamente", () => {
    const vendas: VendaParaMetaDoses[] = [
      { vendaId: "v1", dataValidacao: new Date(2026, 5, 1), doses: 500, valorRecebido: 15000 },
    ];
    const resultado = calcularBonificacaoMetaDoses({ vendas, metaDoses, percentualSemMeta, percentualExcedente, bonusFixoValor });

    expect(resultado.bateuMeta).toBe(true);
    expect(resultado.bonusFixo).toBe(4000);
    expect(resultado.comissaoSobreExcedente).toBe(0); // exatamente na meta, sem excedente
    expect(resultado.valorTotal).toBe(4000);
  });

  it("aloca doses em ordem cronológica (FIFO) e separa corretamente uma venda que cruza a fronteira da meta", () => {
    // venda mais antiga: 350 doses -> cabe inteira dentro da meta (faltam 150 para completar)
    // venda seguinte: 250 doses, R$7.500 -> 150 completam a meta, 100 doses são excedente
    const vendas: VendaParaMetaDoses[] = [
      { vendaId: "v2-depois", dataValidacao: new Date(2026, 5, 20), doses: 250, valorRecebido: 7500 },
      { vendaId: "v1-antes", dataValidacao: new Date(2026, 5, 1), doses: 350, valorRecebido: 10500 },
    ];
    const resultado = calcularBonificacaoMetaDoses({ vendas, metaDoses, percentualSemMeta, percentualExcedente, bonusFixoValor });

    expect(resultado.bateuMeta).toBe(true);
    expect(resultado.dosesApuradas).toBe(600);
    // 100 doses excedentes de 250 (R$7.500) => valor proporcional = 100/250 * 7500 = 3000
    // comissão sobre excedente = 3000 * 10% = 300
    expect(resultado.comissaoSobreExcedente).toBe(300);
    expect(resultado.valorTotal).toBe(4300);
  });

  it("soma múltiplas vendas para determinar se bate a meta", () => {
    const vendas: VendaParaMetaDoses[] = [
      { vendaId: "v1", dataValidacao: new Date(2026, 5, 1), doses: 200, valorRecebido: 6000 },
      { vendaId: "v2", dataValidacao: new Date(2026, 5, 10), doses: 200, valorRecebido: 6000 },
      { vendaId: "v3", dataValidacao: new Date(2026, 5, 20), doses: 99, valorRecebido: 2970 },
    ];
    const resultado = calcularBonificacaoMetaDoses({ vendas, metaDoses, percentualSemMeta, percentualExcedente, bonusFixoValor });
    expect(resultado.dosesApuradas).toBe(499);
    expect(resultado.bateuMeta).toBe(false); // 499 < 500, faltou por 1 dose
  });
});

describe("calcularBonificacaoValorFixoPorFaturamento", () => {
  it("bate a meta exatamente no limite (atingimento = 100,00%)", () => {
    const resultado = calcularBonificacaoValorFixoPorFaturamento({
      valorApuradoNoCiclo: 8000,
      faturamentoMinimo: 8000,
      bonusFixoValor: 2500,
    });
    expect(resultado.bateuMeta).toBe(true);
    expect(resultado.percentualAtingimento).toBe(100);
    expect(resultado.valorBonificacao).toBe(2500);
  });

  it("não bate a meta por uma fração mínima", () => {
    const resultado = calcularBonificacaoValorFixoPorFaturamento({
      valorApuradoNoCiclo: 7999.99,
      faturamentoMinimo: 8000,
      bonusFixoValor: 2500,
    });
    expect(resultado.bateuMeta).toBe(false);
    expect(resultado.valorBonificacao).toBe(0);
  });
});

describe("resolverFaixaEscalonada", () => {
  const faixas: FaixaEscalonada[] = [
    { atingimentoMinimo: 80, percentual: 3 },
    { atingimentoMinimo: 100, percentual: 5 },
    { atingimentoMinimo: 120, percentual: 8 },
  ];

  it("resolve a faixa correta para atingimento exatamente na fronteira entre duas faixas", () => {
    expect(resolverFaixaEscalonada(faixas, 100)?.percentual).toBe(5);
  });

  it("resolve a faixa mais alta quando o atingimento a ultrapassa", () => {
    expect(resolverFaixaEscalonada(faixas, 150)?.percentual).toBe(8);
  });

  it("retorna null quando o atingimento está abaixo de qualquer faixa", () => {
    expect(resolverFaixaEscalonada(faixas, 50)).toBeNull();
  });

  it("caso de fronteira: um centésimo abaixo do limite cai na faixa anterior", () => {
    expect(resolverFaixaEscalonada(faixas, 99.99)?.percentual).toBe(3);
  });
});
