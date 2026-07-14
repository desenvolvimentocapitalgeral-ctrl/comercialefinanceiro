import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ContratoInfoTooltip } from "@/components/ui/ContratoInfoTooltip";
import { parseDataLocal } from "@/lib/utils/data";

const STATUS_LABEL: Record<string, { label: string; cor: "verde" | "ambar" | "vermelho" | "neutro" }> = {
  ATIVO: { label: "Ativo", cor: "verde" },
  ENCERRADO: { label: "Encerrado", cor: "neutro" },
  RESCISAO_PENDENTE_FORMALIZACAO: { label: "Rescisão pendente", cor: "ambar" },
  SEM_TABELA_COMISSAO: { label: "Sem tabela de comissão", cor: "vermelho" },
};

/** Nomeia o tipo de contrato a partir das regras vigentes — nunca só "motor". */
function tipoContrato(temComissao: boolean, temBonificacao: boolean): { label: string; cor: "verde" | "ambar" | "vermelho" | "neutro" | "azul" } {
  if (temComissao && temBonificacao) return { label: "Comissão + Bonificação", cor: "azul" };
  if (temComissao) return { label: "Só comissão", cor: "neutro" };
  if (temBonificacao) return { label: "Só bonificação", cor: "neutro" };
  return { label: "Sem regra vigente", cor: "vermelho" };
}

export default async function ContratosPage({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string }> }) {
  const sessao = await auth();
  const { de, ate } = await searchParams;

  const dataDe = de ? parseDataLocal(de) : null;
  const dataAte = ate ? parseDataLocal(ate) : null;

  const contratos = await prisma.contrato.findMany({
    where: {
      representante: { empresaId: sessao!.user.empresaId },
      // Filtro de período: traz contratos cuja vigência se sobrepõe ao
      // intervalo informado — inclui contratos ainda vigentes (vigenciaFim null).
      ...(dataDe ? { OR: [{ vigenciaFim: null }, { vigenciaFim: { gte: dataDe } }] } : {}),
      ...(dataAte ? { vigenciaInicio: { lte: dataAte } } : {}),
    },
    orderBy: { vigenciaInicio: "desc" },
    include: {
      representante: { select: { nome: true } },
      regrasComissao: { orderBy: { vigenciaCicloInicio: "desc" }, take: 1 },
      regrasBonificacao: { orderBy: { vigenciaCicloInicio: "desc" }, take: 1 },
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Contratos</h1>
        <Link href="/contratos/novo" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
          Novo Contrato
        </Link>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800" action="/contratos">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Vigência de</label>
          <input type="date" name="de" defaultValue={de ?? ""} className="input" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300">até</label>
          <input type="date" name="ate" defaultValue={ate ?? ""} className="input" />
        </div>
        <button type="submit" className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
          Filtrar
        </button>
        {(de || ate) && (
          <Link href="/contratos" className="text-sm text-neutral-500 underline">
            Limpar filtro
          </Link>
        )}
      </form>

      {contratos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
          <p className="text-sm text-neutral-500">
            {de || ate ? "Nenhum contrato vigente no período informado." : "Nenhum contrato cadastrado ainda."}
          </p>
          {!(de || ate) && (
            <Link href="/contratos/novo" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
              Cadastrar o primeiro contrato
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-100 dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Representante</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Vigência</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Tipo de contrato</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Motor comissão</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Status</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Ações</th>
              </tr>
            </thead>
            <tbody>
              {contratos.map((c) => {
                const regraComissao = c.regrasComissao[0];
                const regraBonificacao = c.regrasBonificacao[0];
                const tipo = tipoContrato(Boolean(regraComissao), Boolean(regraBonificacao));

                return (
                  <tr key={c.id} className="border-t border-neutral-100 dark:border-neutral-800">
                    <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">
                      <ContratoInfoTooltip
                        dados={{
                          numero: c.numero,
                          vigenciaInicio: c.vigenciaInicio.toLocaleDateString("pt-BR"),
                          vigenciaFim: c.vigenciaFim ? c.vigenciaFim.toLocaleDateString("pt-BR") : null,
                          statusAssinatura: c.statusAssinatura,
                          motorComissao: regraComissao?.tipoCalculo ?? null,
                          percentualComissao: regraComissao?.percentual ? `${regraComissao.percentual}%` : null,
                          motorBonificacao: regraBonificacao?.tipoCalculo ?? null,
                          metaBonificacao:
                            regraBonificacao?.metaQuantidadeDoses != null
                              ? `${regraBonificacao.metaQuantidadeDoses} doses`
                              : regraBonificacao?.metaValorFaturamento
                                ? `R$ ${Number(regraBonificacao.metaValorFaturamento).toLocaleString("pt-BR")}`
                                : null,
                          bonusFixoValor: regraBonificacao?.bonusFixoValor
                            ? `R$ ${Number(regraBonificacao.bonusFixoValor).toLocaleString("pt-BR")}`
                            : null,
                        }}
                      >
                        <span className="cursor-help border-b border-dotted border-neutral-400">{c.representante.nome}</span>
                      </ContratoInfoTooltip>
                    </td>
                    <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">
                      {c.vigenciaInicio.toLocaleDateString("pt-BR")} – {c.vigenciaFim ? c.vigenciaFim.toLocaleDateString("pt-BR") : "atual"}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge label={tipo.label} cor={tipo.cor} />
                    </td>
                    <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">{regraComissao?.tipoCalculo ?? "—"}</td>
                    <td className="px-4 py-2">
                      <StatusBadge label={STATUS_LABEL[c.status].label} cor={STATUS_LABEL[c.status].cor} />
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <Link href={`/contratos/${c.id}`} className="text-neutral-600 underline hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
                        Ver
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
