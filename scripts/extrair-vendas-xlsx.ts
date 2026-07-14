/**
 * Lê o export real do Omie (Contas a Receber) em VENDAS.xlsx — aba
 * "base 11.06 ao 10.07", já pré-filtrada e validada pelo usuário contra o
 * pivot de faturamento por cliente do mesmo ciclo (11/06 a 10/07). Agrupa
 * as linhas de parcela por "Pedido nº X" e grava data/private/vendas.json —
 * staging local, gitignored, nunca commitado. Script local, não faz parte
 * do build/deploy. Fonte fora do repositório: pasta de contratos do usuário.
 *
 * Mapeia colunas por NOME de cabeçalho, não por posição — o layout do Omie
 * já mudou de 34 para 36 colunas entre exports (nova coluna "Número NSU
 * (Cupom Fiscal)"), então indexar por posição quebra silenciosamente.
 */
import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const ORIGEM = "C:\\Users\\helbe\\OneDrive\\Desktop\\CONTRATOS COMERCIAIS - BASE FECHAMENTO\\RELATORIO DE VENDAS ATE AGORA\\VENDAS.xlsx";
const ABA = "base 11.06 ao 10.07";
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
  const planilha = workbook.Sheets[ABA];
  if (!planilha) {
    throw new Error(`Aba "${ABA}" não encontrada. Abas disponíveis: ${workbook.SheetNames.join(", ")}`);
  }

  const linhas: Record<string, unknown>[] = XLSX.utils.sheet_to_json(planilha, { raw: true, defval: null });

  const parcelas: LinhaParcela[] = linhas
    .filter((linha) => linha["Situação"])
    .map((linha) => ({
      situacao: paraTexto(linha["Situação"]),
      parcela: paraTexto(linha["Parcela"]),
      clienteNomeFantasia: paraTexto(linha["Cliente (Nome Fantasia)"]),
      clienteRazaoSocial: paraTexto(linha["Cliente (Razão Social)"]),
      clienteCpfCnpj: paraTexto(linha["Cliente (CNPJ/CPF)"]).replace(/\D/g, ""),
      previsaoRecebimento: paraDataIso(linha["Previsão de Recebimento"]),
      ultimoRecebimento: paraDataIso(linha["Último Recebimento"]),
      valorConta: paraNumero(linha["Valor da Conta"]),
      desconto: paraNumero(linha["Desconto"]),
      valorRecebido: paraNumero(linha["Valor Recebido"]),
      valorAReceber: paraNumero(linha["Valor a Receber"]),
      vendedor: paraTexto(linha["Vendedor"]) || null,
      vencimento: paraDataIso(linha["Vencimento"]),
      dataEmissao: paraDataIso(linha["Data de Emissão"]),
      operacao: paraTexto(linha["Operação"]) || null,
      consideraNoFluxo: paraTexto(linha["Considera no fluxo e extrato?"]) || null,
      observacao: paraTexto(linha["Observação"]) || null,
    }))
    // linhas de teste (R$1, sem Operação/Vendedor) já vistas em exports anteriores
    .filter((linha) => linha.operacao !== null);

  fs.mkdirSync(path.dirname(DESTINO), { recursive: true });
  fs.writeFileSync(DESTINO, JSON.stringify(parcelas, null, 2), "utf-8");
  console.log(`Extraídas ${parcelas.length} linhas de parcela -> ${DESTINO}`);

  const total = parcelas.reduce((acc, p) => acc + p.valorConta, 0);
  console.log(`Soma de "Valor da Conta": R$ ${total.toFixed(2)} (esperado: R$ 170.745,00, validado contra pivot (8).xlsx)`);
}

main();
