"use server";

import { z } from "zod";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/lib/auth/config";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(1, "Informe a senha"),
});

export type ResultadoLogin =
  | { sucesso: true; destino: string }
  | { sucesso: false; erro: string; codigo: string };

export async function autenticar(dados: { email: string; senha: string; callbackUrl?: string }): Promise<ResultadoLogin> {
  const parsed = loginSchema.safeParse(dados);
  if (!parsed.success) {
    return { sucesso: false, erro: "Preencha e-mail e senha corretamente.", codigo: "VALIDACAO" };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      senha: parsed.data.senha,
      redirect: false,
    });
  } catch (erro) {
    if (erro instanceof AuthError) {
      return { sucesso: false, erro: "E-mail ou senha incorretos.", codigo: "CREDENCIAIS_INVALIDAS" };
    }
    throw erro;
  }

  const sessao = await auth();
  const perfil = sessao?.user?.perfil;
  const callbackUrl = dados.callbackUrl;

  const destinoPadrao = perfil === "REPRESENTANTE" ? "/portal" : "/dashboard";
  const destinoSeguro = callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : destinoPadrao;

  return { sucesso: true, destino: destinoSeguro };
}
