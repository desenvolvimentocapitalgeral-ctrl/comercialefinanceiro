import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { cicloComercialDoId, cicloEstaFechado } from "@/lib/calculos/ciclo";
import { BonificacoesTable, type ApuracaoBonificacaoLinha, type RegraParaRecalculo } from "@/components/tabelas/BonificacoesTable";

export default async function BonificacoesPage() {
  const sessao = await auth();

  const [apuracoes, regras, representantes] = await Promise.all([
    prisma.apuracaoBonificacao.findMany({
      where: { regraBonificacao: { contrato: { representante: { empresaId: sessao!.user.empresaId } } } },
      orderBy: { calculadoEm: "desc" },
    }),
    prisma.regraBonificacao.findMany({
      where: { contrato: { status: "ATIVO", representante: { empresaId: sessao!.user.empresaId } } },
      include: { contrato: { include: { representante: true } } },
    }),
    prisma.representante.findMany({ where: { empresaId: sessao!.user.empresaId }, select: { id: true, nome: true } }),
  ]);

  const nomeRepresentante = new Map(representantes.map((r) => [r.id, r.nome]));

  const linhas: ApuracaoBonificacaoLinha[] = apuracoes.map((a) => ({
    id: a.id,
    representanteId: a.representanteId,
    representanteNome: nomeRepresentante.get(a.representanteId) ?? "—",
    cicloId: a.cicloId,
    cicloEstaFechado: cicloEstaFechado(cicloComercialDoId(a.cicloId)),
    valorApurado: Number(a.valorApurado),
    dosesApuradas: a.dosesApuradas,
    metaValor: Number(a.metaValor),
    percentualAtingimento: Number(a.percentualAtingimento),
    bateuMeta: a.bateuMeta,
    valorBonificacao: Number(a.valorBonificacao),
    status: a.status,
  }));

  const regrasParaRecalculo: RegraParaRecalculo[] = regras.map((r) => ({
    id: r.id,
    representanteNome: r.contrato.representante.nome,
    tipoMeta: r.tipoMeta,
  }));

  const totalPendente = apuracoes
    .filter((a) => a.status === "PENDENTE" || a.status === "APROVADA")
    .reduce((acc, a) => acc + Number(a.valorBonificacao), 0);
  const totalPago = apuracoes.filter((a) => a.status === "PAGA").reduce((acc, a) => acc + Number(a.valorBonificacao), 0);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Bonificações</h1>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-xs text-neutral-500">Pendente + aprovada</p>
          <p className="numerico text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {totalPendente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-xs text-neutral-500">Já paga</p>
          <p className="numerico text-lg font-semibold text-emerald-600">
            {totalPago.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
        </div>
      </div>

      <BonificacoesTable apuracoes={linhas} regras={regrasParaRecalculo} />
    </div>
  );
}
