import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { ClienteForm } from "@/components/formularios/ClienteForm";

export default async function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cliente = await prisma.cliente.findUnique({ where: { id } });

  if (!cliente) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Editar Cliente</h1>
      <ClienteForm
        clienteId={cliente.id}
        valoresIniciais={{ nomePadrao: cliente.nomePadrao, cpfCnpj: cliente.cpfCnpj ?? "", ativo: cliente.ativo }}
      />
    </div>
  );
}
