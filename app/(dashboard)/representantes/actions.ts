"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { representanteSchema, type RepresentanteFormValues } from "@/lib/validacoes/representante";

export type ResultadoAcao = { sucesso: true } | { sucesso: false; erro: string; codigo: string };

async function exigirSessaoAdminFinanceiro() {
  const sessao = await auth();
  if (!sessao?.user || (sessao.user.perfil !== "ADMIN" && sessao.user.perfil !== "FINANCEIRO")) {
    return null;
  }
  return sessao;
}

export async function criarRepresentante(dadosBrutos: RepresentanteFormValues): Promise<ResultadoAcao> {
  const sessao = await exigirSessaoAdminFinanceiro();
  if (!sessao) return { sucesso: false, erro: "Sem permissão.", codigo: "SEM_PERMISSAO" };

  const parsed = representanteSchema.safeParse(dadosBrutos);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos.", codigo: "VALIDACAO" };
  }
  const dados = parsed.data;

  const duplicado = await prisma.representante.findUnique({ where: { cpfCnpj: dados.cpfCnpj } });
  if (duplicado) {
    return { sucesso: false, erro: "Já existe um representante com este CPF/CNPJ.", codigo: "CPF_CNPJ_DUPLICADO" };
  }

  const representante = await prisma.representante.create({
    data: {
      empresaId: sessao.user.empresaId,
      nome: dados.nome,
      cpfCnpj: dados.cpfCnpj,
      email: dados.email || null,
      telefone: dados.telefone || null,
      observacoes: dados.observacoes || null,
      ativo: dados.ativo,
    },
  });

  if (dados.criarAcessoPortal && dados.email) {
    const senhaTemporaria = Math.random().toString(36).slice(-10);
    const senhaHash = await bcrypt.hash(senhaTemporaria, 10);
    const usuario = await prisma.usuario.create({
      data: {
        empresaId: sessao.user.empresaId,
        nome: dados.nome,
        email: dados.email,
        senhaHash,
        perfil: "REPRESENTANTE",
        ativo: true,
      },
    });
    await prisma.representante.update({ where: { id: representante.id }, data: { usuarioId: usuario.id } });
    // Prompt 1 §1.2: acesso ao portal deve disparar e-mail de definição de senha — módulo de notificações (Prompt 4).
  }

  await prisma.logAuditoria.create({
    data: {
      entidade: "Representante",
      entidadeId: representante.id,
      acao: "CRIACAO",
      valorNovo: dados,
      usuarioId: sessao.user.id,
    },
  });

  revalidatePath("/representantes");
  return { sucesso: true };
}

export async function atualizarRepresentante(id: string, dadosBrutos: RepresentanteFormValues): Promise<ResultadoAcao> {
  const sessao = await exigirSessaoAdminFinanceiro();
  if (!sessao) return { sucesso: false, erro: "Sem permissão.", codigo: "SEM_PERMISSAO" };

  const parsed = representanteSchema.safeParse(dadosBrutos);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos.", codigo: "VALIDACAO" };
  }
  const dados = parsed.data;

  const existente = await prisma.representante.findUnique({ where: { id } });
  if (!existente) return { sucesso: false, erro: "Representante não encontrado.", codigo: "NAO_ENCONTRADO" };

  const duplicado = await prisma.representante.findFirst({ where: { cpfCnpj: dados.cpfCnpj, NOT: { id } } });
  if (duplicado) {
    return { sucesso: false, erro: "Já existe outro representante com este CPF/CNPJ.", codigo: "CPF_CNPJ_DUPLICADO" };
  }

  await prisma.representante.update({
    where: { id },
    data: {
      nome: dados.nome,
      cpfCnpj: dados.cpfCnpj,
      email: dados.email || null,
      telefone: dados.telefone || null,
      observacoes: dados.observacoes || null,
      ativo: dados.ativo,
    },
  });

  await prisma.logAuditoria.create({
    data: {
      entidade: "Representante",
      entidadeId: id,
      acao: "ATUALIZACAO",
      valorAnterior: { nome: existente.nome, cpfCnpj: existente.cpfCnpj, email: existente.email, telefone: existente.telefone, ativo: existente.ativo },
      valorNovo: dados,
      usuarioId: sessao.user.id,
    },
  });

  revalidatePath("/representantes");
  return { sucesso: true };
}

export async function alternarStatusRepresentante(id: string, ativo: boolean, motivo: string): Promise<ResultadoAcao> {
  const sessao = await exigirSessaoAdminFinanceiro();
  if (!sessao) return { sucesso: false, erro: "Sem permissão.", codigo: "SEM_PERMISSAO" };

  if (!motivo || motivo.trim().length === 0) {
    return { sucesso: false, erro: "Informe o motivo.", codigo: "MOTIVO_OBRIGATORIO" };
  }

  const existente = await prisma.representante.findUnique({ where: { id } });
  if (!existente) return { sucesso: false, erro: "Representante não encontrado.", codigo: "NAO_ENCONTRADO" };

  await prisma.representante.update({ where: { id }, data: { ativo } });

  await prisma.logAuditoria.create({
    data: {
      entidade: "Representante",
      entidadeId: id,
      acao: ativo ? "REATIVACAO" : "DESATIVACAO",
      valorAnterior: { ativo: existente.ativo },
      valorNovo: { ativo },
      usuarioId: sessao.user.id,
      motivo,
    },
  });

  revalidatePath("/representantes");
  return { sucesso: true };
}
