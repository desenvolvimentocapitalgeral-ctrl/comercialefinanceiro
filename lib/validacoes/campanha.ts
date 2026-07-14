import { z } from "zod";

export const campanhaSchema = z
  .object({
    nome: z.string().min(2, "Informe o nome da campanha"),
    descricao: z.string().optional(),
    dataInicio: z.string().min(1, "Informe a data de início"),
    dataFim: z.string().min(1, "Informe a data de fim"),
    percentualComissaoEspecial: z.number({ message: "Informe o percentual de comissão especial" }).min(0).max(100),
    // "" = sem alvo específico (vale para todos); convertido para null na camada de action.
    produtoIdAlvo: z.string().optional(),
    representanteIdAlvo: z.string().optional(),
    ativa: z.boolean(),
  })
  .refine((dados) => dados.dataFim >= dados.dataInicio, {
    message: "A data de fim não pode ser anterior à data de início",
    path: ["dataFim"],
  });

export type CampanhaFormValues = z.infer<typeof campanhaSchema>;
