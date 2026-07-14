import { z } from "zod";
import { cpfCnpjValido } from "@/lib/validacoes/cpfCnpj";

export const clienteSchema = z.object({
  nomePadrao: z.string().min(2, "Informe o nome do cliente"),
  cpfCnpj: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || cpfCnpjValido(v), "CPF/CNPJ inválido"),
  ativo: z.boolean(),
});

export type ClienteFormValues = z.infer<typeof clienteSchema>;
