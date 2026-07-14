"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MODULOS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/representantes", label: "Representantes" },
  { href: "/contratos", label: "Contratos" },
  { href: "/produtos", label: "Produtos" },
  { href: "/clientes", label: "Clientes" },
  { href: "/vendas", label: "Vendas" },
  { href: "/contas-a-receber", label: "Contas a Receber" },
  { href: "/comissoes", label: "Comissões" },
  { href: "/bonificacoes", label: "Bonificações" },
  { href: "/campanhas", label: "Campanhas" },
  { href: "/relatorios", label: "Relatórios" },
  { href: "/auditoria", label: "Auditoria" },
  { href: "/configuracoes", label: "Configurações" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-60 shrink-0 flex-col gap-1 border-r border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mb-4 px-2">
        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Comercial e Financeiro</p>
      </div>
      {MODULOS.map((modulo) => {
        const ativo = pathname === modulo.href || pathname.startsWith(modulo.href + "/");
        return (
          <Link
            key={modulo.href}
            href={modulo.href}
            className={`rounded-md px-3 py-2 text-sm transition ${
              ativo
                ? "bg-neutral-900 font-medium text-white dark:bg-white dark:text-neutral-900"
                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
            }`}
          >
            {modulo.label}
          </Link>
        );
      })}
    </nav>
  );
}
