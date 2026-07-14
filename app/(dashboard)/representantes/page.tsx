import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { RepresentantesTable, type RepresentanteLinha } from "@/components/tabelas/RepresentantesTable";
import { formatarDataIso } from "@/lib/utils/data";

export default async function RepresentantesPage() {
  const sessao = await auth();

  const representantes = await prisma.representante.findMany({
    where: { empresaId: sessao!.user.empresaId },
    orderBy: { nome: "asc" },
    include: {
      contratos: {
        where: { status: "ATIVO" },
        orderBy: { vigenciaInicio: "desc" },
        take: 1,
        include: {
          regrasComissao: { orderBy: { vigenciaCicloInicio: "desc" }, take: 1 },
          regrasBonificacao: { orderBy: { vigenciaCicloInicio: "desc" }, take: 1 },
        },
      },
    },
  });

  const linhas: RepresentanteLinha[] = representantes.map((r) => {
    const contrato = r.contratos[0];
    const regraComissao = contrato?.regrasComissao[0];
    const regraBonificacao = contrato?.regrasBonificacao[0];

    return {
      id: r.id,
      nome: r.nome,
      cpfCnpj: r.cpfCnpj,
      email: r.email,
      ativo: r.ativo,
      contratoAtivo: Boolean(contrato),
      contratoNumero: contrato?.numero ?? null,
      contratoVigenciaInicio: contrato ? formatarDataIso(contrato.vigenciaInicio) : null,
      contratoVigenciaFim: contrato?.vigenciaFim ? formatarDataIso(contrato.vigenciaFim) : null,
      contratoStatusAssinatura: contrato?.statusAssinatura ?? null,
      motorComissao: regraComissao?.tipoCalculo ?? null,
      percentualComissao: regraComissao?.percentual ? `${regraComissao.percentual}%` : null,
      motorBonificacao: regraBonificacao?.tipoCalculo ?? null,
      metaBonificacao:
        regraBonificacao?.metaQuantidadeDoses != null
          ? `${regraBonificacao.metaQuantidadeDoses} doses`
          : regraBonificacao?.metaValorFaturamento
            ? `R$ ${Number(regraBonificacao.metaValorFaturamento).toLocaleString("pt-BR")}`
            : null,
      bonusFixoValor: regraBonificacao?.bonusFixoValor ? `R$ ${Number(regraBonificacao.bonusFixoValor).toLocaleString("pt-BR")}` : null,
      temComissao: Boolean(regraComissao),
      temBonificacao: Boolean(regraBonificacao),
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Representantes</h1>
        <Link href="/representantes/novo" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
          Novo Representante
        </Link>
      </div>
      <RepresentantesTable representantes={linhas} />
    </div>
  );
}
