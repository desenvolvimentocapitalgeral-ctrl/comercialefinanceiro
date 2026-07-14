import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { CampanhaForm } from "@/components/formularios/CampanhaForm";

export default async function NovaCampanhaPage() {
  const sessao = await auth();

  const [produtos, representantes] = await Promise.all([
    prisma.produto.findMany({ where: { empresaId: sessao!.user.empresaId, ativo: true }, orderBy: { nomePadrao: "asc" } }),
    prisma.representante.findMany({ where: { empresaId: sessao!.user.empresaId, ativo: true }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Nova Campanha</h1>
      <CampanhaForm
        produtos={produtos.map((p) => ({ id: p.id, nome: p.nomePadrao }))}
        representantes={representantes.map((r) => ({ id: r.id, nome: r.nome }))}
      />
    </div>
  );
}
