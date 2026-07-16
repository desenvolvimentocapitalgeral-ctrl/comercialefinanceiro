"use client";

import { useState, type ReactNode } from "react";

/**
 * Ambas as abas ficam sempre no DOM — a inativa só fica "hidden" na tela,
 * mas volta a aparecer na impressão (print:block), para o PDF/impresso
 * sair completo independente de qual aba estava selecionada.
 */
export function AbasRecibo({ abaBonificacao, abaComissao }: { abaBonificacao: ReactNode; abaComissao: ReactNode }) {
  const [ativa, setAtiva] = useState<"bonificacao" | "comissao">("bonificacao");

  return (
    <div>
      <div className="flex gap-1 border-b border-neutral-200 print:hidden dark:border-neutral-800">
        <button
          type="button"
          onClick={() => setAtiva("bonificacao")}
          className={`px-4 py-2 text-sm font-medium ${
            ativa === "bonificacao"
              ? "border-b-2 border-neutral-900 text-neutral-900 dark:border-white dark:text-white"
              : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          }`}
        >
          Bonificação — a pagar este mês
        </button>
        <button
          type="button"
          onClick={() => setAtiva("comissao")}
          className={`px-4 py-2 text-sm font-medium ${
            ativa === "comissao"
              ? "border-b-2 border-neutral-900 text-neutral-900 dark:border-white dark:text-white"
              : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          }`}
        >
          Comissão — futura
        </button>
      </div>

      <div className={ativa === "bonificacao" ? "block" : "hidden print:mt-6 print:block"}>{abaBonificacao}</div>
      <div className={ativa === "comissao" ? "block" : "hidden print:mt-6 print:block"}>{abaComissao}</div>
    </div>
  );
}
