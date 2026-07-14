import { Resend } from "resend";
import { prisma } from "@/lib/db/client";
import { renderizarTemplate, type ChaveTemplate } from "@/lib/notificacoes/templates";

const MAX_TENTATIVAS = 5;

/**
 * Processa a fila de notificações (Prompt 1, §7: "fila com retry"). Pensado
 * para rodar periodicamente (cron/job), nunca inline numa requisição de
 * usuário. Cada falha incrementa `tentativas`; depois de MAX_TENTATIVAS a
 * notificação vira FALHA definitiva e para de ser tentada.
 *
 * Só envia de verdade quando RESEND_API_KEY está configurada — usuário
 * confirmou explicitamente a construção deste pipeline de envio real.
 */
export async function processarFilaNotificacoes(limite = 20): Promise<{ enviadas: number; falharam: number }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY não configurada — fila de notificações não será processada.");
    return { enviadas: 0, falharam: 0 };
  }

  const remetente = process.env.NOTIFICACOES_EMAIL_REMETENTE ?? "notificacoes@comercialefinanceiro.local";
  const client = new Resend(apiKey);

  const pendentes = await prisma.notificacao.findMany({
    where: { status: "PENDENTE", tentativas: { lt: MAX_TENTATIVAS } },
    orderBy: { criadoEm: "asc" },
    take: limite,
  });

  let enviadas = 0;
  let falharam = 0;

  for (const notificacao of pendentes) {
    const { assunto, corpo } = renderizarTemplate(notificacao.template as ChaveTemplate, notificacao.variaveis as Record<string, string>);

    try {
      const resultado = await client.emails.send({ from: remetente, to: notificacao.destinatario, subject: assunto, text: corpo });
      if (resultado.error) throw new Error(resultado.error.message);

      await prisma.notificacao.update({ where: { id: notificacao.id }, data: { status: "ENVIADA", enviadaEm: new Date() } });
      enviadas++;
    } catch (erro) {
      const mensagemErro = erro instanceof Error ? erro.message : "erro desconhecido";
      const novasTentativas = notificacao.tentativas + 1;
      await prisma.notificacao.update({
        where: { id: notificacao.id },
        data: {
          tentativas: novasTentativas,
          ultimoErro: mensagemErro,
          status: novasTentativas >= MAX_TENTATIVAS ? "FALHA" : "PENDENTE",
        },
      });
      falharam++;
    }
  }

  return { enviadas, falharam };
}
