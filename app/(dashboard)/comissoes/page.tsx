import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { StatusBadge } from "@/components/ui/StatusBadge";

const STATUS_LABEL: Record<string, { label: string; cor: "verde" | "ambar" | "vermelho" | "neutro" | "azul" }> = {
  PENDENTE: { label: "Pendente", cor: "ambar" },
  APROVADA: { label: "Aprovada", cor: "azul" },
  PAGA: { label: "Paga", cor: "verde" },
  CANCELADA: { label: "Cancelada", cor: "neutro" },
  BLOQUEADA_DADO_MANUAL_FALTANTE: { label: "Bloqueada", cor: "vermelho" },
};

const MOTIVO_LABEL: Record<string, string> = {
  DESCONTO_CONCEDIDO_NAO_INFORMADO: "Desconto concedido por dose não informado na venda",
  SEM_TABELA_COMISSAO: "Contrato sem política/tabela de comissão vinculada",
  TABELA_DESCONTO_VAZIA: "Tabela de desconto configurada, mas sem faixas cadastradas",
  SEM_REGRA_VIGENTE_PARA_O_CICLO: "Nenhuma regra de comissão vigente para o ciclo da venda",
};

export default async function ComissoesPage() {
  const sessao = await auth();

  const apuracoes = await prisma.apuracaoComissao.findMany({
    where: { parcela: { venda: { empresaId: sessao!.user.empresaId } } },
    orderBy: { calculadoEm: "desc" },
    include: { parcela: { include: { venda: { include: { cliente: true, produto: true, representante: true } } } } },
  });

  const totalPendente = apuracoes
    .filter((a) => a.status === "PENDENTE" || a.status === "APROVADA")
    .reduce((acc, a) => acc + Number(a.valorComissao), 0);
  const totalBloqueadas = apuracoes.filter((a) => a.status === "BLOQUEADA_DADO_MANUAL_FALTANTE").length;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Comissões</h1>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-xs text-neutral-500">Comissão pendente + aprovada</p>
          <p className="numerico text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {totalPendente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-xs text-neutral-500">Apurações bloqueadas (dado manual faltante)</p>
          <p className="numerico text-lg font-semibold text-red-600">{totalBloqueadas}</p>
        </div>
      </div>

      {apuracoes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
          <p className="text-sm text-neutral-500">
            Nenhuma comissão apurada ainda — apurações são geradas automaticamente ao registrar um recebimento em
            Contas a Receber.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-100 dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Representante</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Cliente / Produto</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Ciclo</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Valor base</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">%</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Comissão</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Status</th>
              </tr>
            </thead>
            <tbody>
              {apuracoes.map((a) => (
                <tr key={a.id} className="border-t border-neutral-100 dark:border-neutral-800">
                  <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">{a.parcela.venda.representante.nome}</td>
                  <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">
                    {a.parcela.venda.cliente.nomePadrao} / {a.parcela.venda.produto.nomePadrao}
                  </td>
                  <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">{a.cicloId}</td>
                  <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">
                    {Number(a.valorBase).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">{Number(a.percentualAplicado)}%</td>
                  <td className="px-4 py-2 numerico font-medium text-neutral-900 dark:text-neutral-100">
                    {Number(a.valorComissao).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge label={STATUS_LABEL[a.status].label} cor={STATUS_LABEL[a.status].cor} />
                    {a.motivoBloqueio && (
                      <p className="mt-1 text-xs text-neutral-500">{MOTIVO_LABEL[a.motivoBloqueio] ?? a.motivoBloqueio}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
