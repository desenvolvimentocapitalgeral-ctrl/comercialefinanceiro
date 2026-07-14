import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { ComissoesTable, type ApuracaoLinha } from "@/components/tabelas/ComissoesTable";

export default async function ComissoesPage() {
  const sessao = await auth();

  const apuracoes = await prisma.apuracaoComissao.findMany({
    where: { parcela: { venda: { empresaId: sessao!.user.empresaId } } },
    orderBy: { calculadoEm: "desc" },
    include: { parcela: { include: { venda: { include: { cliente: true, produto: true, representante: true } } } } },
  });

  const linhas: ApuracaoLinha[] = apuracoes.map((a) => ({
    id: a.id,
    representanteId: a.representanteId,
    representanteNome: a.parcela.venda.representante.nome,
    clienteProduto: `${a.parcela.venda.cliente.nomePadrao} / ${a.parcela.venda.produto.nomePadrao}`,
    cicloId: a.cicloId,
    valorBase: Number(a.valorBase),
    percentualAplicado: Number(a.percentualAplicado),
    valorComissao: Number(a.valorComissao),
    status: a.status,
    motivoBloqueio: a.motivoBloqueio,
  }));

  const totalPendente = apuracoes
    .filter((a) => a.status === "PENDENTE" || a.status === "APROVADA")
    .reduce((acc, a) => acc + Number(a.valorComissao), 0);
  const totalPago = apuracoes.filter((a) => a.status === "PAGA").reduce((acc, a) => acc + Number(a.valorComissao), 0);
  const totalBloqueadas = apuracoes.filter((a) => a.status === "BLOQUEADA_DADO_MANUAL_FALTANTE").length;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Comissões</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-xs text-neutral-500">Pendente + aprovada</p>
          <p className="numerico text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {totalPendente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-xs text-neutral-500">Já paga</p>
          <p className="numerico text-lg font-semibold text-emerald-600">
            {totalPago.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-xs text-neutral-500">Bloqueadas (dado manual faltante)</p>
          <p className="numerico text-lg font-semibold text-red-600">{totalBloqueadas}</p>
        </div>
      </div>

      {linhas.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
          <p className="text-sm text-neutral-500">
            Nenhuma comissão apurada ainda — apurações são geradas automaticamente ao registrar um recebimento em
            Contas a Receber.
          </p>
        </div>
      ) : (
        <ComissoesTable apuracoes={linhas} />
      )}
    </div>
  );
}
