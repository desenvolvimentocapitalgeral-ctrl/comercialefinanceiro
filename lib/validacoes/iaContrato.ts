import { z } from "zod";

/**
 * Resposta estruturada da IA de interpretação de contrato (Prompt 2, §5.3).
 * Cada campo extraído vem com nível de confiança — "alta" pode ser
 * pré-preenchida direto, "média"/"baixa" exigem confirmação humana
 * explícita antes de qualquer gravação. Nunca um valor "chutado": quando a
 * IA não consegue extrair um campo com segurança, valor = null e
 * confianca = "baixa".
 */
const nivelConfianca = z.enum(["alta", "media", "baixa"]);

function campoTexto() {
  return z.object({ valor: z.string().nullable(), confianca: nivelConfianca });
}

function campoNumero() {
  return z.object({ valor: z.number().nullable(), confianca: nivelConfianca });
}

export const iaContratoSchema = z.object({
  representanteNome: campoTexto(),
  representanteCpfCnpj: campoTexto(),
  numero: campoTexto(),
  vigenciaInicio: campoTexto(), // "AAAA-MM-DD"
  vigenciaFim: campoTexto(), // "AAAA-MM-DD" ou null se indeterminada
  tipoCalculo: z.object({
    valor: z.enum(["DESC_POL1", "DESC_POL2", "META", "POLV3_LEGACY", "FIXO", "SEMTAB"]).nullable(),
    confianca: nivelConfianca,
  }),
  percentualFixo: campoNumero(), // usado quando tipoCalculo = FIXO
  multaConfidencialidadeMultiplicador: campoNumero(),
  multaNaoConcorrenciaMultiplicador: campoNumero(),
  multaDescumprimentoPercentual: campoNumero(),
  temBonificacao: z.object({ valor: z.boolean().nullable(), confianca: nivelConfianca }),
  tipoMetaBonificacao: z.object({
    valor: z.enum(["QUANTIDADE_DOSES", "VALOR_FATURAMENTO"]).nullable(),
    confianca: nivelConfianca,
  }),
  metaQuantidadeDoses: campoNumero(),
  metaValorFaturamento: campoNumero(),
  bonusFixoValor: campoNumero(),
  percentualSemMeta: campoNumero(),
  percentualExcedente: campoNumero(),
  resumoContrato: z.string(), // 2-3 frases, vira Contrato.resumoIA
  clausulasDuvidosas: z.array(z.string()), // texto livre — nunca um valor "chutado" no lugar
});

export type IaContratoResposta = z.infer<typeof iaContratoSchema>;

/** Campos com confiança média/baixa nunca são aplicados sem confirmação humana explícita. */
export function exigeConfirmacao(confianca: "alta" | "media" | "baixa"): boolean {
  return confianca !== "alta";
}
