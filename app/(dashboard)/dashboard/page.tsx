import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { DistribuicaoMotorChart } from "@/components/graficos/DistribuicaoMotorChart";

function Card({ titulo, valor, cor, href }: { titulo: string; valor: string | number; cor: "verde" | "ambar" | "vermelho" | "neutro" | "azul"; href: string }) {
  const corTexto = { verde: "text-emerald-600", ambar: "text-amber-600", vermelho: "text-red-600", neutro: "text-neutral-900 dark:text-neutral-100", azul: "text-blue-600" }[cor];
  return (
    <Link href={href} className="rounded-lg border border-neutral-200 p-4 transition hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600">
      <p className="text-xs text-neutral-500">{titulo}</p>
      <p className={`numerico mt-1 text-2xl font-semibold ${corTexto}`}>{valor}</p>
    </Link>
  );
}

export default async function DashboardPage() {
  const sessao = await auth();
  const empresaId = sessao!.user.empresaId;

  const [
    apuracoesBloqueadas,
    contratosSemTabela,
    contratosRescisaoPendente,
    representantesSemContratoAtivo,
    apuracoesComissao,
    apuracoesBonificacao,
    regrasComissaoAtivas,
  ] = await Promise.all([
    prisma.apuracaoComissao.count({ where: { status: "BLOQUEADA_DADO_MANUAL_FALTANTE", parcela: { venda: { empresaId } } } }),
    prisma.contrato.count({ where: { status: "SEM_TABELA_COMISSAO", representante: { empresaId } } }),
    prisma.contrato.count({ where: { status: "RESCISAO_PENDENTE_FORMALIZACAO", representante: { empresaId } } }),
    prisma.representante.count({ where: { empresaId, ativo: true, contratos: { none: { status: "ATIVO" } } } }),
    prisma.apuracaoComissao.findMany({ where: { parcela: { venda: { empresaId } } }, select: { status: true, valorComissao: true } }),
    prisma.apuracaoBonificacao.findMany({
      where: { regraBonificacao: { contrato: { representante: { empresaId } } } },
      select: { status: true, valorBonificacao: true },
    }),
    prisma.regraComissao.findMany({ where: { contrato: { status: "ATIVO", representante: { empresaId } } }, select: { tipoCalculo: true } }),
  ]);

  const somaPor = (itens: { status: string; valor: number }[], statuses: string[]) =>
    itens.filter((i) => statuses.includes(i.status)).reduce((acc, i) => acc + i.valor, 0);

  const comissaoItens = apuracoesComissao.map((a) => ({ status: a.status, valor: Number(a.valorComissao) }));
  const bonificacaoItens = apuracoesBonificacao.map((a) => ({ status: a.status, valor: Number(a.valorBonificacao) }));

  const comissaoPendenteAprovada = somaPor(comissaoItens, ["PENDENTE", "APROVADA"]);
  const bonificacaoPendenteAprovada = somaPor(bonificacaoItens, ["PENDENTE", "APROVADA"]);
  const totalPago = somaPor(comissaoItens, ["PAGA"]) + somaPor(bonificacaoItens, ["PAGA"]);

  const distribuicaoMotor = regrasComissaoAtivas.reduce<Record<string, number>>((acc, r) => {
    acc[r.tipoCalculo] = (acc[r.tipoCalculo] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-neutral-900 dark:text-neutral-100">Dashboard</h1>
        <p className="text-sm text-neutral-500">Saúde do processo antes do resultado financeiro — os dois importam, mas um bloqueio silencioso custa mais caro que um número baixo.</p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">Saúde do processo</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card titulo="Comissões bloqueadas (dado manual faltante)" valor={apuracoesBloqueadas} cor={apuracoesBloqueadas > 0 ? "ambar" : "verde"} href="/comissoes" />
          <Card titulo="Contratos sem tabela de comissão" valor={contratosSemTabela} cor={contratosSemTabela > 0 ? "vermelho" : "verde"} href="/contratos" />
          <Card titulo="Contratos com rescisão pendente" valor={contratosRescisaoPendente} cor={contratosRescisaoPendente > 0 ? "ambar" : "verde"} href="/contratos" />
          <Card titulo="Representantes sem contrato ativo" valor={representantesSemContratoAtivo} cor={representantesSemContratoAtivo > 0 ? "ambar" : "verde"} href="/representantes" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">Resultado financeiro</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card titulo="Comissão pendente + aprovada" valor={comissaoPendenteAprovada.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} cor="neutro" href="/comissoes" />
          <Card titulo="Bonificação pendente + aprovada" valor={bonificacaoPendenteAprovada.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} cor="neutro" href="/bonificacoes" />
          <Card titulo="Total já pago (comissão + bonificação)" valor={totalPago.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} cor="verde" href="/relatorios" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">Representantes por motor de cálculo</h2>
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <DistribuicaoMotorChart dados={Object.entries(distribuicaoMotor).map(([motor, quantidade]) => ({ motor, quantidade }))} />
        </div>
      </section>
    </div>
  );
}
