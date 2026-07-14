"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { clienteSchema, type ClienteFormValues } from "@/lib/validacoes/cliente";

export type ResultadoCliente = { sucesso: true } | { sucesso: false; erro: string; codigo: string };

async function exigirSessaoAdminFinanceiro() {
  const sessao = await auth();
  if (!sessao?.user || (sessao.user.perfil !== "ADMIN" && sessao.user.perfil !== "FINANCEIRO")) return null;
  return sessao;
}

export async function criarCliente(dadosBrutos: ClienteFormValues): Promise<ResultadoCliente> {
  const sessao = await exigirSessaoAdminFinanceiro();
  if (!sessao) return { sucesso: false, erro: "Sem permissão.", codigo: "SEM_PERMISSAO" };

  const parsed = clienteSchema.safeParse(dadosBrutos);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos.", codigo: "VALIDACAO" };
  }
  const dados = parsed.data;

  if (dados.cpfCnpj) {
    const duplicado = await prisma.cliente.findUnique({ where: { cpfCnpj: dados.cpfCnpj } });
    if (duplicado) {
      return { sucesso: false, erro: "Já existe um cliente com este CPF/CNPJ.", codigo: "CPF_CNPJ_DUPLICADO" };
    }
  }

  const cliente = await prisma.cliente.create({
    data: {
      empresaId: sessao.user.empresaId,
      nomePadrao: dados.nomePadrao,
      cpfCnpj: dados.cpfCnpj || null,
      ativo: dados.ativo,
    },
  });

  await prisma.logAuditoria.create({
    data: { entidade: "Cliente", entidadeId: cliente.id, acao: "CRIACAO", valorNovo: dados, usuarioId: sessao.user.id },
  });

  revalidatePath("/clientes");
  return { sucesso: true };
}

export async function atualizarCliente(id: string, dadosBrutos: ClienteFormValues): Promise<ResultadoCliente> {
  const sessao = await exigirSessaoAdminFinanceiro();
  if (!sessao) return { sucesso: false, erro: "Sem permissão.", codigo: "SEM_PERMISSAO" };

  const parsed = clienteSchema.safeParse(dadosBrutos);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos.", codigo: "VALIDACAO" };
  }
  const dados = parsed.data;

  const existente = await prisma.cliente.findUnique({ where: { id } });
  if (!existente) return { sucesso: false, erro: "Cliente não encontrado.", codigo: "NAO_ENCONTRADO" };

  if (dados.cpfCnpj) {
    const duplicado = await prisma.cliente.findFirst({ where: { cpfCnpj: dados.cpfCnpj, NOT: { id } } });
    if (duplicado) {
      return { sucesso: false, erro: "Já existe outro cliente com este CPF/CNPJ.", codigo: "CPF_CNPJ_DUPLICADO" };
    }
  }

  await prisma.cliente.update({
    where: { id },
    data: { nomePadrao: dados.nomePadrao, cpfCnpj: dados.cpfCnpj || null, ativo: dados.ativo },
  });

  await prisma.logAuditoria.create({
    data: {
      entidade: "Cliente",
      entidadeId: id,
      acao: "ATUALIZACAO",
      valorAnterior: { nomePadrao: existente.nomePadrao, cpfCnpj: existente.cpfCnpj, ativo: existente.ativo },
      valorNovo: dados,
      usuarioId: sessao.user.id,
    },
  });

  revalidatePath("/clientes");
  return { sucesso: true };
}
