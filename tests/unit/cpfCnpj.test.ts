import { describe, it, expect } from "vitest";
import { cpfCnpjValido } from "@/lib/validacoes/cpfCnpj";

describe("cpfCnpjValido", () => {
  it("aceita CPF válido, com ou sem máscara", () => {
    expect(cpfCnpjValido("11144477735")).toBe(true);
    expect(cpfCnpjValido("111.444.777-35")).toBe(true);
  });

  it("aceita CNPJ válido, com ou sem máscara", () => {
    expect(cpfCnpjValido("11222333000181")).toBe(true);
    expect(cpfCnpjValido("11.222.333/0001-81")).toBe(true);
  });

  it("rejeita CPF com dígito verificador errado", () => {
    expect(cpfCnpjValido("11144477700")).toBe(false);
  });

  it("rejeita CNPJ com dígito verificador errado", () => {
    expect(cpfCnpjValido("11222333000100")).toBe(false);
  });

  it("rejeita sequência de dígitos repetidos", () => {
    expect(cpfCnpjValido("11111111111")).toBe(false);
    expect(cpfCnpjValido("11111111111111")).toBe(false);
  });

  it("rejeita tamanho inválido", () => {
    expect(cpfCnpjValido("123")).toBe(false);
    expect(cpfCnpjValido("")).toBe(false);
  });
});
