import { z } from "zod";

export const produtoSchema = z.object({
  nomePadrao: z.string().min(2, "Informe o nome do produto"),
  codigoInterno: z.string().min(1, "Informe o código interno"),
  precoTabela: z.number().positive("Informe um preço maior que zero"),
  categoria: z.string().optional().or(z.literal("")),
  linhaGenetica: z.string().optional().or(z.literal("")),
  ativo: z.boolean(),
});

export type ProdutoFormValues = z.infer<typeof produtoSchema>;
