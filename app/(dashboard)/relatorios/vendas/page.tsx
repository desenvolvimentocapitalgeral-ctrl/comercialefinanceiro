import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { paraCsv } from "@/lib/utils/csv";
import { ExportarCsvButton } from "@/components/ui/ExportarCsvButton";

export default async function RelatorioVendasPage() {
  const sessao = await auth();

  const vendas = await prisma.venda.findMany({
    where: { empresaId: sessao!.user.empresaId },
    include: { cliente: true, produto: true },
  });

  const porCliente = new Map<string, number>();
  const porProduto = new Map<string, number>();
  for (const v of vendas) {
    porCliente.set(v.cliente.nomePadrao, (porCliente.get(v.cliente.nomePadrao) ?? 0) + Number(v.valorTotal));
    porProduto.set(v.produto.nomePadrao, (porProduto.get(v.produto.nomePadrao) ?? 0) + Number(v.valorTotal));
  }

  const linhasCliente = [...porCliente.entries()]
    .map(([cliente, total]) => ({ cliente, total: total.toFixed(2) }))
    .sort((a, b) => Number(b.total) - Number(a.total));
  const linhasProduto = [...porProduto.entries()]
    .map(([produto, total]) => ({ produto, total: total.toFixed(2) }))
    .sort((a, b) => Number(b.total) - Number(a.total));

  const csvCliente = paraCsv(linhasCliente, [
    { chave: "cliente", titulo: "Cliente" },
    { chave: "total", titulo: "Total Faturado (R$)" },
  ]);
  const csvProduto = paraCsv(linhasProduto, [
    { chave: "produto", titulo: "Produto" },
    { chave: "total", titulo: "Total Faturado (R$)" },
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Faturamento por Cliente e Produto</h1>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Por cliente</h2>
          <ExportarCsvButton csv={csvCliente} nomeArquivo="faturamento-por-cliente.csv" />
        </div>
        {linhasCliente.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhuma venda lançada ainda.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-100 dark:bg-neutral-900">
                <tr>
                  <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Cliente</th>
                  <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Total Faturado</th>
                </tr>
              </thead>
              <tbody>
                {linhasCliente.map((l) => (
                  <tr key={l.cliente} className="border-t border-neutral-100 dark:border-neutral-800">
                    <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">{l.cliente}</td>
                    <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">
                      {Number(l.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Por produto</h2>
          <ExportarCsvButton csv={csvProduto} nomeArquivo="faturamento-por-produto.csv" />
        </div>
        {linhasProduto.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhuma venda lançada ainda.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-100 dark:bg-neutral-900">
                <tr>
                  <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Produto</th>
                  <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Total Faturado</th>
                </tr>
              </thead>
              <tbody>
                {linhasProduto.map((l) => (
                  <tr key={l.produto} className="border-t border-neutral-100 dark:border-neutral-800">
                    <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">{l.produto}</td>
                    <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">
                      {Number(l.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
