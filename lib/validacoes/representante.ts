import { z } from "zod";
import { cpfCnpjValido } from "@/lib/validacoes/cpfCnpj";

export const representanteSchema = z
  .object({
    nome: z.string().min(3, "Informe o nome completo"),
    cpfCnpj: z.string().refine(cpfCnpjValido, "CPF/CNPJ inválido"),
    email: z.string().email("E-mail inválido").optional().or(z.literal("")),
    telefone: z.string().optional().or(z.literal("")),
    observacoes: z.string().optional().or(z.literal("")),
    ativo: z.boolean(),
    criarAcessoPortal: z.boolean(),
  })
  .refine((dados) => !dados.criarAcessoPortal || (dados.email && dados.email.length > 0), {
    message: "E-mail é obrigatório para criar acesso ao portal",
    path: ["email"],
  });

export type RepresentanteFormValues = z.infer<typeof representanteSchema>;
