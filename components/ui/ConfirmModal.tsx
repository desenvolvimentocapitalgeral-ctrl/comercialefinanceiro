"use client";

import { useState } from "react";

interface ConfirmModalProps {
  aberto: boolean;
  titulo: string;
  mensagem: string;
  pedirMotivo?: boolean;
  confirmando?: boolean;
  onConfirmar: (motivo?: string) => void;
  onCancelar: () => void;
}

/**
 * Modal de confirmação customizado — nunca usar window.confirm()/window.prompt()
 * nativos: quebram a automação de teste (dialog bloqueia a thread de JS) e
 * fogem do padrão do resto do sistema (Prompt 1, Parte C, Seção 9.2 exige
 * modal com motivo em texto livre para ações destrutivas/sensíveis).
 */
export function ConfirmModal({ aberto, titulo, mensagem, pedirMotivo, confirmando, onConfirmar, onCancelar }: ConfirmModalProps) {
  const [motivo, setMotivo] = useState("");

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg dark:bg-neutral-900">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{titulo}</h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{mensagem}</p>

        {pedirMotivo && (
          <textarea
            className="input mt-3 w-full"
            rows={2}
            placeholder="Motivo (obrigatório)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={confirmando || (pedirMotivo && motivo.trim().length === 0)}
            onClick={() => onConfirmar(pedirMotivo ? motivo : undefined)}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {confirmando ? "Confirmando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
