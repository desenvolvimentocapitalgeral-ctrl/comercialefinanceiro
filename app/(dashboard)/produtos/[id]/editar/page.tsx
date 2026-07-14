import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { ProdutoForm } from "@/components/formularios/ProdutoForm";

export default async function EditarProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const produto = await prisma.produto.findUnique({ where: { id } });

  if (!produto) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Editar Produto</h1>
      <ProdutoForm
        produtoId={produto.id}
        valoresIniciais={{
          nomePadrao: produto.nomePadrao,
          codigoInterno: produto.codigoInterno,
          precoTabela: Number(produto.precoTabela),
          categoria: produto.categoria ?? "",
          linhaGenetica: produto.linhaGenetica ?? "",
          ativo: produto.ativo,
        }}
      />
    </div>
  );
}
