"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { produtoSchema, type ProdutoFormValues } from "@/lib/validacoes/produto";
import { criarProduto, atualizarProduto } from "@/app/(dashboard)/produtos/actions";

interface ProdutoFormProps {
  produtoId?: string;
  valoresIniciais?: Partial<ProdutoFormValues>;
}

export function ProdutoForm({ produtoId, valoresIniciais }: ProdutoFormProps) {
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const modoEdicao = Boolean(produtoId);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProdutoFormValues>({
    resolver: zodResolver(produtoSchema),
    defaultValues: {
      nomePadrao: "",
      codigoInterno: "",
      precoTabela: 0,
      categoria: "",
      linhaGenetica: "",
      ativo: true,
      ...valoresIniciais,
    },
  });

  async function onSubmit(dados: ProdutoFormValues) {
    setErroServidor(null);
    setEnviando(true);
    const resultado = produtoId ? await atualizarProduto(produtoId, dados) : await criarProduto(dados);
    setEnviando(false);

    if (!resultado.sucesso) {
      setErroServidor(resultado.erro);
      return;
    }

    router.push("/produtos");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-lg flex-col gap-4" noValidate>
      <Campo label="Nome do produto" erro={errors.nomePadrao?.message}>
        <input className="input" {...register("nomePadrao")} />
      </Campo>

      <Campo label="Código interno" erro={errors.codigoInterno?.message}>
        <input className="input" {...register("codigoInterno")} placeholder="ex: SEMSIAO02001" />
      </Campo>

      <Campo label="Preço de tabela (R$)" erro={errors.precoTabela?.message}>
        <input className="input" type="number" step="0.01" {...register("precoTabela", { valueAsNumber: true })} />
      </Campo>
      {modoEdicao && (
        <p className="text-xs text-neutral-500">
          Alterar o preço aqui fecha o registro de preço vigente e abre um novo — o histórico é preservado para
          cálculo correto de desconto em vendas antigas.
        </p>
      )}

      <Campo label="Categoria (opcional)" erro={errors.categoria?.message}>
        <input className="input" {...register("categoria")} />
      </Campo>

      <Campo label="Linha genética (opcional)" erro={errors.linhaGenetica?.message}>
        <input className="input" {...register("linhaGenetica")} placeholder="ex: Corte Zebu | Nelore PO" />
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

      <div className="flex gap-2">
        <button type="submit" disabled={enviando} className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
          {enviando ? "Salvando..." : modoEdicao ? "Salvar alterações" : "Cadastrar produto"}
        </button>
        <button type="button" onClick={() => router.push("/produtos")} className="rounded-md border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700">
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
