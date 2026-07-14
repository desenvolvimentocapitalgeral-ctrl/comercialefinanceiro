import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { VendaInfoTooltip } from "@/components/ui/VendaInfoTooltip";
import { parseDataLocal } from "@/lib/utils/data";
import { resolverVigenciaPorCiclo } from "@/lib/calculos/ciclo";

export default async function VendasPage({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string }> }) {
  const sessao = await auth();
  const { de, ate } = await searchParams;

  const dataDe = de ? parseDataLocal(de) : null;
  const dataAte = ate ? parseDataLocal(ate) : null;

  const vendas = await prisma.venda.findMany({
    where: {
      empresaId: sessao!.user.empresaId,
      // Filtro de período: pela DATA DA VENDA — mesma referência usada pela
      // "regra de ouro" do sistema para resolver contrato/regra vigente.
      // gte e lte precisam viver no MESMO objeto dataVenda — dois spreads
      // com a mesma chave fariam o segundo sobrescrever o primeiro.
      ...(dataDe || dataAte ? { dataVenda: { ...(dataDe ? { gte: dataDe } : {}), ...(dataAte ? { lte: dataAte } : {}) } } : {}),
    },
    orderBy: { dataVenda: "desc" },
    include: {
      cliente: true,
      produto: true,
      representante: true,
      contrato: { include: { regrasComissao: true } },
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Vendas</h1>
        <Link href="/vendas/nova" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
          Nova Venda
        </Link>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800" action="/vendas">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Data da venda de</label>
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
          <Link href="/vendas" className="text-sm text-neutral-500 underline">
            Limpar filtro
          </Link>
        )}
      </form>

      {vendas.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
          <p className="text-sm text-neutral-500">
            {de || ate ? "Nenhuma venda no período informado." : "Nenhuma venda lançada ainda."}
          </p>
          {!(de || ate) && (
            <Link href="/vendas/nova" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
              Lançar a primeira venda
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-100 dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Data</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Ciclo</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Cliente</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Produto</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Representante</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Valor</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Parcelas</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Origem</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Ações</th>
              </tr>
            </thead>
            <tbody>
              {vendas.map((v) => {
                const regraVigente = resolverVigenciaPorCiclo(v.contrato.regrasComissao, v.cicloId);

                return (
                  <tr key={v.id} className="border-t border-neutral-100 dark:border-neutral-800">
                    <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">
                      <VendaInfoTooltip
                        dados={{
                          numeroPedido: v.numeroPedido,
                          dataEntregaFisica: v.dataEntregaFisica ? v.dataEntregaFisica.toLocaleDateString("pt-BR") : null,
                          dosesVendidas: v.dosesVendidas,
                          descontoConcedidoPorDose: v.descontoConcedidoPorDose ? `R$ ${Number(v.descontoConcedidoPorDose).toFixed(2)}` : null,
                          origem: v.origem,
                          vendaAutorizadaExcepcionalmente: v.vendaAutorizadaExcepcionalmente,
                          motorComissao: regraVigente?.tipoCalculo ?? null,
                        }}
                      >
                        <span className="cursor-help border-b border-dotted border-neutral-400">{v.dataVenda.toLocaleDateString("pt-BR")}</span>
                      </VendaInfoTooltip>
                    </td>
                    <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">{v.cicloId}</td>
                    <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">{v.cliente.nomePadrao}</td>
                    <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">{v.produto.nomePadrao}</td>
                    <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">{v.representante.nome}</td>
                    <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">
                      {Number(v.valorTotal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                    <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">{v.quantidadeParcelas}x</td>
                    <td className="px-4 py-2">
                      <StatusBadge label={v.origem === "MANUAL" ? "Manual" : "Importação"} cor={v.origem === "MANUAL" ? "azul" : "neutro"} />
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <Link href={`/vendas/${v.id}`} className="text-neutral-600 underline hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
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
