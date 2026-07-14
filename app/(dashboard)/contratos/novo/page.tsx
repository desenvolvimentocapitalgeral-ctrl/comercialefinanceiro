import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { ContratoForm } from "@/components/formularios/ContratoForm";

export default async function NovoContratoPage() {
  const sessao = await auth();
  const representantes = await prisma.representante.findMany({
    where: { empresaId: sessao!.user.empresaId, ativo: true },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Novo Contrato</h1>
      {representantes.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Nenhum representante ativo cadastrado ainda. Cadastre um representante antes de criar um contrato.
        </p>
      ) : (
        <ContratoForm representantes={representantes} />
      )}
    </div>
  );
}
