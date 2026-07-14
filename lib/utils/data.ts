/**
 * Converte uma string de data "AAAA-MM-DD" (vinda de <input type="date">) para
 * um Date à meia-noite no fuso LOCAL, não em UTC. `new Date("2026-07-11")` é
 * interpretado como UTC e, em fusos atrás de UTC (ex: Brasil), exibe o dia
 * anterior ao formatar — bug crítico aqui porque toda apuração de comissão
 * depende de datas exatas para resolver o ciclo comercial.
 */
export function parseDataLocal(dataStr: string): Date {
  const [ano, mes, dia] = dataStr.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

/**
 * Inverso de parseDataLocal: formata um Date como "AAAA-MM-DD" usando os
 * componentes LOCAIS, nunca `.toISOString()` — que converte para UTC e
 * também sofre do mesmo bug de dia trocado em fusos atrás de UTC.
 */
export function formatarDataIso(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}
