import type { Prisma } from "@prisma/client";
import { calcularCiclo, resolverVigenciaPorCiclo } from "@/lib/calculos/ciclo";
import { calcularComissaoPercentualFixo, calcularComissaoPorTabelaDesconto } from "@/lib/calculos/comissao";

type TransacaoPrisma = Prisma.TransactionClient;

/**
 * Ponto único de geração de ApuracaoComissao — chamado tanto pela baixa manual
 * quanto pela futura importação em lote de Contas a Receber (Prompt 1, Parte B
 * §6). Nunca duplicar esta lógica em outro lugar.
 *
 * Resolve a RegraComissao pelo cicloId da VENDA (não do recebimento) — é a
 * "regra de ouro" do sistema: a data que importa para saber qual regra
 * contratual vale é a da venda, mesmo que o dinheiro entre meses depois.
 */
export async function gerarApuracaoComissao(tx: TransacaoPrisma, baixaParcelaId: string, usuarioId: string): Promise<void> {
  const baixa = await tx.baixaParcela.findUniqueOrThrow({
    where: { id: baixaParcelaId },
    include: { parcela: { include: { venda: { include: { contrato: { include: { regrasComissao: true } } } } } } },
  });

  const { parcela } = baixa;
  const { venda } = parcela;
  const { contrato } = venda;

  const regraVigente = resolverVigenciaPorCiclo(contrato.regrasComissao, venda.cicloId);
  const cicloRecebimento = calcularCiclo(baixa.dataRecebimento).cicloId;

  if (!regraVigente) {
    await criarApuracaoBloqueada(tx, baixa.id, venda.representanteId, cicloRecebimento, "SEM_REGRA_VIGENTE_PARA_O_CICLO", usuarioId);
    return;
  }

  // Motor META: a "comissão" desse arquétipo é inteiramente resolvida na
  // apuração de bonificação por ciclo (percentualSemMeta/percentualExcedente
  // vivem em RegraBonificacao, não aqui) — nunca gera ApuracaoComissao por
  // parcela. Ver docs/especificacao-completa.md, Prompt 2 Parte A §1.1.
  if (regraVigente.tipoCalculo === "META") {
    return;
  }

  const resultado =
    regraVigente.tipoCalculo === "FIXO"
      ? calcularComissaoPercentualFixo({
          valorRecebido: Number(baixa.valorRecebido),
          percentual: regraVigente.percentual ? Number(regraVigente.percentual) : null,
        })
      : await calcularViaTabelaDesconto(tx, regraVigente.id, Number(baixa.valorRecebido), venda.descontoConcedidoPorDose);

  if (resultado.bloqueado) {
    await criarApuracaoBloqueada(tx, baixa.id, venda.representanteId, cicloRecebimento, resultado.motivo, usuarioId, regraVigente.id);
    return;
  }

  const campanha = await resolverCampanhaAtiva(tx, venda.empresaId, venda.representanteId, venda.produtoId, venda.dataVenda);
  const percentualAplicado = campanha ? Number(campanha.percentualComissaoEspecial) : resultado.percentualAplicado;
  const valorComissao = campanha
    ? arredondarValor(Number(baixa.valorRecebido) * (percentualAplicado / 100))
    : resultado.valorComissao;

  await tx.apuracaoComissao.upsert({
    where: { baixaParcelaId: baixa.id },
    update: {
      valorBase: baixa.valorRecebido,
      percentualAplicado,
      valorComissao,
      campanhaId: campanha?.id ?? null,
      status: "PENDENTE",
      cicloId: cicloRecebimento,
    },
    create: {
      parcelaId: parcela.id,
      baixaParcelaId: baixa.id,
      representanteId: venda.representanteId,
      regraComissaoId: regraVigente.id,
      campanhaId: campanha?.id ?? null,
      cicloId: cicloRecebimento,
      valorBase: baixa.valorRecebido,
      percentualAplicado,
      valorComissao,
      status: "PENDENTE",
    },
  });

  await tx.logAuditoria.create({
    data: {
      entidade: "ApuracaoComissao",
      entidadeId: baixa.id,
      acao: "CRIACAO",
      valorNovo: { valorComissao: resultado.valorComissao, percentualAplicado: resultado.percentualAplicado },
      usuarioId,
    },
  });
}

/**
 * Campanha é regra ADITIVA temporária sobre o contrato (nunca substitui a
 * regra normal, apenas sobrepõe o percentual quando vigente) — Prompt 2,
 * Parte A §5.5. Vale pela DATA DA VENDA, nunca pela data do recebimento,
 * mesma "regra de ouro" do contrato. Alvo (produto/representante) é
 * opcional: null no campo = vale para todos.
 */
async function resolverCampanhaAtiva(
  tx: TransacaoPrisma,
  empresaId: string,
  representanteId: string,
  produtoId: string,
  dataVenda: Date,
) {
  return tx.campanha.findFirst({
    where: {
      empresaId,
      ativa: true,
      dataInicio: { lte: dataVenda },
      dataFim: { gte: dataVenda },
      percentualComissaoEspecial: { not: null },
      OR: [{ representanteIdAlvo: null }, { representanteIdAlvo: representanteId }],
      AND: [{ OR: [{ produtoIdAlvo: null }, { produtoIdAlvo: produtoId }] }],
    },
    orderBy: { dataInicio: "desc" },
  });
}

function arredondarValor(valor: number): number {
  return Math.round(valor * 100) / 100;
}

async function calcularViaTabelaDesconto(
  tx: TransacaoPrisma,
  regraComissaoId: string,
  valorRecebido: number,
  descontoConcedidoPorDose: Prisma.Decimal | null,
) {
  const regra = await tx.regraComissao.findUniqueOrThrow({ where: { id: regraComissaoId }, include: { contrato: true } });
  const politicaComercialId = regra.contrato.politicaComercialId;

  if (!politicaComercialId) {
    return { bloqueado: true as const, motivo: "SEM_TABELA_COMISSAO" };
  }

  const tabela = await tx.tabelaDescontoComissao.findMany({ where: { politicaComercialId } });

  return calcularComissaoPorTabelaDesconto({
    valorRecebido,
    tabela: tabela.map((t) => ({
      descontoMinimo: Number(t.descontoMinimo),
      descontoMaximo: Number(t.descontoMaximo),
      percentualComissao: Number(t.percentualComissao),
    })),
    descontoConcedidoPorDose: descontoConcedidoPorDose ? Number(descontoConcedidoPorDose) : null,
  });
}

async function criarApuracaoBloqueada(
  tx: TransacaoPrisma,
  baixaParcelaId: string,
  representanteId: string,
  cicloId: string,
  motivo: string,
  usuarioId: string,
  regraComissaoId?: string,
) {
  const baixa = await tx.baixaParcela.findUniqueOrThrow({ where: { id: baixaParcelaId } });

  await tx.apuracaoComissao.upsert({
    where: { baixaParcelaId },
    update: { status: "BLOQUEADA_DADO_MANUAL_FALTANTE", motivoBloqueio: motivo, cicloId },
    create: {
      parcelaId: baixa.parcelaId,
      baixaParcelaId,
      representanteId,
      regraComissaoId: regraComissaoId ?? "",
      cicloId,
      valorBase: baixa.valorRecebido,
      percentualAplicado: 0,
      valorComissao: 0,
      status: "BLOQUEADA_DADO_MANUAL_FALTANTE",
      motivoBloqueio: motivo,
    },
  });

  // Bloqueio de apuração também é evento financeiro relevante (Prompt 1 §2.1):
  // é a diferença entre "não calculamos" e "calculamos zero por engano".
  await tx.logAuditoria.create({
    data: {
      entidade: "ApuracaoComissao",
      entidadeId: baixaParcelaId,
      acao: "BLOQUEIO",
      valorNovo: { motivoBloqueio: motivo },
      usuarioId,
    },
  });
}
