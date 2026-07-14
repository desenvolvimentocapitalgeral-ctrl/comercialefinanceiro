"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { campanhaSchema, type CampanhaFormValues } from "@/lib/validacoes/campanha";
import { criarCampanha, atualizarCampanha } from "@/app/(dashboard)/campanhas/actions";

interface Opcao {
  id: string;
  nome: string;
}

interface CampanhaFormProps {
  campanhaId?: string;
  valoresIniciais?: Partial<CampanhaFormValues>;
  produtos: Opcao[];
  representantes: Opcao[];
}

export function CampanhaForm({ campanhaId, valoresIniciais, produtos, representantes }: CampanhaFormProps) {
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const modoEdicao = Boolean(campanhaId);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CampanhaFormValues>({
    resolver: zodResolver(campanhaSchema),
    defaultValues: {
      nome: "",
      descricao: "",
      dataInicio: "",
      dataFim: "",
      percentualComissaoEspecial: 0,
      produtoIdAlvo: "",
      representanteIdAlvo: "",
      ativa: true,
      ...valoresIniciais,
    },
  });

  async function onSubmit(dados: CampanhaFormValues) {
    setErroServidor(null);
    setEnviando(true);
    const resultado = campanhaId ? await atualizarCampanha(campanhaId, dados) : await criarCampanha(dados);
    setEnviando(false);

    if (!resultado.sucesso) {
      setErroServidor(resultado.erro);
      return;
    }

    router.push("/campanhas");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-lg flex-col gap-4" noValidate>
      <Campo label="Nome da campanha" erro={errors.nome?.message}>
        <input className="input" {...register("nome")} />
      </Campo>

      <Campo label="Descrição (opcional)" erro={errors.descricao?.message}>
        <textarea className="input" rows={2} {...register("descricao")} />
      </Campo>

      <div className="grid grid-cols-2 gap-4">
        <Campo label="Data de início" erro={errors.dataInicio?.message}>
          <input className="input" type="date" {...register("dataInicio")} />
        </Campo>
        <Campo label="Data de fim" erro={errors.dataFim?.message}>
          <input className="input" type="date" {...register("dataFim")} />
        </Campo>
      </div>

      <Campo label="Percentual de comissão especial (%)" erro={errors.percentualComissaoEspecial?.message}>
        <input className="input" type="number" step="0.001" {...register("percentualComissaoEspecial", { valueAsNumber: true })} />
      </Campo>

      <Campo label="Produto alvo (opcional — vazio = todos)" erro={errors.produtoIdAlvo?.message}>
        <select className="input" {...register("produtoIdAlvo")}>
          <option value="">Todos os produtos</option>
          {produtos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </Campo>

      <Campo label="Representante alvo (opcional — vazio = todos)" erro={errors.representanteIdAlvo?.message}>
        <select className="input" {...register("representanteIdAlvo")}>
          <option value="">Todos os representantes</option>
          {representantes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nome}
            </option>
          ))}
        </select>
      </Campo>

      <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
        <input type="checkbox" {...register("ativa")} />
        Ativa
      </label>

      <p className="text-xs text-neutral-500">
        A campanha é uma regra aditiva temporária: quando vigente na DATA DA VENDA (não do recebimento) e o
        alvo bater, o percentual acima sobrepõe o percentual do contrato para as apurações de comissão daquela
        venda — nunca altera a regra contratual em si.
      </p>

      {erroServidor && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {erroServidor}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={enviando} className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
          {enviando ? "Salvando..." : modoEdicao ? "Salvar alterações" : "Criar campanha"}
        </button>
        <button type="button" onClick={() => router.push("/campanhas")} className="rounded-md border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700">
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
