import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { VendaForm } from "@/components/formularios/VendaForm";

export default async function NovaVendaPage() {
  const sessao = await auth();
  const empresaId = sessao!.user.empresaId;

  const [clientes, produtos, representantes] = await Promise.all([
    prisma.cliente.findMany({ where: { empresaId, ativo: true }, orderBy: { nomePadrao: "asc" }, select: { id: true, nomePadrao: true } }),
    prisma.produto.findMany({ where: { empresaId, ativo: true }, orderBy: { nomePadrao: "asc" }, select: { id: true, nomePadrao: true } }),
    prisma.representante.findMany({ where: { empresaId, ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);

  const faltandoCadastro = clientes.length === 0 || produtos.length === 0 || representantes.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Nova Venda (avulsa)</h1>
      {faltandoCadastro ? (
        <p className="text-sm text-neutral-500">
          É preciso ter pelo menos um cliente, um produto e um representante ativos cadastrados antes de lançar uma
          venda.
        </p>
      ) : (
        <VendaForm
          clientes={clientes.map((c) => ({ id: c.id, nome: c.nomePadrao }))}
          produtos={produtos.map((p) => ({ id: p.id, nome: p.nomePadrao }))}
          representantes={representantes.map((r) => ({ id: r.id, nome: r.nome }))}
        />
      )}
    </div>
  );
}
