import { describe, it, expect } from "vitest";
import { iaContratoSchema, exigeConfirmacao } from "@/lib/validacoes/iaContrato";

// Fixture sintética (não reproduz nenhum contrato real) — apenas para exercitar o schema.
const respostaValidaSintetica = {
  representanteNome: { valor: "Fulano de Tal", confianca: "alta" },
  representanteCpfCnpj: { valor: "000.000.000-00", confianca: "media" },
  numero: { valor: null, confianca: "baixa" },
  vigenciaInicio: { valor: "2026-01-01", confianca: "alta" },
  vigenciaFim: { valor: null, confianca: "alta" },
  tipoCalculo: { valor: "DESC_POL1", confianca: "alta" },
  percentualFixo: { valor: null, confianca: "baixa" },
  multaConfidencialidadeMultiplicador: { valor: 3, confianca: "media" },
  multaNaoConcorrenciaMultiplicador: { valor: null, confianca: "baixa" },
  multaDescumprimentoPercentual: { valor: 20, confianca: "alta" },
  temBonificacao: { valor: true, confianca: "media" },
  tipoMetaBonificacao: { valor: "QUANTIDADE_DOSES", confianca: "media" },
  metaQuantidadeDoses: { valor: 100, confianca: "media" },
  metaValorFaturamento: { valor: null, confianca: "baixa" },
  bonusFixoValor: { valor: 500, confianca: "media" },
  percentualSemMeta: { valor: 5, confianca: "alta" },
  percentualExcedente: { valor: 8, confianca: "media" },
  resumoContrato: "Contrato de comissão por tabela de desconto com bônus fixo ao bater meta.",
  clausulasDuvidosas: ["Cláusula 7 menciona reajuste anual sem definir o índice."],
};

describe("iaContratoSchema", () => {
  it("valida uma resposta bem formada", () => {
    const resultado = iaContratoSchema.safeParse(respostaValidaSintetica);
    expect(resultado.success).toBe(true);
  });

  it("rejeita tipoCalculo fora do enum de motores conhecidos", () => {
    const invalida = { ...respostaValidaSintetica, tipoCalculo: { valor: "MOTOR_INVENTADO", confianca: "alta" } };
    const resultado = iaContratoSchema.safeParse(invalida);
    expect(resultado.success).toBe(false);
  });

  it("rejeita nível de confiança fora de alta/media/baixa", () => {
    const invalida = { ...respostaValidaSintetica, numero: { valor: "123", confianca: "certeza_absoluta" } };
    const resultado = iaContratoSchema.safeParse(invalida);
    expect(resultado.success).toBe(false);
  });

  it("aceita valor null em qualquer campo (nunca obriga um valor chutado)", () => {
    const comNulos = { ...respostaValidaSintetica, multaNaoConcorrenciaMultiplicador: { valor: null, confianca: "baixa" } };
    const resultado = iaContratoSchema.safeParse(comNulos);
    expect(resultado.success).toBe(true);
  });
});

describe("exigeConfirmacao", () => {
  it("não exige confirmação para confiança alta", () => {
    expect(exigeConfirmacao("alta")).toBe(false);
  });

  it("exige confirmação para confiança média", () => {
    expect(exigeConfirmacao("media")).toBe(true);
  });

  it("exige confirmação para confiança baixa", () => {
    expect(exigeConfirmacao("baixa")).toBe(true);
  });
});
