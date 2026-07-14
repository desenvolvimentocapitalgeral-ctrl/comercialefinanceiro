"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { produtoSchema, type ProdutoFormValues } from "@/lib/validacoes/produto";

export type ResultadoProduto = { sucesso: true } | { sucesso: false; erro: string; codigo: string };

async function exigirSessaoAdminFinanceiro() {
  const sessao = await auth();
  if (!sessao?.user || (sessao.user.perfil !== "ADMIN" && sessao.user.perfil !== "FINANCEIRO")) return null;
  return sessao;
}

export async function criarProduto(dadosBrutos: ProdutoFormValues): Promise<ResultadoProduto> {
  const sessao = await exigirSessaoAdminFinanceiro();
  if (!sessao) return { sucesso: false, erro: "Sem permissão.", codigo: "SEM_PERMISSAO" };

  const parsed = produtoSchema.safeParse(dadosBrutos);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos.", codigo: "VALIDACAO" };
  }
  const dados = parsed.data;

  const duplicado = await prisma.produto.findUnique({ where: { codigoInterno: dados.codigoInterno } });
  if (duplicado) {
    return { sucesso: false, erro: "Já existe um produto com este código interno.", codigo: "CODIGO_DUPLICADO" };
  }

  const agora = new Date();

  await prisma.$transaction(async (tx) => {
    const produto = await tx.produto.create({
      data: {
        empresaId: sessao.user.empresaId,
        nomePadrao: dados.nomePadrao,
        codigoInterno: dados.codigoInterno,
        precoTabela: dados.precoTabela,
        categoria: dados.categoria || null,
        linhaGenetica: dados.linhaGenetica || null,
        ativo: dados.ativo,
      },
    });

    await tx.produtoHistoricoPreco.create({
      data: { produtoId: produto.id, precoTabela: dados.precoTabela, vigenciaInicio: agora, vigenciaFim: null },
    });

    await tx.logAuditoria.create({
      data: { entidade: "Produto", entidadeId: produto.id, acao: "CRIACAO", valorNovo: dados, usuarioId: sessao.user.id },
    });
  });

  revalidatePath("/produtos");
  return { sucesso: true };
}

export async function atualizarProduto(id: string, dadosBrutos: ProdutoFormValues): Promise<ResultadoProduto> {
  const sessao = await exigirSessaoAdminFinanceiro();
  if (!sessao) return { sucesso: false, erro: "Sem permissão.", codigo: "SEM_PERMISSAO" };

  const parsed = produtoSchema.safeParse(dadosBrutos);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos.", codigo: "VALIDACAO" };
  }
  const dados = parsed.data;

  const existente = await prisma.produto.findUnique({ where: { id } });
  if (!existente) return { sucesso: false, erro: "Produto não encontrado.", codigo: "NAO_ENCONTRADO" };

  const duplicado = await prisma.produto.findFirst({ where: { codigoInterno: dados.codigoInterno, NOT: { id } } });
  if (duplicado) {
    return { sucesso: false, erro: "Já existe outro produto com este código interno.", codigo: "CODIGO_DUPLICADO" };
  }

  const precoMudou = Number(existente.precoTabela) !== dados.precoTabela;
  const agora = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.produto.update({
      where: { id },
      data: {
        nomePadrao: dados.nomePadrao,
        codigoInterno: dados.codigoInterno,
        precoTabela: dados.precoTabela,
        categoria: dados.categoria || null,
        linhaGenetica: dados.linhaGenetica || null,
        ativo: dados.ativo,
      },
    });

    // Preço de tabela precisa de histórico (Prompt 2, Parte B §1.1) — nunca sobrescrever
    // o valor vigente sem fechar o registro anterior, pois o cálculo de desconto
    // concedido sempre resolve o preço vigente NA DATA DA VENDA, não o atual.
    if (precoMudou) {
      await tx.produtoHistoricoPreco.updateMany({
        where: { produtoId: id, vigenciaFim: null },
        data: { vigenciaFim: agora },
      });
      await tx.produtoHistoricoPreco.create({
        data: { produtoId: id, precoTabela: dados.precoTabela, vigenciaInicio: agora, vigenciaFim: null },
      });
    }

    await tx.logAuditoria.create({
      data: {
        entidade: "Produto",
        entidadeId: id,
        acao: "ATUALIZACAO",
        valorAnterior: { nomePadrao: existente.nomePadrao, precoTabela: existente.precoTabela.toString(), ativo: existente.ativo },
        valorNovo: dados,
        usuarioId: sessao.user.id,
      },
    });
  });

  revalidatePath("/produtos");
  return { sucesso: true };
}
