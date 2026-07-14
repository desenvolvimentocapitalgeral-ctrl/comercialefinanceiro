"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { estornarComissao } from "@/app/(dashboard)/comissoes/actions";

interface EstornoComissaoModalProps {
  apuracaoId: string;
  valorComissao: number;
  onFechar: () => void;
}

export function EstornoComissaoModal({ apuracaoId, valorComissao, onFechar }: EstornoComissaoModalProps) {
  const router = useRouter();
  const [valorEstornado, setValorEstornado] = useState(valorComissao);
  const [descontarDeProximoPagamento, setDescontarDeProximoPagamento] = useState(true);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    setErro(null);
    setEnviando(true);
    const resultado = await estornarComissao(apuracaoId, motivo, valorEstornado, descontarDeProximoPagamento);
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
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Estornar comissão</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Comissão paga: R$ {valorComissao.toFixed(2)} — a apuração original não é alterada, o estorno é registrado à
          parte e deduzido do próximo pagamento regular do representante.
        </p>

        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Valor a estornar (R$)</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={valorEstornado}
              onChange={(e) => setValorEstornado(Number(e.target.value))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
            <input
              type="checkbox"
              checked={descontarDeProximoPagamento}
              onChange={(e) => setDescontarDeProximoPagamento(e.target.checked)}
            />
            Descontar do próximo pagamento regular
          </label>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Motivo</label>
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
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {enviando ? "Estornando..." : "Confirmar estorno"}
          </button>
        </div>
      </div>
    </div>
  );
}
