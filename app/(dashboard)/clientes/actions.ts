"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { clienteSchema, type ClienteFormValues } from "@/lib/validacoes/cliente";
import { resolverEntidade, LIMIARES_PADRAO, type CandidatoFuzzy } from "@/lib/depara/resolverEntidade";

export type ResultadoCliente =
  | { sucesso: true }
  | { sucesso: false; erro: string; codigo: "SEM_PERMISSAO" | "VALIDACAO" | "CPF_CNPJ_DUPLICADO" | "NAO_ENCONTRADO" }
  | { sucesso: false; erro: string; codigo: "POSSIVEL_DUPLICATA"; candidatos: CandidatoFuzzy[] };

async function exigirSessaoAdminFinanceiro() {
  const sessao = await auth();
  if (!sessao?.user || (sessao.user.perfil !== "ADMIN" && sessao.user.perfil !== "FINANCEIRO")) return null;
  return sessao;
}

/**
 * De-para (Prompt 2, §5.4) aplicado à criação manual de Cliente: antes de
 * criar um cadastro novo, verifica se já existe um cliente com nome muito
 * parecido (fuzzy — Levenshtein + tokens) e devolve a sugestão para
 * confirmação humana em vez de deixar o usuário criar uma duplicata sem
 * perceber. `ignorarSugestaoDuplicata=true` (usuário confirmou que são
 * pessoas/empresas diferentes) pula essa checagem.
 */
export async function criarCliente(dadosBrutos: ClienteFormValues, ignorarSugestaoDuplicata = false): Promise<ResultadoCliente> {
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

  if (!ignorarSugestaoDuplicata) {
    const candidatos = await prisma.cliente.findMany({
      where: { empresaId: sessao.user.empresaId, ativo: true },
      select: { id: true, nomePadrao: true, cpfCnpj: true },
    });
    const aliases = await prisma.clienteAlias.findMany({
      where: { cliente: { empresaId: sessao.user.empresaId } },
      select: { nomeOrigem: true, clienteId: true },
    });

    const resultado = resolverEntidade(
      dados.nomePadrao,
      dados.cpfCnpj,
      candidatos.map((c) => ({ id: c.id, nome: c.nomePadrao, cpfCnpj: c.cpfCnpj })),
      aliases.map((a) => ({ nomeOrigem: a.nomeOrigem, entidadeId: a.clienteId })),
      LIMIARES_PADRAO,
    );

    if (resultado.tipo === "FUZZY_ALTA") {
      return {
        sucesso: false,
        erro: `Cliente muito parecido já cadastrado (${Math.round(resultado.similaridade * 100)}% similar). Confirme se é uma pessoa/empresa diferente antes de criar.`,
        codigo: "POSSIVEL_DUPLICATA",
        candidatos: [{ entidadeId: resultado.entidadeId, nome: candidatos.find((c) => c.id === resultado.entidadeId)?.nomePadrao ?? "", similaridade: resultado.similaridade }],
      };
    }
    if (resultado.tipo === "FUZZY_MEDIA") {
      return { sucesso: false, erro: "Encontramos clientes parecidos já cadastrados. Confirme se nenhum deles é o mesmo antes de criar.", codigo: "POSSIVEL_DUPLICATA", candidatos: resultado.candidatos };
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
    data: { entidade: "Cliente", entidadeId: cliente.id, acao: "CRIACAO", valorNovo: dados, usuarioId: sessao.user.id, motivo: ignorarSugestaoDuplicata ? "Criado apesar de sugestão de possível duplicata" : undefined },
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
