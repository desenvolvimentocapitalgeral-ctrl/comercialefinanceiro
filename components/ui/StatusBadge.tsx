const CORES = {
  verde: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  ambar: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  vermelho: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  azul: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  neutro: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
} as const;

export function StatusBadge({ label, cor }: { label: string; cor: keyof typeof CORES }) {
  return (
    <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${CORES[cor]}`}>
      {label}
    </span>
  );
}
