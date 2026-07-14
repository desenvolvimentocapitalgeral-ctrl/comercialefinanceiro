"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ContratoInfoTooltip } from "@/components/ui/ContratoInfoTooltip";
import { formatarCpfCnpj } from "@/lib/validacoes/cpfCnpj";
import { tipoContrato } from "@/lib/utils/contrato";
import { alternarStatusRepresentante } from "@/app/(dashboard)/representantes/actions";

export interface RepresentanteLinha {
  id: string;
  nome: string;
  cpfCnpj: string;
  email: string | null;
  ativo: boolean;
  contratoAtivo: boolean;
  contratoNumero: string | null;
  contratoVigenciaInicio: string | null; // "AAAA-MM-DD"
  contratoVigenciaFim: string | null; // "AAAA-MM-DD"
  contratoStatusAssinatura: string | null;
  motorComissao: string | null;
  percentualComissao: string | null;
  motorBonificacao: string | null;
  metaBonificacao: string | null;
  bonusFixoValor: string | null;
  temComissao: boolean;
  temBonificacao: boolean;
}

const columnHelper = createColumnHelper<RepresentanteLinha>();

// Sobreposição do intervalo [de, ate] com a vigência do contrato — mesmo
// critério usado na listagem de Contratos. Ambos os lados já vêm no formato
// "AAAA-MM-DD", então a comparação de string lexicográfica é segura.
function contratoNoPeriodo(r: RepresentanteLinha, de: string, ate: string): boolean {
  if (!r.contratoVigenciaInicio) return false;
  if (de && r.contratoVigenciaFim && r.contratoVigenciaFim < de) return false;
  if (ate && r.contratoVigenciaInicio > ate) return false;
  return true;
}

function formatarDataBr(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export function RepresentantesTable({ representantes }: { representantes: RepresentanteLinha[] }) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filtro, setFiltro] = useState("");
  const [periodoDe, setPeriodoDe] = useState("");
  const [periodoAte, setPeriodoAte] = useState("");
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [alvoAlternancia, setAlvoAlternancia] = useState<RepresentanteLinha | null>(null);

  const dadosFiltradosPorPeriodo = useMemo(() => {
    if (!periodoDe && !periodoAte) return representantes;
    return representantes.filter((r) => contratoNoPeriodo(r, periodoDe, periodoAte));
  }, [representantes, periodoDe, periodoAte]);

  async function confirmarAlternancia(motivo?: string) {
    if (!alvoAlternancia || !motivo) return;
    setProcessandoId(alvoAlternancia.id);
    await alternarStatusRepresentante(alvoAlternancia.id, !alvoAlternancia.ativo, motivo);
    setProcessandoId(null);
    setAlvoAlternancia(null);
    router.refresh();
  }

  const columns = [
    columnHelper.accessor("nome", {
      header: "Nome",
      cell: (info) => {
        const r = info.row.original;
        if (!r.contratoAtivo) return info.getValue();
        return (
          <ContratoInfoTooltip
            dados={{
              numero: r.contratoNumero,
              vigenciaInicio: r.contratoVigenciaInicio ? formatarDataBr(r.contratoVigenciaInicio) : "—",
              vigenciaFim: r.contratoVigenciaFim ? formatarDataBr(r.contratoVigenciaFim) : null,
              statusAssinatura: r.contratoStatusAssinatura ?? "—",
              motorComissao: r.motorComissao,
              percentualComissao: r.percentualComissao,
              motorBonificacao: r.motorBonificacao,
              metaBonificacao: r.metaBonificacao,
              bonusFixoValor: r.bonusFixoValor,
            }}
          >
            <span className="cursor-help border-b border-dotted border-neutral-400">{r.nome}</span>
          </ContratoInfoTooltip>
        );
      },
    }),
    columnHelper.accessor("cpfCnpj", { header: "CPF/CNPJ", cell: (info) => <span className="numerico">{formatarCpfCnpj(info.getValue())}</span> }),
    columnHelper.accessor("email", { header: "E-mail", cell: (info) => info.getValue() ?? "—" }),
    columnHelper.display({
      id: "tipoContrato",
      header: "Tipo de contrato",
      cell: (info) => {
        const r = info.row.original;
        if (!r.contratoAtivo) return <StatusBadge label="Sem contrato ativo" cor="ambar" />;
        const tipo = tipoContrato(r.temComissao, r.temBonificacao);
        return <StatusBadge label={tipo.label} cor={tipo.cor} />;
      },
    }),
    columnHelper.accessor("ativo", {
      header: "Status",
      cell: (info) => <StatusBadge label={info.getValue() ? "Ativo" : "Inativo"} cor={info.getValue() ? "verde" : "neutro"} />,
    }),
    columnHelper.display({
      id: "acoes",
      header: "Ações",
      cell: (info) => (
        <div className="flex gap-3 text-sm">
          <Link href={`/representantes/${info.row.original.id}/editar`} className="text-neutral-600 underline hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
            Editar
          </Link>
          <button
            type="button"
            disabled={processandoId === info.row.original.id}
            onClick={() => setAlvoAlternancia(info.row.original)}
            className="text-neutral-600 underline hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            {info.row.original.ativo ? "Desativar" : "Reativar"}
          </button>
        </div>
      ),
    }),
  ];

  const table = useReactTable({
    data: dadosFiltradosPorPeriodo,
    columns,
    state: { sorting, globalFilter: filtro },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFiltro,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (representantes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
        <p className="text-sm text-neutral-500">Nenhum representante cadastrado ainda.</p>
        <Link href="/representantes/novo" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
          Cadastrar o primeiro representante
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Buscar por nome ou documento..."
          className="input max-w-xs"
        />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Vigência do contrato de</label>
          <input type="date" value={periodoDe} onChange={(e) => setPeriodoDe(e.target.value)} className="input" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300">até</label>
          <input type="date" value={periodoAte} onChange={(e) => setPeriodoAte(e.target.value)} className="input" />
        </div>
        {(periodoDe || periodoAte) && (
          <button
            type="button"
            onClick={() => {
              setPeriodoDe("");
              setPeriodoAte("");
            }}
            className="text-sm text-neutral-500 underline"
          >
            Limpar período
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-100 dark:bg-neutral-900">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="cursor-pointer px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{ asc: " ↑", desc: " ↓" }[header.column.getIsSorted() as string] ?? ""}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-neutral-500">
                  Nenhum representante com contrato vigente no período informado.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-t border-neutral-100 dark:border-neutral-800">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-2 text-neutral-800 dark:text-neutral-200">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        aberto={alvoAlternancia !== null}
        titulo={alvoAlternancia?.ativo ? "Desativar representante" : "Reativar representante"}
        mensagem={`${alvoAlternancia?.ativo ? "Desativar" : "Reativar"} ${alvoAlternancia?.nome}? Isso não afeta apurações já calculadas.`}
        pedirMotivo
        confirmando={processandoId === alvoAlternancia?.id}
        onConfirmar={confirmarAlternancia}
        onCancelar={() => setAlvoAlternancia(null)}
      />
    </div>
  );
}
