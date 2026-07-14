import { ClienteForm } from "@/components/formularios/ClienteForm";

export default function NovoClientePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Novo Cliente</h1>
      <ClienteForm />
    </div>
  );
}
