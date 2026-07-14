import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";

function formatarValor(valor: unknown): string {
  if (valor === null || valor === undefined) return "—";
  if (typeof valor === "object") {
    return Object.entries(valor as Record<string, unknown>)
      .map(([chave, v]) => `${chave}: ${JSON.stringify(v)}`)
      .join(", ");
  }
  return String(valor);
}

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ entidade?: string; usuarioId?: string }>;
}) {
  const sessao = await auth();
  if (sessao?.user.perfil !== "ADMIN") redirect("/dashboard");

  const filtros = await searchParams;

  const [entidadesDistintas, usuarios, logs] = await Promise.all([
    prisma.logAuditoria.findMany({ distinct: ["entidade"], select: { entidade: true }, orderBy: { entidade: "asc" } }),
    prisma.usuario.findMany({ select: { id: true, nome: true } }),
    prisma.logAuditoria.findMany({
      where: {
        entidade: filtros.entidade || undefined,
        usuarioId: filtros.usuarioId || undefined,
      },
      orderBy: { criadoEm: "desc" },
      take: 200,
    }),
  ]);

  const nomeUsuario = new Map(usuarios.map((u) => [u.id, u.nome]));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Auditoria</h1>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Entidade</label>
          <select name="entidade" defaultValue={filtros.entidade ?? ""} className="input">
            <option value="">Todas</option>
            {entidadesDistintas.map((e) => (
              <option key={e.entidade} value={e.entidade}>
                {e.entidade}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Usuário</label>
          <select name="usuarioId" defaultValue={filtros.usuarioId ?? ""} className="input">
            <option value="">Todos</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
          Filtrar
        </button>
      </form>

      {logs.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhum registro de auditoria encontrado com esses filtros.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-100 dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Data/hora</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Entidade</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Ação</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Usuário</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Motivo</th>
                <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Alteração</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-neutral-100 align-top dark:border-neutral-800">
                  <td className="px-4 py-2 numerico whitespace-nowrap text-neutral-800 dark:text-neutral-200">
                    {l.criadoEm.toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">{l.entidade}</td>
                  <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">{l.acao}</td>
                  <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">{nomeUsuario.get(l.usuarioId) ?? "—"}</td>
                  <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">{l.motivo ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-neutral-600 dark:text-neutral-400">
                    {l.valorAnterior && (
                      <p>
                        <span className="font-medium">De:</span> {formatarValor(l.valorAnterior)}
                      </p>
                    )}
                    {l.valorNovo && (
                      <p>
                        <span className="font-medium">Para:</span> {formatarValor(l.valorNovo)}
                      </p>
                    )}
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
