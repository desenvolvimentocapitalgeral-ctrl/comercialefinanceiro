import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { cicloComercialDoId } from "@/lib/calculos/ciclo";
import { calcularBonificacaoMetaDoses } from "@/lib/calculos/bonificacao";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { BotaoImprimir } from "@/components/ui/BotaoImprimir";
import { AbasRecibo } from "@/components/ui/AbasRecibo";

const FORMATO_MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_LABEL: Record<string, { label: string; cor: "verde" | "ambar" | "vermelho" | "neutro" | "azul" }> = {
  PENDENTE: { label: "Pendente", cor: "ambar" },
  APROVADA: { label: "Aprovada", cor: "azul" },
  PAGA: { label: "Paga", cor: "verde" },
  CANCELADA: { label: "Cancelada", cor: "neutro" },
};

const STATUS_PARCELA_LABEL: Record<string, string> = {
  PENDENTE: "Aguardando pagamento",
  RECEBIDA: "Recebida",
  RECEBIDA_PARCIAL: "Recebida parcialmente",
  CANCELADA: "Cancelada",
  RENEGOCIADA: "Renegociada",
};

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export default async function ReciboBonificacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessao = await auth();
  const empresaId = sessao!.user.empresaId;

  const apuracao = await prisma.apuracaoBonificacao.findUnique({
    where: { id },
    include: { regraBonificacao: true, pagamentoItens: { include: { pagamento: true } } },
  });
  if (!apuracao) notFound();

  const [empresa, representante] = await Promise.all([
    prisma.empresa.findUniqueOrThrow({ where: { id: empresaId } }),
    prisma.representante.findUniqueOrThrow({ where: { id: apuracao.representanteId } }),
  ]);
  if (representante.empresaId !== empresaId) notFound();

  const ciclo = cicloComercialDoId(apuracao.cicloId);
  const pagamento = apuracao.pagamentoItens[0]?.pagamento ?? null;
  const regra = apuracao.regraBonificacao;

  const metaLabel =
    apuracao.dosesApuradas !== null
      ? `${Number(apuracao.metaValor)} doses`
      : FORMATO_MOEDA.format(Number(apuracao.metaValor));
  const apuradoLabel =
    apuracao.dosesApuradas !== null ? `${apuracao.dosesApuradas} doses` : FORMATO_MOEDA.format(Number(apuracao.valorApurado));

  // Memória de cálculo + comissão futura: só existe para o motor QUANTIDADE_DOSES
  // (o único que tem parte variável — VALOR_FATURAMENTO é tudo-ou-nada, sem excedente).
  // A comissão já reconhecida (apuracao.valorComissaoVariavel) segue RECEBIMENTO — já
  // reflete só as baixas registradas até agora. O que falta (se o cliente ainda não
  // pagou tudo) é projetado aqui, parcela a parcela, comparando com o cenário "se tudo
  // fosse recebido" (fracaoExcedentePorVenda diz quanto de cada venda é excedente —
  // aplicamos essa mesma fração sobre o saldo pendente de cada parcela dessa venda).
  let comissaoFuturaPendente = 0;
  let comissaoTotalProjetada = 0;
  let parcelasFuturas: { cliente: string; parcela: string; vencimento: Date; status: string; valorPendente: number; comissaoProjetada: number }[] = [];
  let percentualAplicavelFuturo = 0;

  if (regra.tipoMeta === "QUANTIDADE_DOSES") {
    const vendas = await prisma.venda.findMany({
      where: { representanteId: apuracao.representanteId, contratoId: apuracao.contratoId, cicloId: apuracao.cicloId },
      include: { cliente: { select: { nomePadrao: true } }, parcelas: { include: { baixas: true } } },
      orderBy: { dataVenda: "asc" },
    });

    const paramsBase = {
      metaDoses: regra.metaQuantidadeDoses ?? 0,
      percentualSemMeta: Number(regra.percentualSemMeta),
      percentualExcedente: Number(regra.percentualExcedente ?? 0),
      bonusFixoValor: Number(regra.bonusFixoValor),
      limiarExcedenteDoses: regra.limiarExcedenteDoses ?? undefined,
    };
    percentualAplicavelFuturo = apuracao.bateuMeta ? paramsBase.percentualExcedente : paramsBase.percentualSemMeta;

    // Cenário hipotético "se o cliente já tivesse pago tudo" — usado só para projetar
    // a comissão futura, nunca para decidir o que pagar agora.
    const resultadoProjetado = calcularBonificacaoMetaDoses({
      vendas: vendas.map((v) => ({ vendaId: v.id, dataValidacao: v.dataVenda, doses: v.dosesVendidas ?? 0, valorRecebido: Number(v.valorTotal) })),
      ...paramsBase,
    });

    comissaoTotalProjetada = resultadoProjetado.comissaoSobreExcedente ?? resultadoProjetado.valorComissaoSemMeta ?? 0;

    for (const v of vendas) {
      const fracaoExcedente = resultadoProjetado.fracaoExcedentePorVenda[v.id] ?? 0;
      if (fracaoExcedente === 0) continue;

      for (const p of v.parcelas) {
        const valorRecebidoParcela = p.baixas.reduce((acc, b) => acc + Number(b.valorRecebido), 0);
        const valorPendente = Number(p.valorParcela) - valorRecebidoParcela;
        if (valorPendente <= 0) continue;

        const comissaoProjetada = arredondar(valorPendente * fracaoExcedente * (percentualAplicavelFuturo / 100));
        if (comissaoProjetada <= 0) continue;

        parcelasFuturas.push({
          cliente: v.cliente.nomePadrao,
          parcela: `${p.numeroParcela}/${v.quantidadeParcelas}`,
          vencimento: p.dataVencimento,
          status: p.status,
          valorPendente,
          comissaoProjetada,
        });
      }
    }

    parcelasFuturas.sort((a, b) => a.vencimento.getTime() - b.vencimento.getTime());
    // Total pendente vem da subtração (bate exatamente com "projetada - já recebida");
    // a soma das linhas por parcela pode divergir por 1-2 centavos de arredondamento
    // individual, o que é normal em qualquer detalhamento de parcelas.
    comissaoFuturaPendente = Math.max(0, arredondar(comissaoTotalProjetada - Number(apuracao.valorComissaoVariavel)));
  }

  const totalAPagarAgora = Number(apuracao.valorBonusFixo) + Number(apuracao.valorComissaoVariavel);

  const memoriaCalculo =
    regra.tipoMeta === "QUANTIDADE_DOSES"
      ? apuracao.bateuMeta
        ? `Meta de ${regra.metaQuantidadeDoses} doses batida (${apuracao.dosesApuradas} doses vendidas no ciclo, ${(apuracao.dosesApuradas ?? 0) - (regra.metaQuantidadeDoses ?? 0)} de excedente) — bônus fixo de ${FORMATO_MOEDA.format(Number(regra.bonusFixoValor))} + ${Number(regra.percentualExcedente ?? 0)}% sobre o valor do excedente já efetivamente recebido do cliente.`
        : `Meta de ${regra.metaQuantidadeDoses} doses não atingida (${apuracao.dosesApuradas} doses vendidas no ciclo) — comissão flat de ${Number(regra.percentualSemMeta)}% sobre o valor já efetivamente recebido do cliente.`
      : apuracao.bateuMeta
        ? `Faturamento de ${FORMATO_MOEDA.format(Number(apuracao.valorApurado))} atingiu a meta de ${FORMATO_MOEDA.format(Number(regra.metaValorFaturamento ?? 0))} — bônus fixo de ${FORMATO_MOEDA.format(Number(regra.bonusFixoValor))}.`
        : `Faturamento de ${FORMATO_MOEDA.format(Number(apuracao.valorApurado))} não atingiu a meta de ${FORMATO_MOEDA.format(Number(regra.metaValorFaturamento ?? 0))} — sem bônus.`;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-8 print:p-0">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Recibo de bonificação/comissão</h1>
        <BotaoImprimir />
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-8 text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 print:border-0 print:p-0">
        <div className="flex items-start justify-between border-b border-neutral-200 pb-4 dark:border-neutral-800">
          <div>
            <p className="font-semibold">{empresa.nomeFantasia}</p>
            <p className="text-sm text-neutral-500">{empresa.razaoSocial}</p>
            <p className="text-sm text-neutral-500">CNPJ: {empresa.cnpj}</p>
          </div>
          <div className="text-right text-sm text-neutral-500">
            <p>Recibo</p>
            <p className="numerico">{apuracao.id.slice(-8).toUpperCase()}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 border-b border-neutral-200 pb-4 dark:border-neutral-800">
          <div>
            <p className="text-xs text-neutral-500">Representante</p>
            <p className="font-medium">{representante.nome}</p>
            <p className="text-sm text-neutral-500">{representante.cpfCnpj}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Ciclo comercial</p>
            <p className="font-medium">{apuracao.cicloId}</p>
            <p className="text-sm text-neutral-500">{ciclo.label}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4 border-b border-neutral-200 pb-4 dark:border-neutral-800">
          <div>
            <p className="text-xs text-neutral-500">Meta</p>
            <p className="numerico font-medium">{metaLabel}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Apurado</p>
            <p className="numerico font-medium">{apuradoLabel}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Bateu meta?</p>
            <StatusBadge label={apuracao.bateuMeta ? "Sim" : "Não"} cor={apuracao.bateuMeta ? "verde" : "ambar"} />
          </div>
        </div>

        <AbasRecibo
          abaBonificacao={
            <div className="mt-4">
              <div className="rounded-md border border-emerald-300/60 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                Esta apuração será paga neste ciclo ({apuracao.cicloId}) — é a bonificação fixa por meta batida, já somada à comissão
                sobre o valor que o cliente já pagou até agora.
              </div>

              <table className="mt-3 w-full text-left text-sm">
                <tbody>
                  <tr className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="py-2 text-neutral-600 dark:text-neutral-400">
                      Bonificação (fixa){apuracao.bateuMeta ? ` — bônus por atingir a meta` : ""}
                    </td>
                    <td className="py-2 numerico text-right font-medium">{FORMATO_MOEDA.format(Number(apuracao.valorBonusFixo))}</td>
                  </tr>
                  <tr className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="py-2 text-neutral-600 dark:text-neutral-400">
                      Comissão já recebida
                      {!apuracao.bateuMeta
                        ? ` — ${Number(regra.percentualSemMeta)}% sobre o valor já pago pelo cliente`
                        : " — sobre o excedente já efetivamente recebido"}
                    </td>
                    <td className="py-2 numerico text-right font-medium">{FORMATO_MOEDA.format(Number(apuracao.valorComissaoVariavel))}</td>
                  </tr>
                  {apuracao.motivoPerda && (
                    <tr>
                      <td colSpan={2} className="py-2 text-xs text-neutral-500">
                        ⚠ {apuracao.motivoPerda}
                      </td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-neutral-300 dark:border-neutral-700">
                    <td className="py-2 font-semibold">Total a pagar este mês</td>
                    <td className="py-2 numerico text-right text-lg font-semibold">{FORMATO_MOEDA.format(totalAPagarAgora)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900">
                <p className="text-neutral-700 dark:text-neutral-300">
                  <span className="font-medium">Memória de cálculo:</span> {memoriaCalculo}
                </p>
              </div>
            </div>
          }
          abaComissao={
            <div className="mt-4">
              {regra.tipoMeta !== "QUANTIDADE_DOSES" ? (
                <p className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
                  Este contrato usa meta em valor de faturamento (tudo-ou-nada) — não tem componente de comissão variável separado.
                </p>
              ) : (
                <>
                  <div className="rounded-md border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300">
                    Comissão futura, paga somente conforme o cliente for efetivamente pagando cada parcela — não é um valor devido hoje.
                  </div>

                  <table className="mt-3 w-full text-left text-sm">
                    <tbody>
                      <tr className="border-b border-neutral-100 dark:border-neutral-800">
                        <td className="py-2 text-neutral-600 dark:text-neutral-400">
                          Comissão total projetada ({percentualAplicavelFuturo}% se tudo for recebido)
                        </td>
                        <td className="py-2 numerico text-right font-medium">{FORMATO_MOEDA.format(comissaoTotalProjetada)}</td>
                      </tr>
                      <tr className="border-b border-neutral-100 dark:border-neutral-800">
                        <td className="py-2 text-neutral-600 dark:text-neutral-400">Já recebida (na aba Bonificação)</td>
                        <td className="py-2 numerico text-right font-medium">{FORMATO_MOEDA.format(Number(apuracao.valorComissaoVariavel))}</td>
                      </tr>
                      <tr className="border-t-2 border-neutral-300 dark:border-neutral-700">
                        <td className="py-2 font-semibold">Comissão futura pendente</td>
                        <td className="py-2 numerico text-right text-lg font-semibold">{FORMATO_MOEDA.format(comissaoFuturaPendente)}</td>
                      </tr>
                    </tbody>
                  </table>

                  {parcelasFuturas.length > 0 ? (
                    <table className="mt-4 w-full text-left text-xs">
                      <thead>
                        <tr className="text-neutral-500 dark:text-neutral-400">
                          <th className="py-1 font-medium">Cliente</th>
                          <th className="py-1 font-medium">Parcela</th>
                          <th className="py-1 font-medium">Vencimento</th>
                          <th className="py-1 font-medium">Situação</th>
                          <th className="py-1 numerico text-right font-medium">Valor pendente</th>
                          <th className="py-1 numerico text-right font-medium">Comissão projetada</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parcelasFuturas.map((p, i) => (
                          <tr key={i} className="border-t border-neutral-100 dark:border-neutral-800">
                            <td className="py-1 text-neutral-700 dark:text-neutral-300">{p.cliente}</td>
                            <td className="py-1 numerico text-neutral-700 dark:text-neutral-300">{p.parcela}</td>
                            <td className="py-1 numerico text-neutral-700 dark:text-neutral-300">{p.vencimento.toLocaleDateString("pt-BR")}</td>
                            <td className="py-1 text-neutral-700 dark:text-neutral-300">{STATUS_PARCELA_LABEL[p.status] ?? p.status}</td>
                            <td className="py-1 numerico text-right text-neutral-700 dark:text-neutral-300">{FORMATO_MOEDA.format(p.valorPendente)}</td>
                            <td className="py-1 numerico text-right text-neutral-700 dark:text-neutral-300">{FORMATO_MOEDA.format(p.comissaoProjetada)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="mt-3 text-sm text-neutral-500">Nenhuma parcela pendente gera comissão futura neste momento.</p>
                  )}
                </>
              )}
            </div>
          }
        />

        <div className="mt-6 flex items-center justify-between border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <div>
            <p className="text-xs text-neutral-500">Status</p>
            <StatusBadge label={STATUS_LABEL[apuracao.status].label} cor={STATUS_LABEL[apuracao.status].cor} />
          </div>
          {pagamento && (
            <div className="text-right">
              <p className="text-xs text-neutral-500">Data do pagamento</p>
              <p className="font-medium">{pagamento.dataPagamento.toLocaleDateString("pt-BR")}</p>
            </div>
          )}
        </div>

        <p className="mt-8 text-center text-xs text-neutral-400">Documento gerado pelo sistema — apuração calculada em {apuracao.calculadoEm.toLocaleString("pt-BR")}.</p>
      </div>
    </div>
  );
}
