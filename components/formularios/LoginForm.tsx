"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { autenticar } from "@/app/(auth)/login/actions";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(1, "Informe a senha"),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? undefined;
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(dados: FormValues) {
    setErroServidor(null);
    setEnviando(true);
    const resultado = await autenticar({ ...dados, callbackUrl });
    setEnviando(false);

    if (!resultado.sucesso) {
      setErroServidor(resultado.erro);
      return;
    }

    router.push(resultado.destino);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex w-full max-w-sm flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          {...register("email")}
        />
        {errors.email && <span className="text-xs text-red-600">{errors.email.message}</span>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="senha" className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
          Senha
        </label>
        <input
          id="senha"
          type="password"
          autoComplete="current-password"
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          {...register("senha")}
        />
        {errors.senha && <span className="text-xs text-red-600">{errors.senha.message}</span>}
      </div>

      {erroServidor && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {erroServidor}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        {enviando ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
