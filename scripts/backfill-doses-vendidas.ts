/**
 * Backfill de Venda.dosesVendidas a partir de data/private/doses-pivot.json
 * (pivot com Quantidade real por produto, agregada por pedido). Casa cada
 * grupo do pivot com a Venda real correspondente por representante + data
 * da venda + maior similaridade de nome de cliente (reaproveita o mesmo
 * pipeline de-para já usado na criação de Cliente — Prompt 2, §5.4).
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db/client";
import { similaridadeCombinada } from "@/lib/depara/similaridade";

interface GrupoPedido {
  dataEmissao: string;
  vendedor: string;
  cliente: string;
  totalDoses: number;
  produtos: string[];
  totalMercadoria: number;
}

function normalizar(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

async function main() {
  const grupos: GrupoPedido[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "private", "doses-pivot.json"), "utf-8"));
  const mapaVendedores: Record<string, string> = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "private", "mapa-vendedores.json"), "utf-8"),
  );

  const representantes = await prisma.representante.findMany();
  const representantePorNome = new Map(representantes.map((r) => [normalizar(r.nome), r]));

  let atualizadas = 0;
  let semRepresentante = 0;
  let semVendaCorrespondente = 0;

  for (const grupo of grupos) {
    const nomeRepresentante = mapaVendedores[normalizar(grupo.vendedor)];
    const representante = nomeRepresentante ? representantePorNome.get(normalizar(nomeRepresentante)) : undefined;

    if (!representante) {
      semRepresentante++;
      console.log(`Pulado (sem representante mapeado): ${grupo.vendedor} — ${grupo.cliente}`);
      continue;
    }

    const dataVenda = new Date(`${grupo.dataEmissao}T00:00:00`);
    const inicioDia = new Date(dataVenda);
    const fimDia = new Date(dataVenda);
    fimDia.setDate(fimDia.getDate() + 1);

    const candidatas = await prisma.venda.findMany({
      where: { representanteId: representante.id, dataVenda: { gte: inicioDia, lt: fimDia } },
      include: { cliente: true },
    });

    if (candidatas.length === 0) {
      semVendaCorrespondente++;
      console.log(`Pulado (nenhuma venda encontrada): ${grupo.vendedor} — ${grupo.cliente} em ${grupo.dataEmissao}`);
      continue;
    }

    const melhor = candidatas
      .map((v) => ({ venda: v, similaridade: similaridadeCombinada(grupo.cliente, v.cliente.nomePadrao) }))
      .sort((a, b) => b.similaridade - a.similaridade)[0];

    if (melhor.similaridade < 0.5) {
      semVendaCorrespondente++;
      console.log(`Pulado (nenhum cliente parecido o suficiente, melhor=${melhor.similaridade.toFixed(2)}): ${grupo.cliente}`);
      continue;
    }

    await prisma.venda.update({ where: { id: melhor.venda.id }, data: { dosesVendidas: grupo.totalDoses } });
    atualizadas++;
    console.log(`OK (similaridade ${melhor.similaridade.toFixed(2)}): ${melhor.venda.cliente.nomePadrao} <- ${grupo.totalDoses} doses`);
  }

  console.log(`\nVendas atualizadas: ${atualizadas}`);
  console.log(`Pulados (sem representante mapeado): ${semRepresentante}`);
  console.log(`Pulados (sem venda correspondente): ${semVendaCorrespondente}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
