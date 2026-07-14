"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { parseDataLocal } from "@/lib/utils/data";
import { campanhaSchema, type CampanhaFormValues } from "@/lib/validacoes/campanha";

export type ResultadoCampanha = { sucesso: true } | { sucesso: false; erro: string; codigo: string };

async function exigirSessaoAdminFinanceiro() {
  const sessao = await auth();
  if (!sessao?.user || (sessao.user.perfil !== "ADMIN" && sessao.user.perfil !== "FINANCEIRO")) return null;
  return sessao;
}

export async function criarCampanha(dadosBrutos: CampanhaFormValues): Promise<ResultadoCampanha> {
  const sessao = await exigirSessaoAdminFinanceiro();
  if (!sessao) return { sucesso: false, erro: "Sem permissão.", codigo: "SEM_PERMISSAO" };

  const parsed = campanhaSchema.safeParse(dadosBrutos);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos.", codigo: "VALIDACAO" };
  }
  const dados = parsed.data;

  const campanha = await prisma.campanha.create({
    data: {
      empresaId: sessao.user.empresaId,
      nome: dados.nome,
      descricao: dados.descricao || null,
      dataInicio: parseDataLocal(dados.dataInicio),
      dataFim: parseDataLocal(dados.dataFim),
      percentualComissaoEspecial: dados.percentualComissaoEspecial,
      produtoIdAlvo: dados.produtoIdAlvo || null,
      representanteIdAlvo: dados.representanteIdAlvo || null,
      ativa: dados.ativa,
    },
  });

  await prisma.logAuditoria.create({
    data: { entidade: "Campanha", entidadeId: campanha.id, acao: "CRIACAO", valorNovo: dados, usuarioId: sessao.user.id },
  });

  revalidatePath("/campanhas");
  return { sucesso: true };
}

export async function atualizarCampanha(id: string, dadosBrutos: CampanhaFormValues): Promise<ResultadoCampanha> {
  const sessao = await exigirSessaoAdminFinanceiro();
  if (!sessao) return { sucesso: false, erro: "Sem permissão.", codigo: "SEM_PERMISSAO" };

  const parsed = campanhaSchema.safeParse(dadosBrutos);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos.", codigo: "VALIDACAO" };
  }
  const dados = parsed.data;

  const existente = await prisma.campanha.findUnique({ where: { id } });
  if (!existente) return { sucesso: false, erro: "Campanha não encontrada.", codigo: "NAO_ENCONTRADA" };

  await prisma.campanha.update({
    where: { id },
    data: {
      nome: dados.nome,
      descricao: dados.descricao || null,
      dataInicio: parseDataLocal(dados.dataInicio),
      dataFim: parseDataLocal(dados.dataFim),
      percentualComissaoEspecial: dados.percentualComissaoEspecial,
      produtoIdAlvo: dados.produtoIdAlvo || null,
      representanteIdAlvo: dados.representanteIdAlvo || null,
      ativa: dados.ativa,
    },
  });

  await prisma.logAuditoria.create({
    data: {
      entidade: "Campanha",
      entidadeId: id,
      acao: "ATUALIZACAO",
      valorAnterior: { nome: existente.nome, ativa: existente.ativa, percentualComissaoEspecial: Number(existente.percentualComissaoEspecial) },
      valorNovo: dados,
      usuarioId: sessao.user.id,
    },
  });

  revalidatePath("/campanhas");
  return { sucesso: true };
}
