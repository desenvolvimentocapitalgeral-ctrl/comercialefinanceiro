import { Suspense } from "react";
import { LoginForm } from "@/components/formularios/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-neutral-50 px-4 dark:bg-neutral-950">
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Comercial e Financeiro</h1>
        <p className="text-sm text-neutral-500">Gestão de comissões e bonificações</p>
      </div>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
