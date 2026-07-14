import { z } from "zod";

export const TIPOS_CALCULO = ["DESC_POL1", "DESC_POL2", "META", "POLV3_LEGACY", "FIXO", "SEMTAB"] as const;
export const MOMENTOS_APURACAO = ["RECEBIMENTO", "FATURAMENTO"] as const;
export const TIPOS_META = ["QUANTIDADE_DOSES", "VALOR_FATURAMENTO"] as const;
export const BASES_CICLO = ["FATURAMENTO", "RECEBIMENTO"] as const;

// Campos numéricos usam z.number() puro (não z.coerce) para manter o tipo de
// entrada do formulário idêntico ao de saída — registrar com { valueAsNumber: true }
// no input. z.coerce.number().optional() gera um tipo de entrada `unknown` que
// quebra a inferência de tipos do zodResolver do React Hook Form.
export const regraComissaoSchema = z.object({
  tipoCalculo: z.enum(TIPOS_CALCULO),
  percentual: z.number().min(0).max(100).optional(),
  momentoApuracao: z.enum(MOMENTOS_APURACAO),
  aplicaSobre: z.string().optional().or(z.literal("")),
  condicoesEspeciais: z.string().optional().or(z.literal("")),
});

export const regraBonificacaoSchema = z.object({
  tipoCalculo: z.enum(TIPOS_CALCULO),
  tipoMeta: z.enum(TIPOS_META),
  metaQuantidadeDoses: z.number().int().positive().optional(),
  metaValorFaturamento: z.number().positive().optional(),
  baseCiclo: z.enum(BASES_CICLO),
  bonusFixoValor: z.number().min(0),
  percentualSemMeta: z.number().min(0).max(100),
  percentualExcedente: z.number().min(0).max(100).optional(),
  condicoesPerda: z.string().optional().or(z.literal("")),
});

export const contratoSchema = z.object({
  representanteId: z.string().min(1, "Selecione um representante"),
  numero: z.string().optional().or(z.literal("")),
  vigenciaInicio: z.string().min(1, "Informe a data de início"),
  vigenciaFim: z.string().optional().or(z.literal("")),
  multaConfidencialidadeMultiplicador: z.number().min(0).optional(),
  multaNaoConcorrenciaMultiplicador: z.number().min(0).optional(),
  multaDescumprimentoPercentual: z.number().min(0).max(100).optional(),
  regraComissao: regraComissaoSchema,
  temBonificacao: z.boolean(),
  regraBonificacao: regraBonificacaoSchema.optional(),
});

export type ContratoFormValues = z.infer<typeof contratoSchema>;
