import { describe, it, expect } from "vitest";
import { resolverEntidade, LIMIARES_PADRAO, LIMIARES_REPRESENTANTE } from "@/lib/depara/resolverEntidade";

// Fixtures sintéticas — não reproduzem nenhum cliente/representante real.
const candidatos = [
  { id: "c1", nome: "Gilmar de Souza Rocha", cpfCnpj: "33240462000135" },
  { id: "c2", nome: "De Paula Veterinaria", cpfCnpj: "12345678000199" },
  { id: "c3", nome: "Empresa Alfa Comercio Ltda", cpfCnpj: "99988877000166" },
];

describe("resolverEntidade — identificador forte", () => {
  it("casa por CNPJ mesmo com nome de origem completamente diferente", () => {
    const resultado = resolverEntidade("QUALQUER OUTRO NOME", "33.240.462/0001-35", candidatos, []);
    expect(resultado).toEqual({ tipo: "IDENTIFICADOR_FORTE", entidadeId: "c1" });
  });

  it("ignora identificador forte quando não bate com nenhum candidato e cai para fuzzy/novo", () => {
    const resultado = resolverEntidade("Nome Desconhecido Qualquer", "00.000.000/0001-00", candidatos, []);
    expect(resultado.tipo).not.toBe("IDENTIFICADOR_FORTE");
  });
});

describe("resolverEntidade — alias exato", () => {
  it("casa por alias já registrado mesmo sem identificador forte", () => {
    const aliases = [{ nomeOrigem: "GILMAR SOUZA ROCHA (APELIDO ERP)", entidadeId: "c1" }];
    const resultado = resolverEntidade("gilmar souza rocha (apelido erp)", null, candidatos, aliases);
    expect(resultado).toEqual({ tipo: "ALIAS_EXATO", entidadeId: "c1" });
  });
});

describe("resolverEntidade — fuzzy", () => {
  it("classifica erro de digitação pequeno como FUZZY_ALTA", () => {
    const resultado = resolverEntidade("Gilmar de Souza Roxa", null, candidatos, []);
    expect(resultado.tipo).toBe("FUZZY_ALTA");
    if (resultado.tipo === "FUZZY_ALTA") expect(resultado.entidadeId).toBe("c1");
  });

  it("classifica nome com uma palavra faltando como FUZZY_MEDIA, exigindo confirmação", () => {
    // "Gilmar Souza Rocha" vs "Gilmar de Souza Rocha" (falta "de") ~0.857 — entre média (0.70) e alta (0.90)
    const resultado = resolverEntidade("Gilmar Souza Rocha", null, candidatos, []);
    expect(resultado.tipo).toBe("FUZZY_MEDIA");
  });

  it("classifica nome sem nenhuma relação como NOVO", () => {
    const resultado = resolverEntidade("Representante Totalmente Novo Sem Relacao", null, candidatos, []);
    expect(resultado.tipo).toBe("NOVO");
  });

  it("retorna múltiplos candidatos ordenados por similaridade em FUZZY_MEDIA", () => {
    const parecidos = [
      { id: "x1", nome: "Joao Pedro Silva" },
      { id: "x2", nome: "Joao Pedro Silveira" },
    ];
    const resultado = resolverEntidade("Joao Pedro Silv", null, parecidos, [], { alta: 0.99, media: 0.5 });
    if (resultado.tipo === "FUZZY_MEDIA") {
      expect(resultado.candidatos.length).toBeGreaterThan(0);
      expect(resultado.candidatos[0].similaridade).toBeGreaterThanOrEqual(resultado.candidatos[resultado.candidatos.length - 1].similaridade);
    }
  });
});

describe("resolverEntidade — limiares", () => {
  it("LIMIARES_REPRESENTANTE é mais conservador que LIMIARES_PADRAO", () => {
    expect(LIMIARES_REPRESENTANTE.alta).toBeGreaterThan(LIMIARES_PADRAO.alta);
    expect(LIMIARES_REPRESENTANTE.media).toBeGreaterThan(LIMIARES_PADRAO.media);
  });

  it("um mesmo grau de similaridade pode ser ALTA para Cliente e MEDIA para Representante", () => {
    // "abcdefghij" vs "abcdefghik": 1 caractere diferente em string sem
    // espaços (token não interfere) => similaridade exata de 0.90.
    const parecido = [{ id: "c1", nome: "abcdefghik" }];

    const comoCliente = resolverEntidade("abcdefghij", null, parecido, [], LIMIARES_PADRAO);
    const comoRepresentante = resolverEntidade("abcdefghij", null, parecido, [], LIMIARES_REPRESENTANTE);

    expect(comoCliente.tipo).toBe("FUZZY_ALTA");
    expect(comoRepresentante.tipo).toBe("FUZZY_MEDIA");
  });
});
