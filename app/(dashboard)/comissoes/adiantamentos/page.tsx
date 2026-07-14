import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { AdiantamentosTable, type AdiantamentoLinha } from "@/components/tabelas/AdiantamentosTable";

export default async function AdiantamentosPage() {
  const sessao = await auth();

  const adiantamentos = await prisma.pagamento.findMany({
    where: { tipo: "ADIANTAMENTO", representante: { empresaId: sessao!.user.empresaId } },
    include: { representante: true, compensacoesComoAdiantamento: true },
    orderBy: { dataPagamento: "desc" },
  });

  const representantes = await prisma.representante.findMany({
    where: { empresaId: sessao!.user.empresaId, ativo: true },
    orderBy: { nome: "asc" },
  });

  const linhas: AdiantamentoLinha[] = adiantamentos.map((a) => {
    const valorCompensado = a.compensacoesComoAdiantamento.reduce((acc, c) => acc + Number(c.valorCompensado), 0);
    return {
      id: a.id,
      representanteNome: a.representante.nome,
      dataPagamento: a.dataPagamento.toLocaleDateString("pt-BR"),
      valorTotal: Number(a.valorTotal),
      valorCompensado,
      saldoEmAberto: Number(a.valorTotal) - valorCompensado,
    };
  });

  const saldoTotalEmAberto = linhas.reduce((acc, l) => acc + l.saldoEmAberto, 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Adiantamentos</h1>
        <p className="text-sm text-neutral-500">
          Pagamento antecipado ao representante, sem apuração vinculada — a compensação com pagamentos futuros é
          sempre uma escolha explícita do financeiro, nunca automática.
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <p className="text-xs text-neutral-500">Saldo total em aberto</p>
        <p className="numerico text-lg font-semibold text-amber-600">
          {saldoTotalEmAberto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </p>
      </div>

      <AdiantamentosTable adiantamentos={linhas} representantes={representantes.map((r) => ({ id: r.id, nome: r.nome }))} />
    </div>
  );
}
