"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registrarRecebimento } from "@/app/(dashboard)/contas-a-receber/actions";

interface RegistrarRecebimentoModalProps {
  parcelaId: string;
  saldoEmAberto: number;
  onFechar: () => void;
}

export function RegistrarRecebimentoModal({ parcelaId, saldoEmAberto, onFechar }: RegistrarRecebimentoModalProps) {
  const router = useRouter();
  const [dataRecebimento, setDataRecebimento] = useState("");
  const [valorRecebido, setValorRecebido] = useState(saldoEmAberto);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    setErro(null);
    if (!dataRecebimento) {
      setErro("Informe a data do recebimento.");
      return;
    }
    setEnviando(true);
    const resultado = await registrarRecebimento(parcelaId, dataRecebimento, valorRecebido, motivo);
    setEnviando(false);

    if (!resultado.sucesso) {
      setErro(resultado.erro);
      return;
    }

    onFechar();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg dark:bg-neutral-900">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Registrar recebimento</h2>
        <p className="mt-1 text-xs text-neutral-500">Saldo em aberto: R$ {saldoEmAberto.toFixed(2)}</p>

        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Data do recebimento</label>
            <input type="date" className="input" value={dataRecebimento} onChange={(e) => setDataRecebimento(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Valor recebido (R$)</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={valorRecebido}
              onChange={(e) => setValorRecebido(Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Motivo/observação</label>
            <textarea className="input" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
        </div>

        {erro && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{erro}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onFechar} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">
            Cancelar
          </button>
          <button
            type="button"
            disabled={enviando}
            onClick={confirmar}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {enviando ? "Registrando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
