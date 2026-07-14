import Anthropic from "@anthropic-ai/sdk";
import { iaContratoSchema, type IaContratoResposta } from "@/lib/validacoes/iaContrato";

export type ResultadoInterpretacao = { sucesso: true; dados: IaContratoResposta } | { sucesso: false; erro: string; codigo: string };

const NOME_FERRAMENTA = "extrair_dados_contrato";

// Espelha lib/validacoes/iaContrato.ts em JSON Schema para o tool use da API —
// obriga a IA a responder no formato exato, sem texto livre ao redor.
const CAMPO_TEXTO = { type: "object", properties: { valor: { type: ["string", "null"] }, confianca: { enum: ["alta", "media", "baixa"] } }, required: ["valor", "confianca"] };
const CAMPO_NUMERO = { type: "object", properties: { valor: { type: ["number", "null"] }, confianca: { enum: ["alta", "media", "baixa"] } }, required: ["valor", "confianca"] };
const CAMPO_BOOLEANO = { type: "object", properties: { valor: { type: ["boolean", "null"] }, confianca: { enum: ["alta", "media", "baixa"] } }, required: ["valor", "confianca"] };

const FERRAMENTA_EXTRACAO: Anthropic.Tool = {
  name: NOME_FERRAMENTA,
  description: "Registra os dados extraídos do contrato de representação comercial, campo a campo, com nível de confiança.",
  input_schema: {
    type: "object",
    properties: {
      representanteNome: CAMPO_TEXTO,
      representanteCpfCnpj: CAMPO_TEXTO,
      numero: CAMPO_TEXTO,
      vigenciaInicio: CAMPO_TEXTO,
      vigenciaFim: CAMPO_TEXTO,
      tipoCalculo: {
        type: "object",
        properties: { valor: { enum: ["DESC_POL1", "DESC_POL2", "META", "POLV3_LEGACY", "FIXO", "SEMTAB", null] }, confianca: { enum: ["alta", "media", "baixa"] } },
        required: ["valor", "confianca"],
      },
      percentualFixo: CAMPO_NUMERO,
      multaConfidencialidadeMultiplicador: CAMPO_NUMERO,
      multaNaoConcorrenciaMultiplicador: CAMPO_NUMERO,
      multaDescumprimentoPercentual: CAMPO_NUMERO,
      temBonificacao: CAMPO_BOOLEANO,
      tipoMetaBonificacao: {
        type: "object",
        properties: { valor: { enum: ["QUANTIDADE_DOSES", "VALOR_FATURAMENTO", null] }, confianca: { enum: ["alta", "media", "baixa"] } },
        required: ["valor", "confianca"],
      },
      metaQuantidadeDoses: CAMPO_NUMERO,
      metaValorFaturamento: CAMPO_NUMERO,
      bonusFixoValor: CAMPO_NUMERO,
      percentualSemMeta: CAMPO_NUMERO,
      percentualExcedente: CAMPO_NUMERO,
      resumoContrato: { type: "string" },
      clausulasDuvidosas: { type: "array", items: { type: "string" } },
    },
    required: [
      "representanteNome",
      "representanteCpfCnpj",
      "numero",
      "vigenciaInicio",
      "vigenciaFim",
      "tipoCalculo",
      "percentualFixo",
      "multaConfidencialidadeMultiplicador",
      "multaNaoConcorrenciaMultiplicador",
      "multaDescumprimentoPercentual",
      "temBonificacao",
      "tipoMetaBonificacao",
      "metaQuantidadeDoses",
      "metaValorFaturamento",
      "bonusFixoValor",
      "percentualSemMeta",
      "percentualExcedente",
      "resumoContrato",
      "clausulasDuvidosas",
    ],
  },
};

const PROMPT_SISTEMA = `Você é um assistente que extrai dados estruturados de contratos de representação comercial de uma empresa de genética animal (sêmen bovino).

Arquétipos de motor de comissão conhecidos:
- DESC_POL1 / DESC_POL2: comissão calculada por uma tabela de desconto por dose.
- META: percentual fixo sem bater meta de doses, bônus + percentual maior sobre o excedente ao bater a meta.
- POLV3_LEGACY: faixas de comissão por faturamento total do ciclo (não por desconto unitário).
- FIXO: percentual único fixo sobre o valor recebido, sem tabela.
- SEMTAB: quando o contrato menciona uma tabela/política externa que não está anexada ao documento.

Regras obrigatórias:
1. Preencha "confianca": "alta" SOMENTE quando o valor está escrito de forma inequívoca no texto.
2. Use "confianca": "media" quando o valor é uma interpretação razoável mas o texto é ambíguo, incompleto ou depende de um anexo não fornecido.
3. Use "confianca": "baixa" E "valor": null quando você não tem base textual suficiente — NUNCA invente ou estime um número.
4. Toda cláusula ambígua, contraditória, ou que dependa de um documento externo (ex: "conforme tabela em anexo") deve ir em "clausulasDuvidosas", em português, citando o trecho relevante.
5. Datas sempre no formato AAAA-MM-DD.
6. Responda exclusivamente através da ferramenta fornecida — não escreva texto fora dela.`;

/**
 * Interpretação de contrato via IA (Prompt 2, §5.3). Chama a API da
 * Anthropic com o texto extraído do PDF e valida a resposta pelo schema
 * Zod — nunca confia cegamente no JSON retornado pelo modelo.
 */
export async function interpretarContrato(textoContrato: string): Promise<ResultadoInterpretacao> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      sucesso: false,
      erro:
        "ANTHROPIC_API_KEY não configurada. Adicione a variável de ambiente (no .env local e nas Environment Variables do projeto na Vercel) para habilitar a interpretação automática de contratos por IA.",
      codigo: "API_KEY_AUSENTE",
    };
  }

  const client = new Anthropic({ apiKey });

  // Contratos reais têm ~20+ páginas — corta um teto generoso para não
  // estourar o limite de contexto em casos extremos, sem truncar o miolo
  // do contrato (onde vivem as cláusulas de comissão).
  const textoLimitado = textoContrato.slice(0, 60_000);

  let resposta: Anthropic.Message;
  try {
    resposta = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      system: PROMPT_SISTEMA,
      tools: [FERRAMENTA_EXTRACAO],
      tool_choice: { type: "tool", name: NOME_FERRAMENTA },
      messages: [{ role: "user", content: `Extraia os dados do contrato abaixo:\n\n${textoLimitado}` }],
    });
  } catch (erro) {
    return {
      sucesso: false,
      erro: `Falha ao chamar a API da Anthropic: ${erro instanceof Error ? erro.message : "erro desconhecido"}`,
      codigo: "FALHA_API",
    };
  }

  const blocoFerramenta = resposta.content.find((bloco): bloco is Anthropic.ToolUseBlock => bloco.type === "tool_use");
  if (!blocoFerramenta) {
    return { sucesso: false, erro: "A IA não retornou uma resposta estruturada.", codigo: "RESPOSTA_INESPERADA" };
  }

  const validado = iaContratoSchema.safeParse(blocoFerramenta.input);
  if (!validado.success) {
    return {
      sucesso: false,
      erro: `A resposta da IA não bateu com o formato esperado: ${validado.error.issues[0]?.message ?? "erro de validação"}`,
      codigo: "VALIDACAO_FALHOU",
    };
  }

  return { sucesso: true, dados: validado.data };
}
