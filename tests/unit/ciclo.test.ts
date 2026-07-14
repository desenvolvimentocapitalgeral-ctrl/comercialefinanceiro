import { describe, it, expect } from "vitest";
import { calcularCiclo, listarCiclosEntre, cicloEstaFechado, resolverVigenciaPorCiclo } from "@/lib/calculos/ciclo";

describe("calcularCiclo", () => {
  const casos: Array<[string, string]> = [
    ["2026-03-11", "2026-03"], // primeiro dia do ciclo
    ["2026-04-10", "2026-03"], // último dia do ciclo (não 2026-04!)
    ["2026-03-10", "2026-02"], // último dia do ciclo anterior
    ["2026-01-01", "2025-12"], // virada de ano, dentro da cauda do ciclo de dezembro
    ["2026-01-11", "2026-01"], // virada de ano, início de novo ciclo
    ["2026-02-28", "2026-02"], // fevereiro comum
    ["2028-02-29", "2028-02"], // ano bissexto — dia 29 ainda está no ciclo de fevereiro
  ];

  it.each(casos)("data %s pertence ao ciclo %s", (dataStr, cicloEsperado) => {
    const [ano, mes, dia] = dataStr.split("-").map(Number);
    const data = new Date(ano, mes - 1, dia);
    expect(calcularCiclo(data).cicloId).toBe(cicloEsperado);
  });

  it("respeita diaInicio/diaFim customizados por empresa", () => {
    const data = new Date(2026, 4, 5); // 05/05/2026
    const ciclo = calcularCiclo(data, 1, 31);
    expect(ciclo.cicloId).toBe("2026-05");
  });

  it("label formata corretamente", () => {
    const ciclo = calcularCiclo(new Date(2026, 2, 15));
    expect(ciclo.label).toBe("11/03/2026 a 10/04/2026");
  });
});

describe("listarCiclosEntre", () => {
  it("lista todos os ciclos entre duas datas, inclusive", () => {
    const ciclos = listarCiclosEntre(new Date(2026, 0, 15), new Date(2026, 2, 15));
    expect(ciclos.map((c) => c.cicloId)).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("retorna um único ciclo quando início e fim caem no mesmo ciclo", () => {
    const ciclos = listarCiclosEntre(new Date(2026, 2, 12), new Date(2026, 2, 20));
    expect(ciclos.map((c) => c.cicloId)).toEqual(["2026-03"]);
  });
});

describe("cicloEstaFechado", () => {
  it("considera fechado quando a data atual é posterior ao fim do ciclo", () => {
    const ciclo = calcularCiclo(new Date(2026, 2, 15));
    expect(cicloEstaFechado(ciclo, new Date(2026, 3, 11))).toBe(true);
  });

  it("considera em andamento quando a data atual está dentro do ciclo", () => {
    const ciclo = calcularCiclo(new Date(2026, 2, 15));
    expect(cicloEstaFechado(ciclo, new Date(2026, 2, 20))).toBe(false);
  });
});

describe("resolverVigenciaPorCiclo", () => {
  const regras = [
    { id: "v1", vigenciaCicloInicio: "2025-06" },
    { id: "v2", vigenciaCicloInicio: "2026-01" },
    { id: "v3", vigenciaCicloInicio: "2026-07" },
  ];

  it("resolve a regra mais recente cuja vigência é <= ao ciclo alvo (não retroage)", () => {
    expect(resolverVigenciaPorCiclo(regras, "2026-03")?.id).toBe("v2");
  });

  it("resolve a regra exata quando o ciclo alvo bate com a vigência", () => {
    expect(resolverVigenciaPorCiclo(regras, "2026-07")?.id).toBe("v3");
  });

  it("retorna null quando não há regra vigente para o ciclo (anterior a qualquer vigência)", () => {
    expect(resolverVigenciaPorCiclo(regras, "2024-01")).toBeNull();
  });

  it("um aditivo assinado no meio de um ciclo só vale a partir do PRÓXIMO ciclo", () => {
    // aditivo com vigenciaCicloInicio = 2026-07 não deve afetar o ciclo 2026-06,
    // mesmo que a assinatura tenha ocorrido fisicamente dentro do ciclo 2026-06.
    expect(resolverVigenciaPorCiclo(regras, "2026-06")?.id).toBe("v2");
  });
});
