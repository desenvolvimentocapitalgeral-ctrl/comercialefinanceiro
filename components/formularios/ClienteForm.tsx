"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clienteSchema, type ClienteFormValues } from "@/lib/validacoes/cliente";
import { criarCliente, atualizarCliente } from "@/app/(dashboard)/clientes/actions";
import type { CandidatoFuzzy } from "@/lib/depara/resolverEntidade";

interface ClienteFormProps {
  clienteId?: string;
  valoresIniciais?: Partial<ClienteFormValues>;
}

export function ClienteForm({ clienteId, valoresIniciais }: ClienteFormProps) {
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [possivelDuplicata, setPossivelDuplicata] = useState<{ dados: ClienteFormValues; candidatos: CandidatoFuzzy[] } | null>(null);
  const modoEdicao = Boolean(clienteId);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClienteFormValues>({
    resolver: zodResolver(clienteSchema),
    defaultValues: { nomePadrao: "", cpfCnpj: "", ativo: true, ...valoresIniciais },
  });

  async function onSubmit(dados: ClienteFormValues) {
    setErroServidor(null);
    setEnviando(true);
    const resultado = clienteId ? await atualizarCliente(clienteId, dados) : await criarCliente(dados);
    setEnviando(false);

    if (!resultado.sucesso && resultado.codigo === "POSSIVEL_DUPLICATA") {
      setPossivelDuplicata({ dados, candidatos: resultado.candidatos });
      return;
    }

    if (!resultado.sucesso) {
      setErroServidor(resultado.erro);
      return;
    }

    router.push("/clientes");
    router.refresh();
  }

  async function criarMesmoAssim() {
    if (!possivelDuplicata) return;
    setEnviando(true);
    const resultado = await criarCliente(possivelDuplicata.dados, true);
    setEnviando(false);
    setPossivelDuplicata(null);

    if (!resultado.sucesso) {
      setErroServidor(resultado.erro);
      return;
    }

    router.push("/clientes");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-lg flex-col gap-4" noValidate>
      <Campo label="Nome do cliente" erro={errors.nomePadrao?.message}>
        <input className="input" {...register("nomePadrao")} />
      </Campo>

      <Campo label="CPF/CNPJ (opcional)" erro={errors.cpfCnpj?.message}>
        <input className="input" {...register("cpfCnpj")} placeholder="000.000.000-00 ou 00.000.000/0000-00" />
      </Campo>

      <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
        <input type="checkbox" {...register("ativo")} />
        Ativo
      </label>

      {erroServidor && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {erroServidor}
        </p>
      )}

      {possivelDuplicata && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
          <p className="font-medium text-amber-800 dark:text-amber-300">Possível cliente duplicado</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-amber-700 dark:text-amber-400">
            {possivelDuplicata.candidatos.map((c) => (
              <li key={c.entidadeId}>
                {c.nome} — {Math.round(c.similaridade * 100)}% parecido
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={enviando}
              onClick={criarMesmoAssim}
              className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              É diferente — criar mesmo assim
            </button>
            <button type="button" onClick={() => setPossivelDuplicata(null)} className="rounded-md border border-amber-400 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-300">
              Cancelar, vou verificar
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={enviando} className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
          {enviando ? "Salvando..." : modoEdicao ? "Salvar alterações" : "Cadastrar cliente"}
        </button>
        <button type="button" onClick={() => router.push("/clientes")} className="rounded-md border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700">
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
