import { ProdutoForm } from "@/components/formularios/ProdutoForm";

export default function NovoProdutoPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Novo Produto</h1>
      <ProdutoForm />
    </div>
  );
}
