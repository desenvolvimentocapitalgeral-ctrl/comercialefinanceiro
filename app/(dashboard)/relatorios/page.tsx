import Link from "next/link";

const RELATORIOS = [
  { href: "/relatorios/comissoes", titulo: "Comissão por Representante e Ciclo", descricao: "Todas as apurações de comissão, uma linha por baixa de parcela." },
  { href: "/relatorios/bonificacoes", titulo: "Bonificação por Representante e Ciclo", descricao: "Todas as apurações de bonificação, com meta e percentual de atingimento." },
  { href: "/relatorios/vendas", titulo: "Faturamento por Cliente e Produto", descricao: "Ranking de vendas, útil para identificar concentração de carteira." },
  { href: "/relatorios/previsao-comissao", titulo: "Previsão de Comissão", descricao: "Fechamento do último ciclo de bonificação e linha do tempo de comissão prevista por mês." },
];

export default function RelatoriosPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Relatórios</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {RELATORIOS.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="rounded-lg border border-neutral-200 p-4 transition hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
          >
            <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{r.titulo}</p>
            <p className="mt-1 text-xs text-neutral-500">{r.descricao}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
