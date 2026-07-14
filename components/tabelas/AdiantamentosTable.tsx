"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { novoAdiantamento } from "@/app/(dashboard)/comissoes/actions";

export interface AdiantamentoLinha {
  id: string;
  representanteNome: string;
  dataPagamento: string;
  valorTotal: number;
  valorCompensado: number;
  saldoEmAberto: number;
}

interface Opcao {
  id: string;
  nome: string;
}

export function AdiantamentosTable({ adiantamentos, representantes }: { adiantamentos: AdiantamentoLinha[]; representantes: Opcao[] }) {
  const router = useRouter();
  const [modalAberto, setModalAberto] = useState(false);
  const [representanteId, setRepresentanteId] = useState("");
  const [valor, setValor] = useState(0);
  const [dataPagamento, setDataPagamento] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    setErro(null);
    if (!representanteId) {
      setErro("Selecione o representante.");
      return;
    }
    if (!dataPagamento) {
      setErro("Informe a data do adiantamento.");
      return;
    }
    setEnviando(true);
    const resultado = await novoAdiantamento(representanteId, valor, dataPagamento, motivo);
    setEnviando(false);

    if (!resultado.sucesso) {
      setErro(resultado.erro);
      return;
    }

    setModalAberto(false);
    setRepresentanteId("");
    setValor(0);
    setDataPagamento("");
    setMotivo("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <button
          type="button"
          onClick={() => setModalAberto(true)}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          Novo adiantamento
        </button>
      </div>

      {adiantamentos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
          <p className="text-sm text-neutral-500">Nenhum adiantamento registrado ainda.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-100 dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Representante</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Data</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Valor</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Já compensado</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Saldo em aberto</th>
              </tr>
            </thead>
            <tbody>
              {adiantamentos.map((a) => (
                <tr key={a.id} className="border-t border-neutral-100 dark:border-neutral-800">
                  <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">{a.representanteNome}</td>
                  <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">{a.dataPagamento}</td>
                  <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">
                    {a.valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">
                    {a.valorCompensado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="px-4 py-2 numerico font-medium text-neutral-900 dark:text-neutral-100">
                    {a.saldoEmAberto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg dark:bg-neutral-900">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Novo adiantamento</h2>

            <div className="mt-3 flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Representante</label>
                <select className="input" value={representanteId} onChange={(e) => setRepresentanteId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {representantes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Valor (R$)</label>
                <input type="number" step="0.01" className="input" value={valor} onChange={(e) => setValor(Number(e.target.value))} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Data</label>
                <input type="date" className="input" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Motivo</label>
                <textarea className="input" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </div>
            </div>

            {erro && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{erro}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setModalAberto(false)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">
                Cancelar
              </button>
              <button
                type="button"
                disabled={enviando}
                onClick={confirmar}
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
              >
                {enviando ? "Salvando..." : "Criar adiantamento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
