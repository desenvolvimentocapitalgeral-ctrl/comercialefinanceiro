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
  BLOQUEADA_DADO_MANUAL_FALTANTE: { label: "Bloqueada", cor: "vermelho" },
};

export default async function RelatorioComissoesPage() {
  const sessao = await auth();

  const apuracoes = await prisma.apuracaoComissao.findMany({
    where: { parcela: { venda: { empresaId: sessao!.user.empresaId } } },
    orderBy: [{ cicloId: "desc" }, { calculadoEm: "desc" }],
    include: { parcela: { include: { venda: { include: { cliente: true, produto: true, representante: true } } } } },
  });

  const linhas = apuracoes.map((a) => ({
    representante: a.parcela.venda.representante.nome,
    cliente: a.parcela.venda.cliente.nomePadrao,
    produto: a.parcela.venda.produto.nomePadrao,
    ciclo: a.cicloId,
    valorBase: Number(a.valorBase).toFixed(2),
    percentual: Number(a.percentualAplicado).toString(),
    valorComissao: Number(a.valorComissao).toFixed(2),
    status: a.status,
  }));

  const colunas = [
    { chave: "representante" as const, titulo: "Representante" },
    { chave: "cliente" as const, titulo: "Cliente" },
    { chave: "produto" as const, titulo: "Produto" },
    { chave: "ciclo" as const, titulo: "Ciclo" },
    { chave: "valorBase" as const, titulo: "Valor Base (R$)" },
    { chave: "percentual" as const, titulo: "Percentual (%)" },
    { chave: "valorComissao" as const, titulo: "Comissão (R$)" },
    { chave: "status" as const, titulo: "Status" },
  ];
  const csv = paraCsv(linhas, colunas);
  const totalComissao = apuracoes.reduce((acc, a) => acc + Number(a.valorComissao), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Comissão por Representante e Ciclo</h1>
        <ExportarCsvButton csv={csv} nomeArquivo="comissoes.csv" />
      </div>

      {linhas.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhuma apuração de comissão registrada ainda.</p>
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
                  <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">{l.cliente}</td>
                  <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">{l.produto}</td>
                  <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">{l.ciclo}</td>
                  <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">
                    {Number(l.valorBase).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">{l.percentual}%</td>
                  <td className="px-4 py-2 numerico font-medium text-neutral-900 dark:text-neutral-100">
                    {Number(l.valorComissao).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
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
                <td className="px-4 py-2 numerico">{totalComissao.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                <td className="px-4 py-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
