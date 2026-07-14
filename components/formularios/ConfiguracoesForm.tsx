"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { empresaSchema, usuarioSchema, type EmpresaFormValues, type UsuarioFormValues } from "@/lib/validacoes/configuracoes";
import { atualizarEmpresa, criarUsuario, alternarStatusUsuario } from "@/app/(dashboard)/configuracoes/actions";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface UsuarioLinha {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  ativo: boolean;
}

export function EmpresaForm({ valoresIniciais }: { valoresIniciais: EmpresaFormValues }) {
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmpresaFormValues>({ resolver: zodResolver(empresaSchema), defaultValues: valoresIniciais });

  async function onSubmit(dados: EmpresaFormValues) {
    setMensagem(null);
    setEnviando(true);
    const resultado = await atualizarEmpresa(dados);
    setEnviando(false);
    setMensagem(resultado.sucesso ? "Configurações salvas." : resultado.erro);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-md flex-col gap-4" noValidate>
      <Campo label="Razão social" erro={errors.razaoSocial?.message}>
        <input className="input" {...register("razaoSocial")} />
      </Campo>
      <Campo label="Nome fantasia" erro={errors.nomeFantasia?.message}>
        <input className="input" {...register("nomeFantasia")} />
      </Campo>
      <div className="grid grid-cols-2 gap-4">
        <Campo label="Dia início do ciclo" erro={errors.diaInicioCiclo?.message}>
          <input className="input" type="number" {...register("diaInicioCiclo", { valueAsNumber: true })} />
        </Campo>
        <Campo label="Dia fim do ciclo" erro={errors.diaFimCiclo?.message}>
          <input className="input" type="number" {...register("diaFimCiclo", { valueAsNumber: true })} />
        </Campo>
      </div>
      <p className="text-xs text-neutral-500">
        Alterar o ciclo comercial afeta apenas vendas/recebimentos futuros — apurações já calculadas não são
        recalculadas retroativamente.
      </p>
      {mensagem && <p className="text-sm text-neutral-600 dark:text-neutral-400">{mensagem}</p>}
      <button type="submit" disabled={enviando} className="w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
        {enviando ? "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}

export function UsuariosSection({ usuarios, usuarioLogadoId }: { usuarios: UsuarioLinha[]; usuarioLogadoId: string }) {
  const router = useRouter();
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [processandoId, setProcessandoId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UsuarioFormValues>({ resolver: zodResolver(usuarioSchema), defaultValues: { nome: "", email: "", perfil: "FINANCEIRO" } });

  async function onSubmit(dados: UsuarioFormValues) {
    setMensagem(null);
    setEnviando(true);
    const resultado = await criarUsuario(dados);
    setEnviando(false);
    if (!resultado.sucesso) {
      setMensagem(resultado.erro);
      return;
    }
    setMensagem("Usuário criado.");
    reset();
    router.refresh();
  }

  async function alternar(usuario: UsuarioLinha) {
    setProcessandoId(usuario.id);
    await alternarStatusUsuario(usuario.id, !usuario.ativo);
    setProcessandoId(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-3" noValidate>
        <Campo label="Nome" erro={errors.nome?.message}>
          <input className="input" {...register("nome")} />
        </Campo>
        <Campo label="E-mail" erro={errors.email?.message}>
          <input className="input" type="email" {...register("email")} />
        </Campo>
        <Campo label="Perfil" erro={errors.perfil?.message}>
          <select className="input" {...register("perfil")}>
            <option value="FINANCEIRO">FINANCEIRO</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </Campo>
        <button type="submit" disabled={enviando} className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
          {enviando ? "Criando..." : "Novo usuário"}
        </button>
      </form>
      {mensagem && <p className="text-sm text-neutral-600 dark:text-neutral-400">{mensagem}</p>}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-100 dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Nome</th>
              <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">E-mail</th>
              <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Perfil</th>
              <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Status</th>
              <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Ações</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">{u.nome}</td>
                <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">{u.email}</td>
                <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">{u.perfil}</td>
                <td className="px-4 py-2">
                  <StatusBadge label={u.ativo ? "Ativo" : "Inativo"} cor={u.ativo ? "verde" : "neutro"} />
                </td>
                <td className="px-4 py-2 text-sm">
                  {u.id === usuarioLogadoId ? (
                    <span className="text-neutral-400">você</span>
                  ) : (
                    <button
                      type="button"
                      disabled={processandoId === u.id}
                      onClick={() => alternar(u)}
                      className="text-neutral-600 underline hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:text-neutral-100"
                    >
                      {u.ativo ? "Desativar" : "Reativar"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
