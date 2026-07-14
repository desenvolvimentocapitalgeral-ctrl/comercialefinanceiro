import { describe, it, expect } from "vitest";
import { paraCsv } from "@/lib/utils/csv";

describe("paraCsv", () => {
  it("gera cabeçalho e linhas separados por ; ", () => {
    const csv = paraCsv(
      [{ nome: "João", valor: 100 }],
      [
        { chave: "nome", titulo: "Nome" },
        { chave: "valor", titulo: "Valor" },
      ],
    );
    expect(csv).toBe("Nome;Valor\r\nJoão;100");
  });

  it("escapa valores contendo ponto e vírgula entre aspas", () => {
    const csv = paraCsv([{ obs: "a; b" }], [{ chave: "obs", titulo: "Obs" }]);
    expect(csv).toBe('Obs\r\n"a; b"');
  });

  it("escapa aspas duplas duplicando-as", () => {
    const csv = paraCsv([{ obs: 'disse "oi"' }], [{ chave: "obs", titulo: "Obs" }]);
    expect(csv).toBe('Obs\r\n"disse ""oi"""');
  });

  it("trata valores nulos/undefined como string vazia", () => {
    const csv = paraCsv([{ obs: null }], [{ chave: "obs", titulo: "Obs" }]);
    expect(csv).toBe("Obs\r\n");
  });

  it("gera apenas o cabeçalho quando não há linhas", () => {
    const csv = paraCsv([], [{ chave: "nome", titulo: "Nome" }]);
    expect(csv).toBe("Nome");
  });
});
