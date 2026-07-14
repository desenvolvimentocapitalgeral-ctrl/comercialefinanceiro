import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { paraCsv } from "@/lib/utils/csv";
import { ExportarCsvButton } from "@/components/ui/ExportarCsvButton";
import { StatusBadge } from "@/components/ui/StatusBadge";

const STATUS_LABEL: Record<string, { label: string; cor: "verde" | "ambar" | "vermelho" | "neutro" | "azul" }> = {
  PENDENTE: { label: "Pendente", cor: "ambar" },
  APROVADA: { label: "Aprovada", cor: "azul" },
  PAGA: { label: "Paga", cor: "verde" },
  CANCELADA: { label: "Cancelada", cor: "neutro" },
};

export default async function RelatorioBonificacoesPage() {
  const sessao = await auth();

  const [apuracoes, representantes] = await Promise.all([
    prisma.apuracaoBonificacao.findMany({
      where: { regraBonificacao: { contrato: { representante: { empresaId: sessao!.user.empresaId } } } },
      orderBy: [{ cicloId: "desc" }, { calculadoEm: "desc" }],
    }),
    prisma.representante.findMany({ where: { empresaId: sessao!.user.empresaId }, select: { id: true, nome: true } }),
  ]);
  const nomeRepresentante = new Map(representantes.map((r) => [r.id, r.nome]));

  const linhas = apuracoes.map((a) => ({
    representante: nomeRepresentante.get(a.representanteId) ?? "—",
    ciclo: a.cicloId,
    meta: a.dosesApuradas !== null ? `${a.metaValor} doses` : Number(a.metaValor).toFixed(2),
    apurado: a.dosesApuradas !== null ? `${a.dosesApuradas} doses` : Number(a.valorApurado).toFixed(2),
    atingimento: Number(a.percentualAtingimento).toString(),
    bateuMeta: a.bateuMeta ? "Sim" : "Não",
    valorBonificacao: Number(a.valorBonificacao).toFixed(2),
    status: a.status,
  }));

  const colunas = [
    { chave: "representante" as const, titulo: "Representante" },
    { chave: "ciclo" as const, titulo: "Ciclo" },
    { chave: "meta" as const, titulo: "Meta" },
    { chave: "apurado" as const, titulo: "Apurado" },
    { chave: "atingimento" as const, titulo: "Atingimento (%)" },
    { chave: "bateuMeta" as const, titulo: "Bateu meta?" },
    { chave: "valorBonificacao" as const, titulo: "Bonificação (R$)" },
    { chave: "status" as const, titulo: "Status" },
  ];
  const csv = paraCsv(linhas, colunas);
  const totalBonificacao = apuracoes.reduce((acc, a) => acc + Number(a.valorBonificacao), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Bonificação por Representante e Ciclo</h1>
        <ExportarCsvButton csv={csv} nomeArquivo="bonificacoes.csv" />
      </div>

      {linhas.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhuma apuração de bonificação registrada ainda.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-100 dark:bg-neutral-900">
              <tr>
                {colunas.map((c) => (
                  <th key={c.chave} className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">
                    {c.titulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={i} className="border-t border-neutral-100 dark:border-neutral-800">
                  <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">{l.representante}</td>
                  <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">{l.ciclo}</td>
                  <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">{l.meta}</td>
                  <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">{l.apurado}</td>
                  <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">{l.atingimento}%</td>
                  <td className="px-4 py-2">
                    <StatusBadge label={l.bateuMeta} cor={l.bateuMeta === "Sim" ? "verde" : "ambar"} />
                  </td>
                  <td className="px-4 py-2 numerico font-medium text-neutral-900 dark:text-neutral-100">
                    {Number(l.valorBonificacao).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge label={STATUS_LABEL[l.status].label} cor={STATUS_LABEL[l.status].cor} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-neutral-100 dark:bg-neutral-900">
              <tr className="border-t border-neutral-300 font-semibold dark:border-neutral-700">
                <td className="px-4 py-2" colSpan={6}>
                  Total (respeitando os filtros acima)
                </td>
                <td className="px-4 py-2 numerico">{totalBonificacao.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                <td className="px-4 py-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
