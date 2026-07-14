"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { aprovarApuracoes, gerarPagamento, buscarSaldosAdiantamento } from "@/app/(dashboard)/comissoes/actions";
import { EstornoComissaoModal } from "@/components/formularios/EstornoComissaoModal";
import type { SaldoAdiantamento, CompensacaoSolicitada } from "@/lib/servicos/adiantamento";

/** Distribui o valor desejado entre os adiantamentos mais antigos primeiro, nunca excedendo o saldo de cada um. */
function distribuirCompensacao(saldos: SaldoAdiantamento[], valorDesejado: number): CompensacaoSolicitada[] {
  let restante = valorDesejado;
  const compensacoes: CompensacaoSolicitada[] = [];
  for (const saldo of saldos) {
    if (restante <= 0) break;
    const valor = Math.min(saldo.saldoEmAberto, restante);
    if (valor > 0) {
      compensacoes.push({ adiantamentoId: saldo.id, valor });
      restante -= valor;
    }
  }
  return compensacoes;
}

const STATUS_LABEL: Record<string, { label: string; cor: "verde" | "ambar" | "vermelho" | "neutro" | "azul" }> = {
  PENDENTE: { label: "Pendente", cor: "ambar" },
  APROVADA: { label: "Aprovada", cor: "azul" },
  PAGA: { label: "Paga", cor: "verde" },
  CANCELADA: { label: "Cancelada", cor: "neutro" },
  BLOQUEADA_DADO_MANUAL_FALTANTE: { label: "Bloqueada", cor: "vermelho" },
};

const MOTIVO_LABEL: Record<string, string> = {
  DESCONTO_CONCEDIDO_NAO_INFORMADO: "Desconto concedido por dose não informado na venda",
  SEM_TABELA_COMISSAO: "Contrato sem política/tabela de comissão vinculada",
  TABELA_DESCONTO_VAZIA: "Tabela de desconto configurada, mas sem faixas cadastradas",
  SEM_REGRA_VIGENTE_PARA_O_CICLO: "Nenhuma regra de comissão vigente para o ciclo da venda",
};

export interface ApuracaoLinha {
  id: string;
  representanteId: string;
  representanteNome: string;
  clienteProduto: string;
  cicloId: string;
  valorBase: number;
  percentualAplicado: number;
  valorComissao: number;
  status: string;
  motivoBloqueio: string | null;
}

export function ComissoesTable({ apuracoes }: { apuracoes: ApuracaoLinha[] }) {
  const router = useRouter();
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [modalPagamento, setModalPagamento] = useState(false);
  const [dataPagamento, setDataPagamento] = useState("");
  const [modalEstornoId, setModalEstornoId] = useState<string | null>(null);
  const apuracaoEmEstorno = apuracoes.find((a) => a.id === modalEstornoId);
  const [saldosAdiantamento, setSaldosAdiantamento] = useState<SaldoAdiantamento[]>([]);
  const [valorCompensarAdiantamento, setValorCompensarAdiantamento] = useState(0);

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

  async function aprovarSelecionadas() {
    setErro(null);
    setProcessando(true);
    const resultado = await aprovarApuracoes([...selecionadas]);
    setProcessando(false);
    if (!resultado.sucesso) {
      setErro(resultado.erro);
      return;
    }
    setSelecionadas(new Set());
    router.refresh();
  }

  async function abrirModalPagamento() {
    setModalPagamento(true);
    setValorCompensarAdiantamento(0);
    if (linhasSelecionadas.length > 0) {
      const saldos = await buscarSaldosAdiantamento(linhasSelecionadas[0].representanteId);
      setSaldosAdiantamento(saldos);
    }
  }

  async function confirmarPagamento() {
    setErro(null);
    if (!dataPagamento) {
      setErro("Informe a data do pagamento.");
      return;
    }
    setProcessando(true);
    const compensacoesAdiantamento = distribuirCompensacao(saldosAdiantamento, valorCompensarAdiantamento);
    const resultado = await gerarPagamento([...selecionadas], dataPagamento, compensacoesAdiantamento);
    setProcessando(false);
    if (!resultado.sucesso) {
      setErro(resultado.erro);
      return;
    }
    setModalPagamento(false);
    setDataPagamento("");
    setValorCompensarAdiantamento(0);
    setSelecionadas(new Set());
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
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
          onClick={abrirModalPagamento}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
        >
          Gerar pagamento
        </button>
        {representantesDistintos > 1 && (
          <span className="text-xs text-red-600">Não é possível pagar apurações de representantes diferentes juntas.</span>
        )}
      </div>

      {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{erro}</p>}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-100 dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-2"></th>
              <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Representante</th>
              <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Cliente / Produto</th>
              <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Ciclo</th>
              <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Valor base</th>
              <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">%</th>
              <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Comissão</th>
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
                    {selecionavel && (
                      <input type="checkbox" checked={selecionadas.has(a.id)} onChange={() => alternarSelecao(a.id)} />
                    )}
                  </td>
                  <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">{a.representanteNome}</td>
                  <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">{a.clienteProduto}</td>
                  <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">{a.cicloId}</td>
                  <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">
                    {a.valorBase.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">{a.percentualAplicado}%</td>
                  <td className="px-4 py-2 numerico font-medium text-neutral-900 dark:text-neutral-100">
                    {a.valorComissao.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge label={STATUS_LABEL[a.status].label} cor={STATUS_LABEL[a.status].cor} />
                    {a.motivoBloqueio && <p className="mt-1 text-xs text-neutral-500">{MOTIVO_LABEL[a.motivoBloqueio] ?? a.motivoBloqueio}</p>}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {a.status === "PAGA" ? (
                      <button
                        type="button"
                        onClick={() => setModalEstornoId(a.id)}
                        className="text-red-600 underline hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Estornar
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

      {modalPagamento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg dark:bg-neutral-900">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Gerar pagamento</h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              {linhasSelecionadas.length} apuração(ões), totalizando{" "}
              {linhasSelecionadas.reduce((acc, a) => acc + a.valorComissao, 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>

            <div className="mt-3 flex flex-col gap-1">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Data do pagamento</label>
              <input type="date" className="input" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} />
            </div>

            {saldosAdiantamento.length > 0 && (
              <div className="mt-3 flex flex-col gap-1">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                  Compensar adiantamento (saldo disponível:{" "}
                  {saldosAdiantamento.reduce((acc, s) => acc + s.saldoEmAberto, 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  )
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={valorCompensarAdiantamento}
                  onChange={(e) => setValorCompensarAdiantamento(Number(e.target.value))}
                />
                <p className="text-xs text-neutral-500">Ação explícita — nunca compensado automaticamente.</p>
              </div>
            )}

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

      {apuracaoEmEstorno && (
        <EstornoComissaoModal
          apuracaoId={apuracaoEmEstorno.id}
          valorComissao={apuracaoEmEstorno.valorComissao}
          onFechar={() => setModalEstornoId(null)}
        />
      )}
    </div>
  );
}
