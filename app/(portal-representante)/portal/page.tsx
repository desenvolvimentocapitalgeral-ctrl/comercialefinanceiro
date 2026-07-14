import { auth, signOut } from "@/lib/auth/config";

export default async function PortalPage() {
  const sessao = await auth();

  return (
    <main className="flex min-h-screen flex-col gap-4 p-8">
      <h1 className="text-xl font-semibold">Portal do Representante</h1>
      <p className="text-sm text-neutral-500">
        Logado como <strong>{sessao?.user?.name}</strong> ({sessao?.user?.email})
      </p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button type="submit" className="w-fit rounded-md border border-neutral-300 px-3 py-1.5 text-sm">
          Sair
        </button>
      </form>
    </main>
  );
}
