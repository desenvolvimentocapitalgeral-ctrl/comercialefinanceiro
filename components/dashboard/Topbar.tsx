import { auth, signOut } from "@/lib/auth/config";

export async function Topbar() {
  const sessao = await auth();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-6 dark:border-neutral-800 dark:bg-neutral-950">
      <span className="text-sm text-neutral-500">Empresa de Desenvolvimento Ltda</span>
      <div className="flex items-center gap-3">
        <span className="text-sm text-neutral-700 dark:text-neutral-300">
          {sessao?.user?.name} <span className="text-neutral-400">·</span>{" "}
          <span className="text-xs uppercase text-neutral-400">{sessao?.user?.perfil}</span>
        </span>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit" className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
            Sair
          </button>
        </form>
      </div>
    </header>
  );
}
