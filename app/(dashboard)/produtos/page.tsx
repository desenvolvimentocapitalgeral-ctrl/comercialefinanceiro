import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default async function ProdutosPage() {
  const sessao = await auth();

  const produtos = await prisma.produto.findMany({
    where: { empresaId: sessao!.user.empresaId },
    orderBy: { nomePadrao: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Produtos</h1>
        <Link href="/produtos/novo" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
          Novo Produto
        </Link>
      </div>

      {produtos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
          <p className="text-sm text-neutral-500">Nenhum produto cadastrado ainda.</p>
          <Link href="/produtos/novo" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
            Cadastrar o primeiro produto
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-100 dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Nome</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Código</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Preço de tabela</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Categoria</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Status</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Ações</th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((p) => (
                <tr key={p.id} className="border-t border-neutral-100 dark:border-neutral-800">
                  <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">{p.nomePadrao}</td>
                  <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">{p.codigoInterno}</td>
                  <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">
                    {Number(p.precoTabela).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">{p.categoria ?? "—"}</td>
                  <td className="px-4 py-2">
                    <StatusBadge label={p.ativo ? "Ativo" : "Inativo"} cor={p.ativo ? "verde" : "neutro"} />
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <Link href={`/produtos/${p.id}/editar`} className="text-neutral-600 underline hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
                      Editar
                    </Link>
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
