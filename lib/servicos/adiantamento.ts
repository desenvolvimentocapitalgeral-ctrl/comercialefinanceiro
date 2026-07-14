import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";

type TransacaoPrisma = Prisma.TransactionClient;

export type ResultadoAdiantamento = { sucesso: true } | { sucesso: false; erro: string; codigo: string };

export interface CompensacaoSolicitada {
  adiantamentoId: string;
  valor: number;
}

export interface SaldoAdiantamento {
  id: string;
  dataPagamento: Date;
  valorTotal: number;
  valorCompensado: number;
  saldoEmAberto: number;
}

/**
 * Adiantamento (Prompt 3, §6.3). Nasce como Pagamento tipo=ADIANTAMENTO SEM
 * PagamentoItem vinculado (não quita nenhuma apuração diretamente) — só é
 * abatido de pagamentos regulares futuros por ação explícita do financeiro,
 * nunca automaticamente.
 */
export async function criarAdiantamento(
  representanteId: string,
  valor: number,
  dataPagamento: Date,
  usuarioId: string,
  motivo: string,
): Promise<ResultadoAdiantamento> {
  if (valor <= 0) {
    return { sucesso: false, erro: "O valor do adiantamento deve ser maior que zero.", codigo: "VALOR_INVALIDO" };
  }

  await prisma.$transaction(async (tx) => {
    const pagamento = await tx.pagamento.create({
      data: { representanteId, tipo: "ADIANTAMENTO", dataPagamento, valorTotal: valor, aprovadoPorUsuarioId: usuarioId },
    });

    await tx.logAuditoria.create({
      data: {
        entidade: "Pagamento",
        entidadeId: pagamento.id,
        acao: "CRIACAO",
        valorNovo: { representanteId, valor, tipo: "ADIANTAMENTO" },
        usuarioId,
        motivo,
      },
    });
  });

  return { sucesso: true };
}

/** Saldo em aberto de cada adiantamento do representante — valorTotal menos o já compensado em pagamentos regulares. */
export async function listarSaldosAdiantamento(representanteId: string): Promise<SaldoAdiantamento[]> {
  const adiantamentos = await prisma.pagamento.findMany({
    where: { representanteId, tipo: "ADIANTAMENTO" },
    include: { compensacoesComoAdiantamento: true },
    orderBy: { dataPagamento: "asc" },
  });

  return adiantamentos
    .map((a) => {
      const valorCompensado = a.compensacoesComoAdiantamento.reduce((acc, c) => acc + Number(c.valorCompensado), 0);
      return {
        id: a.id,
        dataPagamento: a.dataPagamento,
        valorTotal: Number(a.valorTotal),
        valorCompensado,
        saldoEmAberto: Number(a.valorTotal) - valorCompensado,
      };
    })
    .filter((a) => a.saldoEmAberto > 0.01);
}

/**
 * Valida cada compensação solicitada pelo financeiro contra o saldo real do
 * adiantamento (recalculado dentro da transação, para evitar corrida entre
 * dois pagamentos concorrentes) e retorna o total a abater — nunca aplica
 * mais do que o saldo disponível.
 */
export async function validarCompensacoesAdiantamento(
  tx: TransacaoPrisma,
  representanteId: string,
  compensacoes: CompensacaoSolicitada[],
): Promise<{ valido: true; totalCompensado: number } | { valido: false; erro: string }> {
  if (compensacoes.length === 0) return { valido: true, totalCompensado: 0 };

  let totalCompensado = 0;
  for (const solicitada of compensacoes) {
    if (solicitada.valor <= 0) return { valido: false, erro: "Valor de compensação de adiantamento inválido." };

    const adiantamento = await tx.pagamento.findUnique({
      where: { id: solicitada.adiantamentoId },
      include: { compensacoesComoAdiantamento: true },
    });
    if (!adiantamento || adiantamento.representanteId !== representanteId || adiantamento.tipo !== "ADIANTAMENTO") {
      return { valido: false, erro: "Adiantamento inválido ou de outro representante." };
    }

    const jaCompensado = adiantamento.compensacoesComoAdiantamento.reduce((acc, c) => acc + Number(c.valorCompensado), 0);
    const saldo = Number(adiantamento.valorTotal) - jaCompensado;
    if (solicitada.valor > saldo + 0.01) {
      return { valido: false, erro: `A compensação solicitada excede o saldo em aberto do adiantamento (R$ ${saldo.toFixed(2)}).` };
    }

    totalCompensado += solicitada.valor;
  }

  return { valido: true, totalCompensado };
}

/** Registra as linhas de compensação — chamado depois que o Pagamento regular já existe. */
export async function registrarCompensacoesAdiantamento(
  tx: TransacaoPrisma,
  pagamentoRegularId: string,
  compensacoes: CompensacaoSolicitada[],
  usuarioId: string,
): Promise<void> {
  for (const c of compensacoes) {
    await tx.compensacaoAdiantamento.create({
      data: { adiantamentoId: c.adiantamentoId, pagamentoRegularId, valorCompensado: c.valor, criadoPorUsuarioId: usuarioId },
    });
  }
}
