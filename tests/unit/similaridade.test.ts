import { describe, it, expect } from "vitest";
import { distanciaLevenshtein, similaridadeLevenshtein, similaridadeTokens, similaridadeCombinada } from "@/lib/depara/similaridade";
import { normalizarTexto, normalizarCpfCnpj } from "@/lib/depara/normalizar";

describe("normalizarTexto", () => {
  it("remove acentos, caixa e espaços duplicados", () => {
    expect(normalizarTexto("José  da  Silva Júnior")).toBe("jose da silva junior");
  });

  it("remove espaços nas pontas", () => {
    expect(normalizarTexto("  Fulano  ")).toBe("fulano");
  });
});

describe("normalizarCpfCnpj", () => {
  it("remove pontuação de CPF/CNPJ", () => {
    expect(normalizarCpfCnpj("111.444.777-35")).toBe("11144477735");
    expect(normalizarCpfCnpj("11.222.333/0001-81")).toBe("11222333000181");
  });
});

describe("distanciaLevenshtein", () => {
  it("é zero para strings idênticas", () => {
    expect(distanciaLevenshtein("abc", "abc")).toBe(0);
  });

  it("conta uma substituição", () => {
    expect(distanciaLevenshtein("gato", "gata")).toBe(1);
  });

  it("conta inserções/remoções", () => {
    expect(distanciaLevenshtein("gato", "gatos")).toBe(1);
    expect(distanciaLevenshtein("", "abc")).toBe(3);
  });
});

describe("similaridadeLevenshtein", () => {
  it("é 1 para strings idênticas", () => {
    expect(similaridadeLevenshtein("fulano", "fulano")).toBe(1);
  });

  it("é 0 para strings completamente diferentes do mesmo tamanho", () => {
    expect(similaridadeLevenshtein("abc", "xyz")).toBe(0);
  });

  it("é intermediária para um pequeno erro de digitação", () => {
    const s = similaridadeLevenshtein("gilmar de souza rocha", "gilmar de souza roxa");
    expect(s).toBeGreaterThan(0.9);
    expect(s).toBeLessThan(1);
  });
});

describe("similaridadeTokens", () => {
  it("é 1 quando os conjuntos de palavras são iguais, mesmo fora de ordem", () => {
    expect(similaridadeTokens("silva joao", "joao silva")).toBe(1);
  });

  it("é parcial quando só parte das palavras bate", () => {
    const s = similaridadeTokens("joao da silva", "joao silva santos");
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(1);
  });

  it("é 0 quando não há nenhuma palavra em comum", () => {
    expect(similaridadeTokens("abc def", "ghi jkl")).toBe(0);
  });
});

describe("similaridadeCombinada", () => {
  it("é 1 para nomes idênticos após normalização (acento/caixa diferentes)", () => {
    expect(similaridadeCombinada("José da Silva", "jose da silva")).toBe(1);
  });

  it("classifica nomes claramente diferentes como baixa similaridade", () => {
    const s = similaridadeCombinada("Gilmar de Souza Rocha", "Empresa Alfa Comercio Ltda");
    expect(s).toBeLessThan(0.5);
  });

  it("classifica um pequeno erro de digitação como alta similaridade (>=0.90)", () => {
    const s = similaridadeCombinada("Gilmar de Souza Rocha", "Gilmar de Souza Roxa");
    expect(s).toBeGreaterThanOrEqual(0.9);
  });

  it("classifica razão social vs nome fantasia parcialmente sobreposto como média similaridade", () => {
    const s = similaridadeCombinada("De Paula Veterinaria", "Gabriel de Paula Duarte");
    expect(s).toBeGreaterThan(0.3);
    expect(s).toBeLessThan(0.9);
  });
});
