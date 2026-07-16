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
    // sem meta batida, o percentual flat incide sobre 100% de qualquer venda
    expect(resultado.fracaoExcedentePorVenda).toEqual({ v1: 1 });
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

  it("rateia o limiar proporcionalmente à receita de cada venda quando o preço por dose é uniforme", () => {
    // mesmo preço por dose (R$30) nas duas vendas -> participação na receita =
    // participação em doses, então cada venda empresta a mesma fração (250/600
    // e 350/600) do limiar e sobra a mesma fração de excedente para as duas.
    const vendas: VendaParaMetaDoses[] = [
      { vendaId: "v2", dataValidacao: new Date(2026, 5, 20), doses: 250, valorRecebido: 7500 },
      { vendaId: "v1", dataValidacao: new Date(2026, 5, 1), doses: 350, valorRecebido: 10500 },
    ];
    const resultado = calcularBonificacaoMetaDoses({ vendas, metaDoses, percentualSemMeta, percentualExcedente, bonusFixoValor });

    expect(resultado.bateuMeta).toBe(true);
    expect(resultado.dosesApuradas).toBe(600);
    // 100 doses de excedente no total (600-500), a R$30/dose = R$3.000; comissão = 10% = R$300
    expect(resultado.comissaoSobreExcedente).toBe(300);
    expect(resultado.valorTotal).toBe(4300);
    // preço uniforme -> mesma fração de excedente (100/600) pras duas vendas, não 0%/40% como seria por ordem cronológica
    expect(resultado.fracaoExcedentePorVenda.v1).toBeCloseTo(100 / 600, 5);
    expect(resultado.fracaoExcedentePorVenda.v2).toBeCloseTo(100 / 600, 5);
  });

  it("rateia proporcionalmente à receita quando o preço por dose varia entre vendas — não por ordem cronológica", () => {
    // venda A: preço baixo (R$10/dose), participação pequena na receita -> empresta pouco do limiar, quase tudo vira excedente
    // venda B: preço alto (R$40/dose), participação grande na receita -> empresta muito do limiar, pouco vira excedente
    const vendas: VendaParaMetaDoses[] = [
      { vendaId: "a-preco-baixo", dataValidacao: new Date(2026, 5, 1), doses: 400, valorRecebido: 4000 }, // R$10/dose
      { vendaId: "b-preco-alto", dataValidacao: new Date(2026, 5, 20), doses: 200, valorRecebido: 8000 }, // R$40/dose
    ];
    const resultado = calcularBonificacaoMetaDoses({ vendas, metaDoses, percentualSemMeta, percentualExcedente, bonusFixoValor });

    expect(resultado.bateuMeta).toBe(true);
    expect(resultado.dosesApuradas).toBe(600);
    // participação receita: a=4000/12000=1/3, b=8000/12000=2/3
    // doses emprestadas ao limiar (500): a=500/3=166.67, b=1000/3=333.33
    // excedente: a=(400-166.67)*10=2333.33 | b=(200-333.33 -> negativo, trunca em 0)*40=0
    // total excedente=2333.33, comissão=10%=233.33 — bem diferente do que FIFO (cronológico) daria
    expect(resultado.comissaoSobreExcedente).toBeCloseTo(233.33, 2);
    expect(resultado.fracaoExcedentePorVenda["b-preco-alto"]).toBe(0);
    expect(resultado.fracaoExcedentePorVenda["a-preco-baixo"]).toBeCloseTo((400 - 500 / 3) / 400, 5);
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

  it("usa limiarExcedenteDoses (quando maior que a meta) em vez da meta para separar o excedente", () => {
    // Contrato tipo Lucas Sales: meta de 300 doses paga o bônus fixo, mas a
    // comissão de 20% só incide acima de 1.000 doses/mês.
    const vendas: VendaParaMetaDoses[] = [
      { vendaId: "v1", dataValidacao: new Date(2026, 5, 1), doses: 1000, valorRecebido: 17000 },
      { vendaId: "v2", dataValidacao: new Date(2026, 5, 20), doses: 200, valorRecebido: 3400 },
    ];
    const resultado = calcularBonificacaoMetaDoses({
      vendas,
      metaDoses: 300,
      percentualSemMeta: 0,
      percentualExcedente: 20,
      bonusFixoValor: 20000,
      limiarExcedenteDoses: 1000,
    });

    expect(resultado.bateuMeta).toBe(true);
    expect(resultado.dosesApuradas).toBe(1200);
    expect(resultado.bonusFixo).toBe(20000);
    // preço uniforme (R$17/dose nas duas) -> 200 doses de excedente no total (1200-1000) a R$17 = R$3.400; comissão = 20% = R$680
    expect(resultado.comissaoSobreExcedente).toBe(680);
    expect(resultado.valorTotal).toBe(20680);
    // rateado proporcionalmente à receita (mesma fração pras duas, já que o preço por dose é igual), não 0%/100% por ordem cronológica
    expect(resultado.fracaoExcedentePorVenda.v1).toBeCloseTo(200 / 1200, 5);
    expect(resultado.fracaoExcedentePorVenda.v2).toBeCloseTo(200 / 1200, 5);
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
