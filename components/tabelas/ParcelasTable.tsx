"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RegistrarRecebimentoModal } from "@/components/formularios/RegistrarRecebimentoModal";
import { RenegociarParcelaModal } from "@/components/formularios/RenegociarParcelaModal";

const STATUS_LABEL: Record<string, { label: string; cor: "verde" | "ambar" | "vermelho" | "neutro" }> = {
  PENDENTE: { label: "Pendente", cor: "ambar" },
  RECEBIDA: { label: "Recebida", cor: "verde" },
  RECEBIDA_PARCIAL: { label: "Recebida parcial", cor: "ambar" },
  CANCELADA: { label: "Cancelada", cor: "neutro" },
  RENEGOCIADA: { label: "Renegociada", cor: "neutro" },
};

export interface ParcelaLinha {
  id: string;
  cliente: string;
  representante: string;
  numeroParcela: number;
  quantidadeParcelas: number;
  valorParcela: number;
  saldoEmAberto: number;
  dataVencimento: string;
  status: string;
}

export function ParcelasTable({ parcelas }: { parcelas: ParcelaLinha[] }) {
  const [modalParcelaId, setModalParcelaId] = useState<string | null>(null);
  const [modalRenegociacaoId, setModalRenegociacaoId] = useState<string | null>(null);
  const parcelaSelecionada = parcelas.find((p) => p.id === modalParcelaId);
  const parcelaEmRenegociacao = parcelas.find((p) => p.id === modalRenegociacaoId);

  if (parcelas.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
        <p className="text-sm text-neutral-500">Nenhuma parcela lançada ainda — cadastre uma venda primeiro.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-neutral-100 dark:bg-neutral-900">
          <tr>
            <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Cliente</th>
            <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Representante</th>
            <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Parcela</th>
            <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Valor</th>
            <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Saldo em aberto</th>
            <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Vencimento</th>
            <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Status</th>
            <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Ações</th>
          </tr>
        </thead>
        <tbody>
          {parcelas.map((p) => (
            <tr key={p.id} className="border-t border-neutral-100 dark:border-neutral-800">
              <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">{p.cliente}</td>
              <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">{p.representante}</td>
              <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">
                {p.numeroParcela}/{p.quantidadeParcelas}
              </td>
              <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">
                {p.valorParcela.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </td>
              <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">
                {p.saldoEmAberto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </td>
              <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">{p.dataVencimento}</td>
              <td className="px-4 py-2">
                <StatusBadge label={STATUS_LABEL[p.status].label} cor={STATUS_LABEL[p.status].cor} />
              </td>
              <td className="px-4 py-2 text-sm">
                {p.saldoEmAberto > 0 && p.status !== "CANCELADA" && p.status !== "RENEGOCIADA" ? (
                  <div className="flex flex-col items-start gap-1">
                    <button
                      type="button"
                      onClick={() => setModalParcelaId(p.id)}
                      className="text-neutral-600 underline hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                    >
                      Registrar recebimento
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalRenegociacaoId(p.id)}
                      className="text-neutral-600 underline hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                    >
                      Renegociar
                    </button>
                  </div>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {parcelaSelecionada && (
        <RegistrarRecebimentoModal
          parcelaId={parcelaSelecionada.id}
          saldoEmAberto={parcelaSelecionada.saldoEmAberto}
          onFechar={() => setModalParcelaId(null)}
        />
      )}

      {parcelaEmRenegociacao && (
        <RenegociarParcelaModal
          parcelaId={parcelaEmRenegociacao.id}
          saldoEmAberto={parcelaEmRenegociacao.saldoEmAberto}
          onFechar={() => setModalRenegociacaoId(null)}
        />
      )}
    </div>
  );
}
