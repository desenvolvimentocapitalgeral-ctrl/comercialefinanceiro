"use client";

import { useState } from "react";
import type { PrevisaoRepresentante } from "@/lib/servicos/previsaoRecebimentos";

const FORMATO_MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const FORMATO_MES = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

function tituloMes(mesChave: string): string {
  const [ano, mes] = mesChave.split("-").map(Number);
  const label = FORMATO_MES.format(new Date(ano, mes - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function RepresentanteTimelineCard({ previsao }: { previsao: PrevisaoRepresentante }) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <p className="font-medium text-neutral-900 dark:text-neutral-100">{previsao.representanteNome}</p>
          <p className="text-xs text-neutral-500">{previsao.porMes.length} mês(es) com parcelas pendentes</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-neutral-500">A receber (total pendente)</p>
            <p className="numerico font-semibold text-neutral-900 dark:text-neutral-100">{FORMATO_MOEDA.format(previsao.totalPendente)}</p>
          </div>
          <span className="text-neutral-400">{aberto ? "▲" : "▼"}</span>
        </div>
      </button>

      {aberto && (
        <div className="border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <div className="mb-3 grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-neutral-500">Comissão calculável</p>
              <p className="numerico font-medium text-neutral-900 dark:text-neutral-100">{FORMATO_MOEDA.format(previsao.totalCalculavel)}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">A apurar (dado manual pendente)</p>
              <p className="numerico font-medium text-neutral-500">{FORMATO_MOEDA.format(previsao.totalAApurar)}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Valor pendente (parcelas)</p>
              <p className="numerico font-medium text-neutral-900 dark:text-neutral-100">{FORMATO_MOEDA.format(previsao.totalPendente)}</p>
            </div>
          </div>

          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-100 dark:bg-neutral-900">
              <tr>
                <th className="px-3 py-2 font-medium text-neutral-600 dark:text-neutral-300">Mês</th>
                <th className="px-3 py-2 numerico text-right font-medium text-neutral-600 dark:text-neutral-300">Parcelas</th>
                <th className="px-3 py-2 numerico text-right font-medium text-neutral-600 dark:text-neutral-300">Valor pendente</th>
                <th className="px-3 py-2 numerico text-right font-medium text-neutral-600 dark:text-neutral-300">Comissão calculável</th>
                <th className="px-3 py-2 numerico text-right font-medium text-neutral-600 dark:text-neutral-300">A apurar</th>
              </tr>
            </thead>
            <tbody>
              {previsao.porMes.map((mes) => (
                <tr key={mes.mesChave} className="border-t border-neutral-100 dark:border-neutral-800">
                  <td className="px-3 py-2 text-neutral-800 dark:text-neutral-200">{tituloMes(mes.mesChave)}</td>
                  <td className="px-3 py-2 numerico text-right text-neutral-800 dark:text-neutral-200">{mes.qtdParcelas}</td>
                  <td className="px-3 py-2 numerico text-right text-neutral-800 dark:text-neutral-200">{FORMATO_MOEDA.format(mes.valorPendente)}</td>
                  <td className="px-3 py-2 numerico text-right font-medium text-neutral-900 dark:text-neutral-100">
                    {mes.valorCalculavel > 0 ? FORMATO_MOEDA.format(mes.valorCalculavel) : "—"}
                  </td>
                  <td className="px-3 py-2 numerico text-right text-neutral-500">
                    {mes.valorAApurar > 0 ? FORMATO_MOEDA.format(mes.valorAApurar) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-neutral-500">
            Comissão paga somente após o recebimento efetivo do cliente — estes valores ainda não estão disponíveis para pagamento.
          </p>
        </div>
      )}
    </div>
  );
}
