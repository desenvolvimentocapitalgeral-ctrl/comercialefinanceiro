"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/config";
import { parseDataLocal } from "@/lib/utils/data";
import { baixarParcela, type ResultadoBaixa } from "@/lib/servicos/baixarParcela";

async function exigirSessaoAdminFinanceiro() {
  const sessao = await auth();
  if (!sessao?.user || (sessao.user.perfil !== "ADMIN" && sessao.user.perfil !== "FINANCEIRO")) return null;
  return sessao;
}

export async function registrarRecebimento(
  parcelaId: string,
  dataRecebimentoStr: string,
  valorRecebido: number,
  motivo: string,
): Promise<ResultadoBaixa> {
  const sessao = await exigirSessaoAdminFinanceiro();
  if (!sessao) return { sucesso: false, erro: "Sem permissão.", codigo: "SEM_PERMISSAO" };

  if (!motivo || motivo.trim().length === 0) {
    return { sucesso: false, erro: "Informe o motivo/observação da baixa.", codigo: "MOTIVO_OBRIGATORIO" };
  }

  const resultado = await baixarParcela(parcelaId, parseDataLocal(dataRecebimentoStr), valorRecebido, sessao.user.id, motivo);

  if (resultado.sucesso) {
    revalidatePath("/contas-a-receber");
    revalidatePath("/comissoes");
  }

  return resultado;
}
