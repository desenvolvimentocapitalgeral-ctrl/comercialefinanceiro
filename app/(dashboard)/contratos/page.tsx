import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { StatusBadge } from "@/components/ui/StatusBadge";

const STATUS_LABEL: Record<string, { label: string; cor: "verde" | "ambar" | "vermelho" | "neutro" }> = {
  ATIVO: { label: "Ativo", cor: "verde" },
  ENCERRADO: { label: "Encerrado", cor: "neutro" },
  RESCISAO_PENDENTE_FORMALIZACAO: { label: "Rescisão pendente", cor: "ambar" },
  SEM_TABELA_COMISSAO: { label: "Sem tabela de comissão", cor: "vermelho" },
};

export default async function ContratosPage() {
  const sessao = await auth();

  const contratos = await prisma.contrato.findMany({
    where: { representante: { empresaId: sessao!.user.empresaId } },
    orderBy: { vigenciaInicio: "desc" },
    include: {
      representante: { select: { nome: true } },
      regrasComissao: { orderBy: { vigenciaCicloInicio: "desc" }, take: 1 },
      regrasBonificacao: { orderBy: { vigenciaCicloInicio: "desc" }, take: 1 },
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Contratos</h1>
        <Link href="/contratos/novo" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
          Novo Contrato
        </Link>
      </div>

      {contratos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
          <p className="text-sm text-neutral-500">Nenhum contrato cadastrado ainda.</p>
          <Link href="/contratos/novo" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
            Cadastrar o primeiro contrato
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-100 dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Representante</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Vigência</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Motor comissão</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Bonificação</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Status</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Ações</th>
              </tr>
            </thead>
            <tbody>
              {contratos.map((c) => (
                <tr key={c.id} className="border-t border-neutral-100 dark:border-neutral-800">
                  <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">{c.representante.nome}</td>
                  <td className="px-4 py-2 numerico text-neutral-800 dark:text-neutral-200">
                    {c.vigenciaInicio.toLocaleDateString("pt-BR")} – {c.vigenciaFim ? c.vigenciaFim.toLocaleDateString("pt-BR") : "atual"}
                  </td>
                  <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">{c.regrasComissao[0]?.tipoCalculo ?? "—"}</td>
                  <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">{c.regrasBonificacao[0]?.tipoCalculo ?? "—"}</td>
                  <td className="px-4 py-2">
                    <StatusBadge label={STATUS_LABEL[c.status].label} cor={STATUS_LABEL[c.status].cor} />
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <Link href={`/contratos/${c.id}`} className="text-neutral-600 underline hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
                      Ver
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
