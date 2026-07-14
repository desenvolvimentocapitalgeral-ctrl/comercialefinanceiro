import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default async function DetalheContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const contrato = await prisma.contrato.findUnique({
    where: { id },
    include: {
      representante: true,
      regrasComissao: { orderBy: { vigenciaCicloInicio: "desc" } },
      regrasBonificacao: { orderBy: { vigenciaCicloInicio: "desc" } },
    },
  });

  if (!contrato) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          Contrato — {contrato.representante.nome}
        </h1>
        <Link href="/contratos" className="text-sm text-neutral-500 underline">
          Voltar
        </Link>
      </div>

      <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">Dados gerais</h2>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-neutral-500">Número</dt>
          <dd className="numerico">{contrato.numero ?? "—"}</dd>
          <dt className="text-neutral-500">Vigência</dt>
          <dd className="numerico">
            {contrato.vigenciaInicio.toLocaleDateString("pt-BR")} –{" "}
            {contrato.vigenciaFim ? contrato.vigenciaFim.toLocaleDateString("pt-BR") : "atual"}
          </dd>
          <dt className="text-neutral-500">Status</dt>
          <dd>
            <StatusBadge label={contrato.status} cor={contrato.status === "ATIVO" ? "verde" : "neutro"} />
          </dd>
          <dt className="text-neutral-500">Status de assinatura</dt>
          <dd>{contrato.statusAssinatura}</dd>
        </dl>
      </section>

      <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">Regras de comissão (histórico)</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-neutral-500">
              <th className="py-1 pr-4">Vigente a partir do ciclo</th>
              <th className="py-1 pr-4">Motor</th>
              <th className="py-1 pr-4">Percentual</th>
              <th className="py-1 pr-4">Momento</th>
              <th className="py-1 pr-4">Aplica sobre</th>
            </tr>
          </thead>
          <tbody>
            {contrato.regrasComissao.map((r) => (
              <tr key={r.id} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="py-1 pr-4 numerico">{r.vigenciaCicloInicio}</td>
                <td className="py-1 pr-4">{r.tipoCalculo}</td>
                <td className="py-1 pr-4 numerico">{r.percentual ? `${r.percentual}%` : "—"}</td>
                <td className="py-1 pr-4">{r.momentoApuracao}</td>
                <td className="py-1 pr-4">{r.aplicaSobre ?? "Todos os produtos"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {contrato.regrasBonificacao.length > 0 && (
        <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">Regras de bonificação (histórico)</h2>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-neutral-500">
                <th className="py-1 pr-4">Vigente a partir do ciclo</th>
                <th className="py-1 pr-4">Motor</th>
                <th className="py-1 pr-4">Meta</th>
                <th className="py-1 pr-4">Bônus fixo</th>
                <th className="py-1 pr-4">% sem meta</th>
                <th className="py-1 pr-4">% excedente</th>
              </tr>
            </thead>
            <tbody>
              {contrato.regrasBonificacao.map((r) => (
                <tr key={r.id} className="border-t border-neutral-100 dark:border-neutral-800">
                  <td className="py-1 pr-4 numerico">{r.vigenciaCicloInicio}</td>
                  <td className="py-1 pr-4">{r.tipoCalculo}</td>
                  <td className="py-1 pr-4 numerico">
                    {r.tipoMeta === "QUANTIDADE_DOSES" ? `${r.metaQuantidadeDoses} doses` : `R$ ${r.metaValorFaturamento}`}
                  </td>
                  <td className="py-1 pr-4 numerico">R$ {r.bonusFixoValor.toString()}</td>
                  <td className="py-1 pr-4 numerico">{r.percentualSemMeta.toString()}%</td>
                  <td className="py-1 pr-4 numerico">{r.percentualExcedente ? `${r.percentualExcedente}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
