/**
 * Converte um array de objetos para CSV (separador ";", padrão Excel PT-BR).
 * Escapa aspas e quebras de linha; nunca deixa vírgula/valor decimal confundir
 * o parser do Excel (por isso ";" em vez de ",").
 */
export function paraCsv<T extends Record<string, unknown>>(linhas: T[], colunas: { chave: keyof T; titulo: string }[]): string {
  const escapar = (valor: unknown): string => {
    const texto = valor === null || valor === undefined ? "" : String(valor);
    if (texto.includes(";") || texto.includes('"') || texto.includes("\n")) {
      return `"${texto.replace(/"/g, '""')}"`;
    }
    return texto;
  };

  const cabecalho = colunas.map((c) => escapar(c.titulo)).join(";");
  const corpo = linhas.map((linha) => colunas.map((c) => escapar(linha[c.chave])).join(";"));

  return [cabecalho, ...corpo].join("\r\n");
}
