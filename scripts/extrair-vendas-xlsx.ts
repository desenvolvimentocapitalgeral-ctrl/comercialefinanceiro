/**
 * Lê o export real do Omie (Contas a Receber) em VENDAS.xlsx, agrupa as 205
 * linhas de parcela por "Pedido nº X" e grava data/private/vendas.json —
 * staging local, gitignored, nunca commitado. Script local, não faz parte
 * do build/deploy. Fonte fora do repositório: pasta de contratos do usuário.
 *
 * Layout do Omie: título na linha 1, metadados na linha 2, cabeçalhos na
 * linha 3, dados a partir da linha 4 (ver docs da extração manual).
 */
import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const ORIGEM = "C:\\Users\\helbe\\OneDrive\\Desktop\\CONTRATOS COMERCIAIS\\RELATORIO DE VENDAS ATE AGORA\\VENDAS.xlsx";
const DESTINO = path.join(process.cwd(), "data", "private", "vendas.json");

interface LinhaParcela {
  situacao: string;
  parcela: string; // "NNN/NNN"
  clienteNomeFantasia: string;
  clienteRazaoSocial: string;
  clienteCpfCnpj: string;
  previsaoRecebimento: string | null;
  ultimoRecebimento: string | null;
  valorConta: number;
  desconto: number;
  valorRecebido: number;
  valorAReceber: number;
  vendedor: string | null;
  vencimento: string | null;
  dataEmissao: string | null;
  operacao: string | null; // "Pedido nº X"
  consideraNoFluxo: string | null;
  observacao: string | null;
}

function paraDataIso(valor: unknown): string | null {
  if (!valor) return null;
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return null;
}

function paraNumero(valor: unknown): number {
  return typeof valor === "number" ? valor : Number(valor) || 0;
}

function paraTexto(valor: unknown): string {
  return valor === null || valor === undefined ? "" : String(valor).trim();
}

function main() {
  const workbook = XLSX.readFile(ORIGEM, { cellDates: true });
  const planilha = workbook.Sheets[workbook.SheetNames[0]];
  const linhas: unknown[][] = XLSX.utils.sheet_to_json(planilha, { header: 1, raw: true });

  // linha 0 = título, linha 1 = "Emitido por...", linha 2 = cabeçalhos, linha 3+ = dados
  const dados = linhas.slice(3);

  const parcelas: LinhaParcela[] = dados
    .filter((linha) => linha.length > 0 && linha[0])
    .map((linha) => ({
      situacao: paraTexto(linha[0]),
      parcela: paraTexto(linha[2]),
      clienteNomeFantasia: paraTexto(linha[4]),
      clienteRazaoSocial: paraTexto(linha[25]),
      clienteCpfCnpj: paraTexto(linha[26]).replace(/\D/g, ""),
      previsaoRecebimento: paraDataIso(linha[5]),
      ultimoRecebimento: paraDataIso(linha[6]),
      valorConta: paraNumero(linha[7]),
      desconto: paraNumero(linha[10]),
      valorRecebido: paraNumero(linha[12]),
      valorAReceber: paraNumero(linha[13]),
      vendedor: paraTexto(linha[16]) || null,
      vencimento: paraDataIso(linha[22]),
      dataEmissao: paraDataIso(linha[23]),
      operacao: paraTexto(linha[15]) || null,
      consideraNoFluxo: paraTexto(linha[35]) || null,
      observacao: paraTexto(linha[30]) || null,
    }));

  fs.mkdirSync(path.dirname(DESTINO), { recursive: true });
  fs.writeFileSync(DESTINO, JSON.stringify(parcelas, null, 2), "utf-8");
  console.log(`Extraídas ${parcelas.length} linhas de parcela -> ${DESTINO}`);
}

main();
