import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { RepresentantesTable, type RepresentanteLinha } from "@/components/tabelas/RepresentantesTable";

export default async function RepresentantesPage() {
  const sessao = await auth();

  const representantes = await prisma.representante.findMany({
    where: { empresaId: sessao!.user.empresaId },
    orderBy: { nome: "asc" },
    include: {
      contratos: {
        where: { status: "ATIVO" },
        take: 1,
      },
    },
  });

  const linhas: RepresentanteLinha[] = representantes.map((r) => ({
    id: r.id,
    nome: r.nome,
    cpfCnpj: r.cpfCnpj,
    email: r.email,
    ativo: r.ativo,
    contratoAtivo: r.contratos.length > 0,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Representantes</h1>
        <Link href="/representantes/novo" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
          Novo Representante
        </Link>
      </div>
      <RepresentantesTable representantes={linhas} />
    </div>
  );
}
