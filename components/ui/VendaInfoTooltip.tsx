"use client";

import { useState } from "react";

export interface VendaInfoTooltipData {
  numeroPedido: string | null;
  dataEntregaFisica: string | null;
  dosesVendidas: number | null;
  descontoConcedidoPorDose: string | null;
  origem: string;
  vendaAutorizadaExcepcionalmente: boolean;
  motorComissao: string | null;
}

/** Anotação com o resumo da venda ao passar o mouse — pedido, doses, desconto, entrega. */
export function VendaInfoTooltip({ children, dados }: { children: React.ReactNode; dados: VendaInfoTooltipData }) {
  const [visivel, setVisivel] = useState(false);

  return (
    <span className="relative inline-flex" onMouseEnter={() => setVisivel(true)} onMouseLeave={() => setVisivel(false)}>
      {children}

      {visivel && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-neutral-200 bg-white p-3 text-xs shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
            <dt className="text-neutral-500">Pedido</dt>
            <dd className="text-neutral-800 dark:text-neutral-200">{dados.numeroPedido ?? "—"}</dd>

            <dt className="text-neutral-500">Origem</dt>
            <dd className="text-neutral-800 dark:text-neutral-200">{dados.origem === "MANUAL" ? "Cadastro manual" : "Importação"}</dd>

            <dt className="text-neutral-500">Motor de comissão</dt>
            <dd className="text-neutral-800 dark:text-neutral-200">{dados.motorComissao ?? "—"}</dd>

            <dt className="text-neutral-500">Doses vendidas</dt>
            <dd className="numerico text-neutral-800 dark:text-neutral-200">{dados.dosesVendidas ?? "não informado"}</dd>

            <dt className="text-neutral-500">Desconto/dose</dt>
            <dd className="numerico text-neutral-800 dark:text-neutral-200">{dados.descontoConcedidoPorDose ?? "não informado"}</dd>

            <dt className="text-neutral-500">Entrega física</dt>
            <dd className="numerico text-neutral-800 dark:text-neutral-200">{dados.dataEntregaFisica ?? "não registrada"}</dd>

            {dados.vendaAutorizadaExcepcionalmente && (
              <dd className="col-span-2 mt-1 rounded bg-amber-50 px-2 py-1 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                Venda autorizada excepcionalmente
              </dd>
            )}
          </dl>
        </div>
      )}
    </span>
  );
}
