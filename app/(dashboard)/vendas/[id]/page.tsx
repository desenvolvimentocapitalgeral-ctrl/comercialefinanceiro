import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { StatusBadge } from "@/components/ui/StatusBadge";

const STATUS_PARCELA: Record<string, { label: string; cor: "verde" | "ambar" | "vermelho" | "neutro" }> = {
  PENDENTE: { label: "Pendente", cor: "ambar" },
  RECEBIDA: { label: "Recebida", cor: "verde" },
  RECEBIDA_PARCIAL: { label: "Recebida parcial", cor: "ambar" },
  CANCELADA: { label: "Cancelada", cor: "neutro" },
  RENEGOCIADA: { label: "Renegociada", cor: "neutro" },
};

export default async function DetalheVendaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const venda = await prisma.venda.findUnique({
    where: { id },
    include: {
      cliente: true,
      produto: true,
      representante: true,
      contrato: { include: { regrasComissao: { orderBy: { vigenciaCicloInicio: "desc" }, take: 1 } } },
      parcelas: { orderBy: { numeroParcela: "asc" } },
    },
  });

  if (!venda) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          Venda — {venda.cliente.nomePadrao}
        </h1>
        <Link href="/vendas" className="text-sm text-neutral-500 underline">
          Voltar
        </Link>
      </div>

      <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">Dados gerais</h2>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-neutral-500">Produto</dt>
          <dd>{venda.produto.nomePadrao}</dd>
          <dt className="text-neutral-500">Representante</dt>
          <dd>{venda.representante.nome}</dd>
          <dt className="text-neutral-500">Data da venda</dt>
          <dd className="numerico">{venda.dataVenda.toLocaleDateString("pt-BR")}</dd>
          <dt className="text-neutral-500">Ciclo</dt>
          <dd className="numerico">{venda.cicloId}</dd>
          <dt className="text-neutral-500">Valor total</dt>
          <dd className="numerico">{Number(venda.valorTotal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</dd>
          <dt className="text-neutral-500">Contrato (regra aplicada)</dt>
          <dd>{venda.contrato.regrasComissao[0]?.tipoCalculo ?? "—"}</dd>
          <dt className="text-neutral-500">Doses vendidas</dt>
          <dd className="numerico">{venda.dosesVendidas ?? "Não informado"}</dd>
          <dt className="text-neutral-500">Desconto concedido/dose</dt>
          <dd className="numerico">{venda.descontoConcedidoPorDose ? `R$ ${venda.descontoConcedidoPorDose}` : "Não informado"}</dd>
          <dt className="text-neutral-500">Origem</dt>
          <dd>
            <StatusBadge label={venda.origem === "MANUAL" ? "Manual" : "Importação"} cor={venda.origem === "MANUAL" ? "azul" : "neutro"} />
          </dd>
        </dl>
      </section>

      <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">Parcelas</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-neutral-500">
              <th className="py-1 pr-4">Nº</th>
              <th className="py-1 pr-4">Valor</th>
              <th className="py-1 pr-4">Vencimento</th>
              <th className="py-1 pr-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {venda.parcelas.map((p) => (
              <tr key={p.id} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className="py-1 pr-4 numerico">{p.numeroParcela}</td>
                <td className="py-1 pr-4 numerico">{Number(p.valorParcela).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                <td className="py-1 pr-4 numerico">{p.dataVencimento.toLocaleDateString("pt-BR")}</td>
                <td className="py-1 pr-4">
                  <StatusBadge label={STATUS_PARCELA[p.status].label} cor={STATUS_PARCELA[p.status].cor} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
