import { NextResponse } from "next/server";
import { processarFilaNotificacoes } from "@/lib/notificacoes/enviar";

/**
 * Endpoint chamado periodicamente pelo Vercel Cron (configurar em
 * vercel.json) para processar a fila de notificações (Prompt 1, §7).
 * Protegido por CRON_SECRET — mesmo padrão recomendado pela Vercel para
 * rotas de cron: sem o header correto, nada é processado.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ erro: "CRON_SECRET não configurada." }, { status: 500 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const resultado = await processarFilaNotificacoes();
  return NextResponse.json(resultado);
}
