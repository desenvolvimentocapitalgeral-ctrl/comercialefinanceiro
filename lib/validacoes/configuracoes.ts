import { z } from "zod";

export const empresaSchema = z.object({
  razaoSocial: z.string().min(2, "Informe a razão social"),
  nomeFantasia: z.string().min(2, "Informe o nome fantasia"),
  diaInicioCiclo: z.number().int().min(1).max(28),
  diaFimCiclo: z.number().int().min(1).max(28),
});
export type EmpresaFormValues = z.infer<typeof empresaSchema>;

export const usuarioSchema = z.object({
  nome: z.string().min(2, "Informe o nome"),
  email: z.string().email("E-mail inválido"),
  perfil: z.enum(["ADMIN", "FINANCEIRO"]),
});
export type UsuarioFormValues = z.infer<typeof usuarioSchema>;
