import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { EmpresaForm, UsuariosSection } from "@/components/formularios/ConfiguracoesForm";

export default async function ConfiguracoesPage() {
  const sessao = await auth();
  if (sessao?.user.perfil !== "ADMIN") redirect("/dashboard");

  const [empresa, usuarios] = await Promise.all([
    prisma.empresa.findUniqueOrThrow({ where: { id: sessao.user.empresaId } }),
    prisma.usuario.findMany({ where: { empresaId: sessao.user.empresaId }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Configurações</h1>
        <section>
          <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">Dados da empresa e ciclo comercial</h2>
          <EmpresaForm
            valoresIniciais={{
              razaoSocial: empresa.razaoSocial,
              nomeFantasia: empresa.nomeFantasia,
              diaInicioCiclo: empresa.diaInicioCiclo,
              diaFimCiclo: empresa.diaFimCiclo,
            }}
          />
        </section>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">Usuários</h2>
        <UsuariosSection
          usuarios={usuarios.map((u) => ({ id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, ativo: u.ativo }))}
          usuarioLogadoId={sessao.user.id}
        />
      </section>
    </div>
  );
}
