"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { aprovarBonificacoes, gerarPagamentoBonificacao, recalcularBonificacaoCicloAtual } from "@/app/(dashboard)/bonificacoes/actions";
import { AjusteBonificacaoModal } from "@/components/formularios/AjusteBonificacaoModal";

const STATUS_LABEL: Record<string, { label: string; cor: "verde" | "ambar" | "vermelho" | "neutro" | "azul" }> = {
  PENDENTE: { label: "Pendente", cor: "ambar" },
  APROVADA: { label: "Aprovada", cor: "azul" },
  PAGA: { label: "Paga", cor: "verde" },
  CANCELADA: { label: "Cancelada", cor: "neutro" },
};

export interface ApuracaoBonificacaoLinha {
  id: string;
  representanteId: string;
  representanteNome: string;
  cicloId: string;
  cicloEstaFechado: boolean;
  valorApurado: number;
  dosesApuradas: number | null;
  metaValor: number;
  percentualAtingimento: number;
  bateuMeta: boolean;
  valorBonificacao: number;
  status: string;
}

export interface RegraParaRecalculo {
  id: string;
  representanteNome: string;
  tipoMeta: string;
}

export function BonificacoesTable({ apuracoes, regras }: { apuracoes: ApuracaoBonificacaoLinha[]; regras: RegraParaRecalculo[] }) {
  const router = useRouter();
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [modalPagamento, setModalPagamento] = useState(false);
  const [dataPagamento, setDataPagamento] = useState("");
  const [modalAjusteId, setModalAjusteId] = useState<string | null>(null);
  const apuracaoEmAjuste = apuracoes.find((a) => a.id === modalAjusteId);

  function alternarSelecao(id: string) {
    setSelecionadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  const linhasSelecionadas = apuracoes.filter((a) => selecionadas.has(a.id));
  const todasPendentes = linhasSelecionadas.length > 0 && linhasSelecionadas.every((a) => a.status === "PENDENTE");
  const todasAprovadas = linhasSelecionadas.length > 0 && linhasSelecionadas.every((a) => a.status === "APROVADA");
  const representantesDistintos = new Set(linhasSelecionadas.map((a) => a.representanteId)).size;

  async function recalcular(regraId: string) {
    setErro(null);
    setProcessando(true);
    const resultado = await recalcularBonificacaoCicloAtual(regraId);
    setProcessando(false);
    if (!resultado.sucesso) {
      setErro(resultado.erro);
      return;
    }
    router.refresh();
  }

  async function aprovarSelecionadas() {
    setErro(null);
    setProcessando(true);
    const resultado = await aprovarBonificacoes([...selecionadas]);
    setProcessando(false);
    if (!resultado.sucesso) {
      setErro(resultado.erro);
      return;
    }
    setSelecionadas(new Set());
    router.refresh();
  }

  async function confirmarPagamento() {
    setErro(null);
    if (!dataPagamento) {
      setErro("Informe a data do pagamento.");
      return;
    }
    setProcessando(true);
    const resultado = await gerarPagamentoBonificacao([...selecionadas], dataPagamento);
    setProcessando(false);
    if (!resultado.sucesso) {
      setErro(resultado.erro);
      return;
    }
    setModalPagamento(false);
    setDataPagamento("");
    setSelecionadas(new Set());
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {regras.length > 0 && (
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">Recalcular ciclo atual</p>
          <div className="flex flex-wrap gap-2">
            {regras.map((r) => (
              <button
                key={r.id}
                type="button"
                disabled={processando}
                onClick={() => recalcular(r.id)}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-neutral-700"
              >
                {r.representanteNome} ({r.tipoMeta === "QUANTIDADE_DOSES" ? "meta em doses" : "meta em R$"})
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!todasPendentes || processando}
          onClick={aprovarSelecionadas}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
        >
          Aprovar selecionadas ({linhasSelecionadas.length})
        </button>
        <button
          type="button"
          disabled={!todasAprovadas || representantesDistintos > 1 || processando}
          onClick={() => setModalPagamento(true)}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
        >
          Gerar pagamento
        </button>
      </div>

      {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{erro}</p>}

      {apuracoes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
          <p className="text-sm text-neutral-500">Nenhuma apuração de bonificação calculada ainda.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-100 dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-2"></th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Representante</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Ciclo</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Meta</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Apurado</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Atingimento</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Bateu meta?</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Bonificação</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Status</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Ações</th>
              </tr>
            </thead>
            <tbody>
              {apuracoes.map((a) => {
                const selecionavel = a.status === "PENDENTE" || a.status === "APROVADA";
                return (
                  <tr key={a.id} className="border-t border-neutral-100 dark:border-neutral-800">
                    <td className="px-4 py-2">
                      {selecionavel && <input type="checkbox" checked={selecionadas.has(a.id)} onChange={() => alternarSelecao(a.id)} />}
                    </td>
                    <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">{a.representanteNome}</td>
                    <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">
                      {a.cicloId}
                      {!a.cicloEstaFechado && (
                        <span className="ml-1">
                          <StatusBadge label="Prévia" cor="azul" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">
                      {a.dosesApuradas !== null ? `${a.metaValor} doses` : a.metaValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">
                      {a.dosesApuradas !== null ? `${a.dosesApuradas} doses` : a.valorApurado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">{a.percentualAtingimento}%</td>
                    <td className="px-4 py-2">
                      <StatusBadge label={a.bateuMeta ? "Sim" : "Não"} cor={a.bateuMeta ? "verde" : "ambar"} />
                    </td>
                    <td className="px-4 py-2 numerico font-medium text-neutral-900 dark:text-neutral-100">
                      {a.valorBonificacao.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge label={STATUS_LABEL[a.status].label} cor={STATUS_LABEL[a.status].cor} />
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {a.status === "PAGA" ? (
                        <button
                          type="button"
                          onClick={() => setModalAjusteId(a.id)}
                          className="text-neutral-600 underline hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                        >
                          Ajustar
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalPagamento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg dark:bg-neutral-900">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Gerar pagamento</h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              {linhasSelecionadas.length} apuração(ões), totalizando{" "}
              {linhasSelecionadas.reduce((acc, a) => acc + a.valorBonificacao, 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
            <div className="mt-3 flex flex-col gap-1">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Data do pagamento</label>
              <input type="date" className="input" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} />
            </div>
            {erro && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{erro}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setModalPagamento(false)} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700">
                Cancelar
              </button>
              <button
                type="button"
                disabled={processando}
                onClick={confirmarPagamento}
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
              >
                {processando ? "Confirmando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {apuracaoEmAjuste && (
        <AjusteBonificacaoModal
          apuracaoId={apuracaoEmAjuste.id}
          valorBonificacao={apuracaoEmAjuste.valorBonificacao}
          onFechar={() => setModalAjusteId(null)}
        />
      )}
    </div>
  );
}
