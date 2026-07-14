/**
 * Templates de e-mail transacional (Prompt 1, §7) — "editáveis com
 * variáveis". Cada template é uma função pura texto → texto com
 * placeholders `{{variavel}}`, testável sem enviar nada de verdade.
 */
export type ChaveTemplate = "PAGAMENTO_GERADO" | "APURACAO_BLOQUEADA" | "ADIANTAMENTO_CRIADO" | "CONTRATO_PROXIMO_DO_VENCIMENTO";

export interface TemplateEmail {
  assunto: string;
  corpo: string;
}

const TEMPLATES: Record<ChaveTemplate, TemplateEmail> = {
  PAGAMENTO_GERADO: {
    assunto: "Pagamento gerado — {{tipo}}",
    corpo:
      "Olá, {{representanteNome}}.\n\nUm pagamento de {{tipo}} no valor de {{valorTotal}} foi gerado em {{dataPagamento}}, referente a {{quantidadeApuracoes}} apuração(ões).\n\nAcesse o portal para ver o detalhamento.",
  },
  APURACAO_BLOQUEADA: {
    assunto: "Apuração de comissão bloqueada — ação necessária",
    corpo:
      "Uma apuração de comissão do representante {{representanteNome}} ficou bloqueada.\n\nMotivo: {{motivoBloqueio}}\n\nAcesse a tela de Comissões para completar o dado faltante.",
  },
  ADIANTAMENTO_CRIADO: {
    assunto: "Adiantamento registrado",
    corpo: "Olá, {{representanteNome}}.\n\nUm adiantamento de {{valor}} foi registrado em {{dataPagamento}}.\n\nEle será compensado nos próximos pagamentos regulares.",
  },
  CONTRATO_PROXIMO_DO_VENCIMENTO: {
    assunto: "Contrato próximo do vencimento — {{representanteNome}}",
    corpo: "O contrato de {{representanteNome}} vence em {{vigenciaFim}} ({{diasRestantes}} dia(s)). Avalie renovação ou aditivo.",
  },
};

/** Substitui `{{chave}}` pelo valor correspondente em variaveis — chaves sem valor ficam como estavam (nunca quebra silenciosamente). */
function substituirVariaveis(texto: string, variaveis: Record<string, string>): string {
  return texto.replace(/\{\{(\w+)\}\}/g, (match, chave: string) => (chave in variaveis ? variaveis[chave] : match));
}

export function renderizarTemplate(chave: ChaveTemplate, variaveis: Record<string, string>): TemplateEmail {
  const template = TEMPLATES[chave];
  return {
    assunto: substituirVariaveis(template.assunto, variaveis),
    corpo: substituirVariaveis(template.corpo, variaveis),
  };
}
