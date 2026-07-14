/**
 * Lê "pivot (9).xlsx" (Faturamento por Produto, com Quantidade real por
 * linha de produto) e agrega por pedido (Data + Vendedor + Cliente,
 * forward-fill das células em branco da hierarquia do pivot) — grava
 * data/private/doses-pivot.json para o script de backfill usar.
 *
 * O schema atual (Venda.produtoId) representa 1 produto por venda; este
 * pivot mostra que um mesmo pedido real pode ter várias linhas de produto
 * distintas. Como comissão/bonificação (motor META) usam doses TOTAIS da
 * venda, não por produto, agregamos a Quantidade por pedido em vez de
 * tentar quebrar cada Venda em sub-linhas de produto (mudança de schema
 * fora do escopo deste ajuste pontual).
 */
import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const ORIGEM = "C:\\Users\\helbe\\Downloads\\pivot (9).xlsx";
const DESTINO = path.join(process.cwd(), "data", "private", "doses-pivot.json");

interface GrupoPedido {
  dataEmissao: string; // "AAAA-MM-DD"
  vendedor: string;
  cliente: string;
  totalDoses: number;
  produtos: string[]; // códigos de produto, para referência/auditoria
  totalMercadoria: number;
}

function paraDataIso(valor: unknown): string | null {
  if (!valor) return null;
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === "string") {
    const match = valor.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      const [, dia, mes, ano] = match;
      return `${ano}-${mes}-${dia}`;
    }
  }
  return null;
}

function main() {
  const workbook = XLSX.readFile(ORIGEM, { cellDates: true });
  const planilha = workbook.Sheets["Faturamento por Produto"];
  if (!planilha) throw new Error(`Aba "Faturamento por Produto" não encontrada. Abas: ${workbook.SheetNames.join(", ")}`);

  const linhas: unknown[][] = XLSX.utils.sheet_to_json(planilha, { header: 1, raw: true });
  // linha 0 = título, 1 = "Filtros", 2 = Situação, 3 = blank, 4 = cabeçalhos, 5+ = dados
  const dados = linhas.slice(5);

  let dataAtual: string | null = null;
  let vendedorAtual: string | null = null;
  let clienteAtual: string | null = null;

  const grupos = new Map<string, GrupoPedido>();

  for (const linha of dados) {
    const [dataRaw, vendedorRaw, clienteRaw, produtoRaw, quantidadeRaw, , , totalRaw] = linha;

    if (String(linha[0] ?? "").trim() === "Total geral") continue;

    // Um novo Vendedor nomeado sem Cliente/Produto na mesma linha é uma linha
    // órfã (ex.: taxa avulsa do Gabriel Duarte, 30/06, sem produto nenhum) —
    // nunca herda o cliente do grupo anterior, e é descartada (sem produto
    // real, não há doses para atribuir a lugar nenhum).
    if (vendedorRaw && !produtoRaw) {
      dataAtual = paraDataIso(dataRaw) ?? dataAtual;
      vendedorAtual = String(vendedorRaw).trim();
      clienteAtual = null;
      continue;
    }
    if (!produtoRaw) continue;

    const data: string | null = paraDataIso(dataRaw) ?? dataAtual;
    const vendedor: string | null = (vendedorRaw ? String(vendedorRaw).trim() : null) || vendedorAtual;
    const cliente: string | null = (clienteRaw ? String(clienteRaw).trim() : null) || clienteAtual;
    dataAtual = data;
    vendedorAtual = vendedor;
    clienteAtual = cliente;

    if (!data || !vendedor || !cliente) continue; // linha sem grupo identificável (ex: taxa avulsa do Gabriel Duarte)

    const chave = `${data}|${vendedor}|${cliente}`;
    const grupo = grupos.get(chave) ?? { dataEmissao: data, vendedor, cliente, totalDoses: 0, produtos: [], totalMercadoria: 0 };

    const quantidade = typeof quantidadeRaw === "number" ? quantidadeRaw : Number(quantidadeRaw) || 0;
    grupo.totalDoses += quantidade;
    if (produtoRaw) grupo.produtos.push(String(produtoRaw).trim());
    grupo.totalMercadoria += typeof totalRaw === "number" ? totalRaw : Number(totalRaw) || 0;

    grupos.set(chave, grupo);
  }

  const resultado = [...grupos.values()];
  fs.mkdirSync(path.dirname(DESTINO), { recursive: true });
  fs.writeFileSync(DESTINO, JSON.stringify(resultado, null, 2), "utf-8");

  console.log(`Grupos extraídos: ${resultado.length}`);
  console.log(`Total de doses somadas: ${resultado.reduce((acc, g) => acc + g.totalDoses, 0)}`);
  console.log(`Total de mercadoria somado: R$ ${resultado.reduce((acc, g) => acc + g.totalMercadoria, 0).toFixed(2)}`);
}

main();
