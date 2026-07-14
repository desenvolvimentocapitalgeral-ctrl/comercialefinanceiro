import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { ParcelasTable, type ParcelaLinha } from "@/components/tabelas/ParcelasTable";

export default async function ContasAReceberPage() {
  const sessao = await auth();

  const parcelas = await prisma.parcela.findMany({
    where: { venda: { empresaId: sessao!.user.empresaId } },
    orderBy: { dataVencimento: "asc" },
    include: { venda: { include: { cliente: true, representante: true } }, baixas: true },
  });

  const linhas: ParcelaLinha[] = parcelas.map((p) => {
    const jaRecebido = p.baixas.reduce((acc, b) => acc + Number(b.valorRecebido), 0);
    return {
      id: p.id,
      cliente: p.venda.cliente.nomePadrao,
      representante: p.venda.representante.nome,
      numeroParcela: p.numeroParcela,
      quantidadeParcelas: p.venda.quantidadeParcelas,
      valorParcela: Number(p.valorParcela),
      saldoEmAberto: Number(p.valorParcela) - jaRecebido,
      dataVencimento: p.dataVencimento.toLocaleDateString("pt-BR"),
      status: p.status,
    };
  });

  const totalVencidoNaoRecebido = parcelas
    .filter((p) => (p.status === "PENDENTE" || p.status === "RECEBIDA_PARCIAL") && p.dataVencimento < new Date())
    .reduce((acc, p) => {
      const jaRecebido = p.baixas.reduce((a, b) => a + Number(b.valorRecebido), 0);
      return acc + (Number(p.valorParcela) - jaRecebido);
    }, 0);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Contas a Receber</h1>

      <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <p className="text-xs text-neutral-500">Total vencido e não recebido</p>
        <p className="numerico text-lg font-semibold text-red-600">
          {totalVencidoNaoRecebido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </p>
      </div>

      <ParcelasTable parcelas={linhas} />
    </div>
  );
}
