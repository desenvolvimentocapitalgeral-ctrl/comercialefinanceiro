import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { CampanhaForm } from "@/components/formularios/CampanhaForm";

export default async function EditarCampanhaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessao = await auth();

  const [campanha, produtos, representantes] = await Promise.all([
    prisma.campanha.findUnique({ where: { id } }),
    prisma.produto.findMany({ where: { empresaId: sessao!.user.empresaId, ativo: true }, orderBy: { nomePadrao: "asc" } }),
    prisma.representante.findMany({ where: { empresaId: sessao!.user.empresaId, ativo: true }, orderBy: { nome: "asc" } }),
  ]);

  if (!campanha) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Editar Campanha</h1>
      <CampanhaForm
        campanhaId={campanha.id}
        valoresIniciais={{
          nome: campanha.nome,
          descricao: campanha.descricao ?? "",
          dataInicio: format(campanha.dataInicio, "yyyy-MM-dd"),
          dataFim: format(campanha.dataFim, "yyyy-MM-dd"),
          percentualComissaoEspecial: campanha.percentualComissaoEspecial ? Number(campanha.percentualComissaoEspecial) : 0,
          produtoIdAlvo: campanha.produtoIdAlvo ?? "",
          representanteIdAlvo: campanha.representanteIdAlvo ?? "",
          ativa: campanha.ativa,
        }}
        produtos={produtos.map((p) => ({ id: p.id, nome: p.nomePadrao }))}
        representantes={representantes.map((r) => ({ id: r.id, nome: r.nome }))}
      />
    </div>
  );
}
