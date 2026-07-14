"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { vendaManualSchema, type VendaManualFormValues } from "@/lib/validacoes/venda";
import { criarVendaManual } from "@/app/(dashboard)/vendas/actions";

interface Opcao {
  id: string;
  nome: string;
}

interface VendaFormProps {
  clientes: Opcao[];
  produtos: Opcao[];
  representantes: Opcao[];
}

function comoNumeroOpcional(valor: string): number | undefined {
  return valor === "" ? undefined : Number(valor);
}

export function VendaForm({ clientes, produtos, representantes }: VendaFormProps) {
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VendaManualFormValues>({
    resolver: zodResolver(vendaManualSchema),
    defaultValues: { clienteId: "", produtoId: "", representanteId: "", dataVenda: "", valorTotal: 0, quantidadeParcelas: 1 },
  });

  async function onSubmit(dados: VendaManualFormValues) {
    setErroServidor(null);
    setEnviando(true);
    const resultado = await criarVendaManual(dados);
    setEnviando(false);

    if (!resultado.sucesso) {
      setErroServidor(resultado.erro);
      return;
    }

    router.push("/vendas");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-lg flex-col gap-4" noValidate>
      <Campo label="Cliente" erro={errors.clienteId?.message}>
        <select className="input" {...register("clienteId")}>
          <option value="">Selecione...</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </Campo>

      <Campo label="Produto" erro={errors.produtoId?.message}>
        <select className="input" {...register("produtoId")}>
          <option value="">Selecione...</option>
          {produtos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </Campo>

      <Campo label="Representante" erro={errors.representanteId?.message}>
        <select className="input" {...register("representanteId")}>
          <option value="">Selecione...</option>
          {representantes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nome}
            </option>
          ))}
        </select>
      </Campo>

      <Campo label="Data da venda" erro={errors.dataVenda?.message}>
        <input className="input" type="date" {...register("dataVenda")} />
      </Campo>

      <Campo label="Valor total (R$)" erro={errors.valorTotal?.message}>
        <input className="input" type="number" step="0.01" {...register("valorTotal", { valueAsNumber: true })} />
      </Campo>

      <Campo label="Quantidade de parcelas" erro={errors.quantidadeParcelas?.message}>
        <input className="input" type="number" {...register("quantidadeParcelas", { valueAsNumber: true })} />
      </Campo>

      <Campo label="Doses vendidas (opcional — preenchimento manual, ver lacuna do ERP)" erro={errors.dosesVendidas?.message}>
        <input className="input" type="number" {...register("dosesVendidas", { setValueAs: comoNumeroOpcional })} />
      </Campo>

      <Campo label="Desconto concedido por dose em R$ (opcional)" erro={errors.descontoConcedidoPorDose?.message}>
        <input className="input" type="number" step="0.01" {...register("descontoConcedidoPorDose", { setValueAs: comoNumeroOpcional })} />
      </Campo>

      {erroServidor && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {erroServidor}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={enviando} className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
          {enviando ? "Salvando..." : "Cadastrar venda"}
        </button>
        <button type="button" onClick={() => router.push("/vendas")} className="rounded-md border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700">
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
