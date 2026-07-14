import { describe, it, expect } from "vitest";
import { parseDataLocal } from "@/lib/utils/data";

describe("parseDataLocal", () => {
  it("preserva o dia exato, sem deslocamento de fuso horário", () => {
    const data = parseDataLocal("2026-07-11");
    expect(data.getFullYear()).toBe(2026);
    expect(data.getMonth()).toBe(6); // julho = índice 6
    expect(data.getDate()).toBe(11);
  });

  it("funciona corretamente na virada de ano", () => {
    const data = parseDataLocal("2026-01-01");
    expect(data.getFullYear()).toBe(2026);
    expect(data.getMonth()).toBe(0);
    expect(data.getDate()).toBe(1);
  });
});
