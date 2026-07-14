"use client";

import { useState } from "react";

export interface ContratoInfoTooltipData {
  numero: string | null;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  statusAssinatura: string;
  motorComissao: string | null;
  percentualComissao: string | null;
  motorBonificacao: string | null;
  metaBonificacao: string | null;
  bonusFixoValor: string | null;
}

/**
 * Anotação com o resumo do contrato ao passar o mouse — evita ter que abrir
 * a tela de detalhe só para conferir motor/percentual/meta vigentes.
 */
export function ContratoInfoTooltip({ children, dados }: { children: React.ReactNode; dados: ContratoInfoTooltipData }) {
  const [visivel, setVisivel] = useState(false);

  return (
    <span className="relative inline-flex" onMouseEnter={() => setVisivel(true)} onMouseLeave={() => setVisivel(false)}>
      {children}

      {visivel && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-neutral-200 bg-white p-3 text-xs shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
            <dt className="text-neutral-500">Número</dt>
            <dd className="text-neutral-800 dark:text-neutral-200">{dados.numero ?? "—"}</dd>

            <dt className="text-neutral-500">Vigência</dt>
            <dd className="numerico text-neutral-800 dark:text-neutral-200">
              {dados.vigenciaInicio} – {dados.vigenciaFim ?? "atual"}
            </dd>

            <dt className="text-neutral-500">Assinatura</dt>
            <dd className="text-neutral-800 dark:text-neutral-200">{dados.statusAssinatura}</dd>

            <dt className="col-span-2 mt-1 border-t border-neutral-100 pt-1 font-medium text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
              Comissão
            </dt>
            <dt className="text-neutral-500">Motor</dt>
            <dd className="text-neutral-800 dark:text-neutral-200">{dados.motorComissao ?? "—"}</dd>
            {dados.percentualComissao && (
              <>
                <dt className="text-neutral-500">Percentual</dt>
                <dd className="numerico text-neutral-800 dark:text-neutral-200">{dados.percentualComissao}</dd>
              </>
            )}

            {dados.motorBonificacao && (
              <>
                <dt className="col-span-2 mt-1 border-t border-neutral-100 pt-1 font-medium text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
                  Bonificação
                </dt>
                <dt className="text-neutral-500">Motor</dt>
                <dd className="text-neutral-800 dark:text-neutral-200">{dados.motorBonificacao}</dd>
                {dados.metaBonificacao && (
                  <>
                    <dt className="text-neutral-500">Meta</dt>
                    <dd className="numerico text-neutral-800 dark:text-neutral-200">{dados.metaBonificacao}</dd>
                  </>
                )}
                {dados.bonusFixoValor && (
                  <>
                    <dt className="text-neutral-500">Bônus fixo</dt>
                    <dd className="numerico text-neutral-800 dark:text-neutral-200">{dados.bonusFixoValor}</dd>
                  </>
                )}
              </>
            )}
          </dl>
        </div>
      )}
    </span>
  );
}
