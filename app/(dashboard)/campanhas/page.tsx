import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default async function CampanhasPage() {
  const sessao = await auth();

  const campanhas = await prisma.campanha.findMany({
    where: { empresaId: sessao!.user.empresaId },
    orderBy: { dataInicio: "desc" },
  });

  const produtoIds = campanhas.map((c) => c.produtoIdAlvo).filter((id): id is string => Boolean(id));
  const representanteIds = campanhas.map((c) => c.representanteIdAlvo).filter((id): id is string => Boolean(id));

  const [produtos, representantes] = await Promise.all([
    prisma.produto.findMany({ where: { id: { in: produtoIds } }, select: { id: true, nomePadrao: true } }),
    prisma.representante.findMany({ where: { id: { in: representanteIds } }, select: { id: true, nome: true } }),
  ]);
  const nomeProduto = new Map(produtos.map((p) => [p.id, p.nomePadrao]));
  const nomeRepresentante = new Map(representantes.map((r) => [r.id, r.nome]));

  const hoje = new Date();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Campanhas</h1>
        <Link href="/campanhas/novo" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
          Nova Campanha
        </Link>
      </div>

      {campanhas.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
          <p className="text-sm text-neutral-500">Nenhuma campanha cadastrada ainda.</p>
          <Link href="/campanhas/novo" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
            Criar a primeira campanha
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-100 dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Nome</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Vigência</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">% especial</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Alvo</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Status</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Ações</th>
              </tr>
            </thead>
            <tbody>
              {campanhas.map((c) => {
                const vigente = c.ativa && c.dataInicio <= hoje && c.dataFim >= hoje;
                const alvo = [
                  c.produtoIdAlvo ? (nomeProduto.get(c.produtoIdAlvo) ?? "Produto removido") : null,
                  c.representanteIdAlvo ? (nomeRepresentante.get(c.representanteIdAlvo) ?? "Representante removido") : null,
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <tr key={c.id} className="border-t border-neutral-100 dark:border-neutral-800">
                    <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">{c.nome}</td>
                    <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">
                      {c.dataInicio.toLocaleDateString("pt-BR")} – {c.dataFim.toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">{Number(c.percentualComissaoEspecial)}%</td>
                    <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">{alvo || "Todos"}</td>
                    <td className="px-4 py-2">
                      <StatusBadge
                        label={!c.ativa ? "Inativa" : vigente ? "Vigente" : "Fora do período"}
                        cor={!c.ativa ? "neutro" : vigente ? "verde" : "ambar"}
                      />
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <Link href={`/campanhas/${c.id}/editar`} className="text-neutral-600 underline hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
                        Editar
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
