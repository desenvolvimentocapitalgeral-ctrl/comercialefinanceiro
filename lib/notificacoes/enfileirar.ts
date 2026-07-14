import { prisma } from "@/lib/db/client";
import type { ChaveTemplate } from "@/lib/notificacoes/templates";

/**
 * Enfileira uma notificação (Prompt 1, §7: "e-mail transacional assíncrono
 * (fila com retry) ... nunca bloqueia a ação de negócio que a originou").
 *
 * Só grava a linha na fila — nunca envia nada diretamente e nunca lança
 * exceção para quem chamou: se a gravação em si falhar (ex.: banco fora do
 * ar num instante ruim), a ação de negócio que disparou a notificação
 * segue adiante normalmente. Preferível perder uma notificação a travar
 * um pagamento.
 */
export async function enfileirarNotificacao(destinatario: string, template: ChaveTemplate, variaveis: Record<string, string>): Promise<void> {
  try {
    await prisma.notificacao.create({
      data: { destinatario, template, variaveis, status: "PENDENTE" },
    });
  } catch (erro) {
    console.error("Falha ao enfileirar notificação (ação de negócio não foi interrompida):", erro);
  }
}
