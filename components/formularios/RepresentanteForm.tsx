"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { representanteSchema, type RepresentanteFormValues } from "@/lib/validacoes/representante";
import { criarRepresentante, atualizarRepresentante } from "@/app/(dashboard)/representantes/actions";

interface RepresentanteFormProps {
  representanteId?: string;
  valoresIniciais?: Partial<RepresentanteFormValues>;
}

export function RepresentanteForm({ representanteId, valoresIniciais }: RepresentanteFormProps) {
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const modoEdicao = Boolean(representanteId);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RepresentanteFormValues>({
    resolver: zodResolver(representanteSchema),
    defaultValues: {
      nome: "",
      cpfCnpj: "",
      email: "",
      telefone: "",
      observacoes: "",
      ativo: true,
      criarAcessoPortal: false,
      ...valoresIniciais,
    },
  });

  const criarAcessoPortal = watch("criarAcessoPortal");

  async function onSubmit(dados: RepresentanteFormValues) {
    setErroServidor(null);
    setEnviando(true);
    const resultado = representanteId ? await atualizarRepresentante(representanteId, dados) : await criarRepresentante(dados);
    setEnviando(false);

    if (!resultado.sucesso) {
      setErroServidor(resultado.erro);
      return;
    }

    router.push("/representantes");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-lg flex-col gap-4" noValidate>
      <Campo label="Nome completo" erro={errors.nome?.message}>
        <input className="input" {...register("nome")} />
      </Campo>

      <Campo label="CPF/CNPJ" erro={errors.cpfCnpj?.message}>
        <input className="input" {...register("cpfCnpj")} placeholder="000.000.000-00 ou 00.000.000/0000-00" />
      </Campo>

      <Campo label="E-mail" erro={errors.email?.message}>
        <input className="input" type="email" {...register("email")} />
      </Campo>

      <Campo label="Telefone" erro={errors.telefone?.message}>
        <input className="input" {...register("telefone")} />
      </Campo>

      <Campo label="Observações" erro={errors.observacoes?.message}>
        <textarea className="input" rows={3} {...register("observacoes")} />
      </Campo>

      <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
        <input type="checkbox" {...register("ativo")} />
        Ativo
      </label>

      {!modoEdicao && (
        <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
          <input type="checkbox" {...register("criarAcessoPortal")} />
          Criar acesso ao portal do representante
        </label>
      )}
      {criarAcessoPortal && !modoEdicao && (
        <p className="text-xs text-neutral-500">
          O e-mail informado acima será usado como login. O representante receberá instruções de definição de senha.
        </p>
      )}

      {erroServidor && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {erroServidor}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={enviando} className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
          {enviando ? "Salvando..." : modoEdicao ? "Salvar alterações" : "Cadastrar representante"}
        </button>
        <button type="button" onClick={() => router.push("/representantes")} className="rounded-md border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Campo({ label, erro, children }: { label: string; erro?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">{label}</label>
      {children}
      {erro && <span className="text-xs text-red-600">{erro}</span>}
    </div>
  );
}
