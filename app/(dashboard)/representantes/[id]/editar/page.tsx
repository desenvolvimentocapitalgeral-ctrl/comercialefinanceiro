import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { RepresentanteForm } from "@/components/formularios/RepresentanteForm";

export default async function EditarRepresentantePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const representante = await prisma.representante.findUnique({ where: { id } });

  if (!representante) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Editar Representante</h1>
      <RepresentanteForm
        representanteId={representante.id}
        valoresIniciais={{
          nome: representante.nome,
          cpfCnpj: representante.cpfCnpj,
          email: representante.email ?? "",
          telefone: representante.telefone ?? "",
          observacoes: representante.observacoes ?? "",
          ativo: representante.ativo,
        }}
      />
    </div>
  );
}
