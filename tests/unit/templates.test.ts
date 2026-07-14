import { describe, it, expect } from "vitest";
import { renderizarTemplate } from "@/lib/notificacoes/templates";

describe("renderizarTemplate", () => {
  it("substitui todas as variáveis do template de pagamento gerado", () => {
    const resultado = renderizarTemplate("PAGAMENTO_GERADO", {
      representanteNome: "Fulano de Tal",
      tipo: "comissão",
      valorTotal: "R$ 150,00",
      dataPagamento: "25/07/2026",
      quantidadeApuracoes: "1",
    });

    expect(resultado.assunto).toBe("Pagamento gerado — comissão");
    expect(resultado.corpo).toContain("Fulano de Tal");
    expect(resultado.corpo).toContain("R$ 150,00");
    expect(resultado.corpo).toContain("25/07/2026");
    expect(resultado.corpo).not.toContain("{{");
  });

  it("mantém o placeholder intacto quando a variável não foi fornecida (nunca quebra silenciosamente)", () => {
    const resultado = renderizarTemplate("APURACAO_BLOQUEADA", { representanteNome: "Fulano" });
    expect(resultado.corpo).toContain("{{motivoBloqueio}}");
  });

  it("renderiza o template de adiantamento", () => {
    const resultado = renderizarTemplate("ADIANTAMENTO_CRIADO", {
      representanteNome: "Fulano",
      valor: "R$ 200,00",
      dataPagamento: "14/07/2026",
    });
    expect(resultado.assunto).toBe("Adiantamento registrado");
    expect(resultado.corpo).toContain("R$ 200,00");
  });

  it("renderiza o template de contrato próximo do vencimento", () => {
    const resultado = renderizarTemplate("CONTRATO_PROXIMO_DO_VENCIMENTO", {
      representanteNome: "Fulano",
      vigenciaFim: "01/08/2026",
      diasRestantes: "5",
    });
    expect(resultado.assunto).toBe("Contrato próximo do vencimento — Fulano");
    expect(resultado.corpo).toContain("5 dia(s)");
  });
});
