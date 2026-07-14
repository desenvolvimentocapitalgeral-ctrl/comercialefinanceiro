import { RepresentanteForm } from "@/components/formularios/RepresentanteForm";

export default function NovoRepresentantePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Novo Representante</h1>
      <RepresentanteForm />
    </div>
  );
}
