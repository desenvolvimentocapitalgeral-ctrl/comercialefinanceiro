"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { empresaSchema, usuarioSchema, type EmpresaFormValues, type UsuarioFormValues } from "@/lib/validacoes/configuracoes";

export type ResultadoAcao = { sucesso: true } | { sucesso: false; erro: string; codigo: string };

async function exigirSessaoAdmin() {
  const sessao = await auth();
  if (!sessao?.user || sessao.user.perfil !== "ADMIN") return null;
  return sessao;
}

export async function atualizarEmpresa(dadosBrutos: EmpresaFormValues): Promise<ResultadoAcao> {
  const sessao = await exigirSessaoAdmin();
  if (!sessao) return { sucesso: false, erro: "Apenas ADMIN pode alterar configurações.", codigo: "SEM_PERMISSAO" };

  const parsed = empresaSchema.safeParse(dadosBrutos);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos.", codigo: "VALIDACAO" };
  }
  const dados = parsed.data;

  const empresaAnterior = await prisma.empresa.findUniqueOrThrow({ where: { id: sessao.user.empresaId } });

  await prisma.empresa.update({
    where: { id: sessao.user.empresaId },
    data: {
      razaoSocial: dados.razaoSocial,
      nomeFantasia: dados.nomeFantasia,
      diaInicioCiclo: dados.diaInicioCiclo,
      diaFimCiclo: dados.diaFimCiclo,
    },
  });

  await prisma.logAuditoria.create({
    data: {
      entidade: "Empresa",
      entidadeId: sessao.user.empresaId,
      acao: "ATUALIZACAO",
      valorAnterior: {
        razaoSocial: empresaAnterior.razaoSocial,
        diaInicioCiclo: empresaAnterior.diaInicioCiclo,
        diaFimCiclo: empresaAnterior.diaFimCiclo,
      },
      valorNovo: dados,
      usuarioId: sessao.user.id,
    },
  });

  revalidatePath("/configuracoes");
  return { sucesso: true };
}

export async function criarUsuario(dadosBrutos: UsuarioFormValues): Promise<ResultadoAcao> {
  const sessao = await exigirSessaoAdmin();
  if (!sessao) return { sucesso: false, erro: "Apenas ADMIN pode criar usuários.", codigo: "SEM_PERMISSAO" };

  const parsed = usuarioSchema.safeParse(dadosBrutos);
  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos.", codigo: "VALIDACAO" };
  }
  const dados = parsed.data;

  const existente = await prisma.usuario.findUnique({ where: { email: dados.email } });
  if (existente) return { sucesso: false, erro: "Já existe um usuário com este e-mail.", codigo: "EMAIL_DUPLICADO" };

  const senhaTemporaria = Math.random().toString(36).slice(-10);
  const senhaHash = await bcrypt.hash(senhaTemporaria, 10);

  const usuario = await prisma.usuario.create({
    data: { empresaId: sessao.user.empresaId, nome: dados.nome, email: dados.email, senhaHash, perfil: dados.perfil, ativo: true },
  });

  await prisma.logAuditoria.create({
    data: { entidade: "Usuario", entidadeId: usuario.id, acao: "CRIACAO", valorNovo: { nome: dados.nome, email: dados.email, perfil: dados.perfil }, usuarioId: sessao.user.id },
  });

  // Prompt 1 §1.2: usuário criado deve receber e-mail de definição de senha —
  // módulo de notificações (Prompt 4) ainda não implementado nesta fase.
  revalidatePath("/configuracoes");
  return { sucesso: true };
}

export async function alternarStatusUsuario(usuarioId: string, ativo: boolean): Promise<ResultadoAcao> {
  const sessao = await exigirSessaoAdmin();
  if (!sessao) return { sucesso: false, erro: "Apenas ADMIN pode alterar usuários.", codigo: "SEM_PERMISSAO" };

  if (usuarioId === sessao.user.id && !ativo) {
    return { sucesso: false, erro: "Você não pode desativar seu próprio usuário.", codigo: "AUTO_DESATIVACAO" };
  }

  await prisma.usuario.update({ where: { id: usuarioId }, data: { ativo } });
  await prisma.logAuditoria.create({
    data: { entidade: "Usuario", entidadeId: usuarioId, acao: ativo ? "REATIVACAO" : "DESATIVACAO", usuarioId: sessao.user.id },
  });

  revalidatePath("/configuracoes");
  return { sucesso: true };
}
