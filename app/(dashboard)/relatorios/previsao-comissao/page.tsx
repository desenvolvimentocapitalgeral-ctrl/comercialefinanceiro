import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { resolverVigenciaPorCiclo, compararCicloId } from "@/lib/calculos/ciclo";
import { calcularComissaoPercentualFixo } from "@/lib/calculos/comissao";
import { StatusBadge } from "@/components/ui/StatusBadge";

const FORMATO_MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const FORMATO_MES = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

export default async function RelatorioPrevisaoComissaoPage() {
  const sessao = await auth();
  const empresaId = sessao!.user.empresaId;

  const [ultimaApuracao, representantes] = await Promise.all([
    prisma.apuracaoBonificacao.findFirst({
      where: {
        status: { in: ["APROVADA", "PAGA"] },
        regraBonificacao: { contrato: { representante: { empresaId } } },
      },
      orderBy: { cicloId: "desc" },
      select: { cicloId: true },
    }),
    prisma.representante.findMany({ where: { empresaId }, select: { id: true, nome: true } }),
  ]);
  const nomeRepresentante = new Map(representantes.map((r) => [r.id, r.nome]));

  const cicloFechado = ultimaApuracao?.cicloId ?? null;

  const apuracoesCicloFechado = cicloFechado
    ? await prisma.apuracaoBonificacao.findMany({
        where: {
          cicloId: cicloFechado,
          status: { in: ["APROVADA", "PAGA"] },
          regraBonificacao: { contrato: { representante: { empresaId } } },
        },
        include: { regraBonificacao: true },
        orderBy: { valorBonificacao: "desc" },
      })
    : [];

  const parcelasPendentes = await prisma.parcela.findMany({
    where: { status: "PENDENTE", venda: { representante: { empresaId } } },
    include: {
      venda: {
        include: {
          representante: { select: { id: true, nome: true } },
          contrato: { include: { regrasComissao: true } },
        },
      },
    },
    orderBy: { dataVencimento: "asc" },
  });

  interface LinhaTimeline {
    representanteId: string;
    representante: string;
    valorPendente: number;
    valorCalculavel: number;
    valorAApurar: number;
    qtdParcelas: number;
  }

  const mesesMap = new Map<string, Map<string, LinhaTimeline>>();

  for (const parcela of parcelasPendentes) {
    const mesChave = `${parcela.dataVencimento.getFullYear()}-${String(parcela.dataVencimento.getMonth() + 1).padStart(2, "0")}`;
    const venda = parcela.venda;
    const regra = resolverVigenciaPorCiclo(venda.contrato.regrasComissao, venda.cicloId);

    const valorParcela = Number(parcela.valorParcela);
    let calculavel = 0;
    let aApurar = 0;

    if (regra?.tipoCalculo === "FIXO" && regra.percentual !== null) {
      const resultado = calcularComissaoPercentualFixo({ valorRecebido: valorParcela, percentual: Number(regra.percentual) });
      if (!resultado.bloqueado) calculavel = resultado.valorComissao;
      else aApurar = valorParcela;
    } else if (regra?.tipoCalculo === "META") {
      // Motor META não gera comissão por parcela — o retorno do representante vem
      // inteiramente da bonificação de ciclo (ver seção acima), não aqui.
      aApurar = 0;
    } else {
      // DESC_POL1 / DESC_POL2 / POLV3_LEGACY / SEMTAB dependem do desconto concedido
      // por dose (dado manual do ERP) — não dá para prever sem essa informação.
      aApurar = valorParcela;
    }

    if (!mesesMap.has(mesChave)) mesesMap.set(mesChave, new Map());
    const porRepresentante = mesesMap.get(mesChave)!;

    const linha = porRepresentante.get(venda.representanteId) ?? {
      representanteId: venda.representanteId,
      representante: nomeRepresentante.get(venda.representanteId) ?? venda.representante.nome,
      valorPendente: 0,
      valorCalculavel: 0,
      valorAApurar: 0,
      qtdParcelas: 0,
    };
    linha.valorPendente += valorParcela;
    linha.valorCalculavel += calculavel;
    linha.valorAApurar += aApurar;
    linha.qtdParcelas += 1;
    porRepresentante.set(venda.representanteId, linha);
  }

  const meses = [...mesesMap.keys()].sort(compararCicloId);

  function tituloMes(mesChave: string): string {
    const [ano, mes] = mesChave.split("-").map(Number);
    const label = FORMATO_MES.format(new Date(ano, mes - 1, 1));
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  function explicarBonificacao(apuracao: (typeof apuracoesCicloFechado)[number]): string {
    const regra = apuracao.regraBonificacao;
    let texto: string;
    if (regra.tipoMeta === "QUANTIDADE_DOSES") {
      if (!apuracao.bateuMeta) {
        texto = `Meta de ${regra.metaQuantidadeDoses} doses não atingida (${apuracao.dosesApuradas} apuradas) — comissão flat de ${Number(regra.percentualSemMeta)}% sobre o valor recebido no ciclo.`;
      } else {
        const excedente = (apuracao.dosesApuradas ?? 0) - (regra.metaQuantidadeDoses ?? 0);
        texto = `Meta de ${regra.metaQuantidadeDoses} doses batida (${apuracao.dosesApuradas} apuradas, ${excedente} de excedente) — bônus fixo de ${FORMATO_MOEDA.format(Number(regra.bonusFixoValor))} + ${Number(regra.percentualExcedente ?? 0)}% sobre o valor do excedente.`;
      }
    } else if (!apuracao.bateuMeta) {
      texto = `Faturamento de ${FORMATO_MOEDA.format(Number(apuracao.valorApurado))} não atingiu a meta de ${FORMATO_MOEDA.format(Number(regra.metaValorFaturamento ?? 0))} — sem bônus.`;
    } else {
      texto = `Faturamento de ${FORMATO_MOEDA.format(Number(apuracao.valorApurado))} atingiu a meta de ${FORMATO_MOEDA.format(Number(regra.metaValorFaturamento ?? 0))} — bônus fixo de ${FORMATO_MOEDA.format(Number(regra.bonusFixoValor))}.`;
    }
    // motivoPerda também é usado para documentar exceções manuais pós-aprovação
    // (ex.: percentual negociado fora do contrato para um ciclo específico) —
    // quando presente, o valor pago já reflete a exceção, não a regra do contrato.
    return apuracao.motivoPerda ? `${texto} ⚠ Exceção neste ciclo: ${apuracao.motivoPerda}` : texto;
  }

  const totalCicloFechado = apuracoesCicloFechado.reduce((acc, a) => acc + Number(a.valorBonificacao), 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Previsão de Comissão</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Fechamento do último ciclo apurado e projeção mês a mês do que ainda está pendente de recebimento.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            Ciclo fechado {cicloFechado ? `— ${cicloFechado}` : ""}
          </h2>
          {cicloFechado && (
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Total: {FORMATO_MOEDA.format(totalCicloFechado)}
            </span>
          )}
        </div>

        {apuracoesCicloFechado.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhum ciclo de bonificação aprovado ainda.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-100 dark:bg-neutral-900">
                <tr>
                  <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Representante</th>
                  <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Como foi calculado</th>
                  <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Status</th>
                  <th className="px-4 py-2 text-right font-medium text-neutral-600 dark:text-neutral-300">Valor</th>
                </tr>
              </thead>
              <tbody>
                {apuracoesCicloFechado.map((a) => (
                  <tr key={a.id} className="border-t border-neutral-100 align-top dark:border-neutral-800">
                    <td className="px-4 py-2 font-medium whitespace-nowrap text-neutral-800 dark:text-neutral-200">
                      {nomeRepresentante.get(a.representanteId) ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">{explicarBonificacao(a)}</td>
                    <td className="px-4 py-2">
                      <StatusBadge label={a.status === "PAGA" ? "Paga" : "Aprovada"} cor={a.status === "PAGA" ? "verde" : "azul"} />
                    </td>
                    <td className="px-4 py-2 numerico text-right font-medium text-neutral-900 dark:text-neutral-100">
                      {FORMATO_MOEDA.format(Number(a.valorBonificacao))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Linha do tempo — parcelas pendentes</h2>
        <p className="text-sm text-neutral-500">
          Agrupado por mês de vencimento. &quot;Calculável&quot; é comissão de percentual fixo, exata. &quot;A apurar&quot; depende de
          tabela de desconto por dose ou de meta de ciclo (motor META), que só se resolve quando o ciclo fecha.
        </p>

        {meses.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhuma parcela pendente de recebimento.</p>
        ) : (
          <div className="flex flex-col gap-6">
            {meses.map((mesChave) => {
              const linhas = [...mesesMap.get(mesChave)!.values()].sort((a, b) => b.valorPendente - a.valorPendente);
              const totalMes = linhas.reduce((acc, l) => acc + l.valorPendente, 0);
              const totalCalculavelMes = linhas.reduce((acc, l) => acc + l.valorCalculavel, 0);

              return (
                <div key={mesChave} className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-2 dark:border-neutral-800 dark:bg-neutral-900">
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">{tituloMes(mesChave)}</span>
                    <span className="text-sm text-neutral-500">
                      Parcelas: {FORMATO_MOEDA.format(totalMes)} · Comissão calculável: {FORMATO_MOEDA.format(totalCalculavelMes)}
                    </span>
                  </div>
                  <table className="w-full text-left text-sm">
                    <thead className="bg-neutral-100 dark:bg-neutral-900">
                      <tr>
                        <th className="px-4 py-2 font-medium text-neutral-600 dark:text-neutral-300">Representante</th>
                        <th className="px-4 py-2 numerico text-right font-medium text-neutral-600 dark:text-neutral-300">Parcelas</th>
                        <th className="px-4 py-2 numerico text-right font-medium text-neutral-600 dark:text-neutral-300">Valor pendente</th>
                        <th className="px-4 py-2 numerico text-right font-medium text-neutral-600 dark:text-neutral-300">Comissão calculável</th>
                        <th className="px-4 py-2 numerico text-right font-medium text-neutral-600 dark:text-neutral-300">A apurar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map((l) => (
                        <tr key={l.representanteId} className="border-t border-neutral-100 dark:border-neutral-800">
                          <td className="px-4 py-2 text-neutral-800 dark:text-neutral-200">{l.representante}</td>
                          <td className="px-4 py-2 numerico text-right text-neutral-800 dark:text-neutral-200">{l.qtdParcelas}</td>
                          <td className="px-4 py-2 numerico text-right text-neutral-800 dark:text-neutral-200">
                            {FORMATO_MOEDA.format(l.valorPendente)}
                          </td>
                          <td className="px-4 py-2 numerico text-right font-medium text-neutral-900 dark:text-neutral-100">
                            {l.valorCalculavel > 0 ? FORMATO_MOEDA.format(l.valorCalculavel) : "—"}
                          </td>
                          <td className="px-4 py-2 numerico text-right text-neutral-500">
                            {l.valorAApurar > 0 ? FORMATO_MOEDA.format(l.valorAApurar) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
