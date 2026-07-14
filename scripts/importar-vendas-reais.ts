/**
 * Importa vendas reais a partir de data/private/vendas.json (extraído do
 * Contas a Receber do Omie via scripts/extrair-vendas-xlsx.ts — gitignored,
 * nunca commitado). Script local, não faz parte do build/deploy. Idempotente
 * via origemImportacaoId (chave = "omie-pedido-<numero>").
 *
 * Regras de negócio aplicadas nesta importação (ver docs/especificacao-completa.md):
 * - Cada "Pedido nº X" do Omie vira 1 Venda; as linhas de parcela do pedido
 *   viram Parcela (numeroParcela extraído de "NNN/NNN").
 * - Regra de ouro: contratoId = contrato vigente do representante NA DATA DE
 *   EMISSÃO do pedido, nunca o vigente hoje.
 * - O export de Contas a Receber do Omie não discrimina produto por pedido
 *   (só existe granularidade produto x data agregada, sem link ao pedido/
 *   cliente/vendedor) — por isso toda venda importada usa o Produto
 *   placeholder "NAO_DISCRIMINADO". dosesVendidas e descontoConcedidoPorDose
 *   também não são exportados pelo ERP: ficam null, preenchimento manual
 *   futuro (mesma lacuna já documentada no schema para venda manual).
 * - Pedidos sem "Vendedor" reconhecido como Representante real (linhas do
 *   financeiro interno: "Vagno Reis", "Monte Sião Genética", ou vendedor
 *   vazio) são pulados — não são vendas comissionáveis de representante.
 * - Situação "Cancelado" -> Parcela.status = CANCELADA, sem BaixaParcela.
 * - Parcela com Valor Recebido > 0 gera BaixaParcela e aciona o MESMO
 *   serviço gerarApuracaoComissao usado pela baixa manual (ponto único de
 *   cálculo) — reps DESC_POL1/DESC_POL2/POLV3_LEGACY sem desconto informado
 *   ficam corretamente BLOQUEADA_DADO_MANUAL_FALTANTE, e reps META não geram
 *   ApuracaoComissao (resolvido na apuração de bonificação por ciclo).
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db/client";
import { calcularCiclo } from "@/lib/calculos/ciclo";
import { gerarApuracaoComissao } from "@/lib/servicos/gerarApuracaoComissao";

const ARQUIVO = path.join(process.cwd(), "data", "private", "vendas.json");
const ARQUIVO_MAPA_VENDEDORES = path.join(process.cwd(), "data", "private", "mapa-vendedores.json");

interface LinhaParcela {
  situacao: string;
  parcela: string;
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
  operacao: string | null;
  consideraNoFluxo: string | null;
  observacao: string | null;
}

// Normaliza "VAGNO REIS" / "Vagno Reis " / acentos para comparação robusta.
function normalizar(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

function parseDataIso(iso: string): Date {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

async function garantirProdutoPlaceholder(empresaId: string) {
  return prisma.produto.upsert({
    where: { codigoInterno: "NAO_DISCRIMINADO" },
    update: {},
    create: {
      empresaId,
      nomePadrao: "Produto não discriminado (importação Contas a Receber)",
      codigoInterno: "NAO_DISCRIMINADO",
      precoTabela: 0,
      categoria: "Importação",
      ativo: false,
    },
  });
}

async function main() {
  const linhas: LinhaParcela[] = JSON.parse(fs.readFileSync(ARQUIVO, "utf-8"));
  // Mapa Vendedor (Omie) -> nome do Representante real. Nomes fora deste
  // mapa são pulados (financeiro interno / house account). Fica em
  // data/private/ (gitignored) por conter nomes reais de representantes.
  const mapaVendedorRepresentante: Record<string, string> = JSON.parse(fs.readFileSync(ARQUIVO_MAPA_VENDEDORES, "utf-8"));

  const empresa = await prisma.empresa.findUniqueOrThrow({ where: { cnpj: "46583901000154" } });
  const usuarioAdmin = await prisma.usuario.findFirstOrThrow({ where: { perfil: "ADMIN", empresaId: empresa.id } });
  const produtoPlaceholder = await garantirProdutoPlaceholder(empresa.id);

  const representantes = await prisma.representante.findMany({ where: { empresaId: empresa.id } });
  const representantePorNome = new Map(representantes.map((r) => [normalizar(r.nome), r]));

  // Agrupa por "Pedido nº X" (operacao). Linhas sem operacao (rows de teste/avulsas) são puladas.
  const grupos = new Map<string, LinhaParcela[]>();
  for (const linha of linhas) {
    if (!linha.operacao) continue;
    const grupo = grupos.get(linha.operacao) ?? [];
    grupo.push(linha);
    grupos.set(linha.operacao, grupo);
  }

  let vendasCriadas = 0;
  let vendasPuladasSemRepresentante = 0;
  let vendasPuladasSemContrato = 0;
  let vendasJaExistentes = 0;
  let baixasCriadas = 0;

  for (const [operacao, grupoLinhas] of grupos) {
    const origemImportacaoId = `omie-${operacao.toLowerCase().replace(/\s+/g, "-")}`;

    const jaExiste = await prisma.venda.findFirst({ where: { origemImportacaoId } });
    if (jaExiste) {
      vendasJaExistentes++;
      continue;
    }

    const primeira = grupoLinhas[0];
    const vendedorNormalizado = primeira.vendedor ? normalizar(primeira.vendedor) : null;
    const nomeRepresentante = vendedorNormalizado ? mapaVendedorRepresentante[vendedorNormalizado] : undefined;
    const representante = nomeRepresentante ? representantePorNome.get(normalizar(nomeRepresentante)) : undefined;

    if (!representante) {
      vendasPuladasSemRepresentante++;
      continue;
    }

    if (!primeira.dataEmissao) continue;
    const dataVenda = parseDataIso(primeira.dataEmissao);
    const cicloId = calcularCiclo(dataVenda).cicloId;

    const contratoVigente = await prisma.contrato.findFirst({
      where: {
        representanteId: representante.id,
        vigenciaInicio: { lte: dataVenda },
        OR: [{ vigenciaFim: null }, { vigenciaFim: { gte: dataVenda } }],
      },
      orderBy: { vigenciaInicio: "desc" },
    });

    if (!contratoVigente) {
      vendasPuladasSemContrato++;
      console.log(`Pulado (sem contrato vigente em ${primeira.dataEmissao}): ${operacao} — ${representante.nome}`);
      continue;
    }

    // Cliente: casa por CNPJ/CPF; cria se não existir.
    const cpfCnpj = primeira.clienteCpfCnpj || null;
    let cliente = cpfCnpj ? await prisma.cliente.findUnique({ where: { cpfCnpj } }) : null;
    if (!cliente) {
      cliente = await prisma.cliente.create({
        data: {
          empresaId: empresa.id,
          nomePadrao: primeira.clienteNomeFantasia || primeira.clienteRazaoSocial,
          cpfCnpj,
        },
      });
    }

    const valorTotal = grupoLinhas.reduce((soma, l) => soma + l.valorConta, 0);

    await prisma.$transaction(async (tx) => {
      const venda = await tx.venda.create({
        data: {
          empresaId: empresa.id,
          clienteId: cliente.id,
          produtoId: produtoPlaceholder.id,
          representanteId: representante.id,
          contratoId: contratoVigente.id,
          numeroPedido: operacao,
          dataVenda,
          cicloId,
          valorTotal,
          quantidadeParcelas: grupoLinhas.length,
          origem: "IMPORTACAO",
          origemImportacaoId,
        },
      });

      for (const linha of grupoLinhas) {
        const numeroParcela = Number(linha.parcela.split("/")[0]) || 1;
        const status =
          linha.situacao === "Cancelado"
            ? ("CANCELADA" as const)
            : linha.valorRecebido > 0 && linha.valorAReceber <= 0
              ? ("RECEBIDA" as const)
              : linha.valorRecebido > 0
                ? ("RECEBIDA_PARCIAL" as const)
                : ("PENDENTE" as const);

        const parcela = await tx.parcela.create({
          data: {
            vendaId: venda.id,
            numeroParcela,
            valorParcela: linha.valorConta,
            dataVencimento: linha.vencimento ? parseDataIso(linha.vencimento) : dataVenda,
            status,
            origemImportacaoId: `${origemImportacaoId}-parcela-${numeroParcela}`,
          },
        });

        if (linha.valorRecebido > 0 && linha.ultimoRecebimento) {
          const dataRecebimento = parseDataIso(linha.ultimoRecebimento);
          const baixa = await tx.baixaParcela.create({
            data: {
              parcelaId: parcela.id,
              dataRecebimento,
              valorRecebido: linha.valorRecebido,
              cicloId: calcularCiclo(dataRecebimento).cicloId,
              origemImportacaoId: `${origemImportacaoId}-parcela-${numeroParcela}-baixa`,
            },
          });
          baixasCriadas++;
          await gerarApuracaoComissao(tx, baixa.id, usuarioAdmin.id);
        }
      }
    });

    vendasCriadas++;
  }

  console.log(`Vendas criadas: ${vendasCriadas}`);
  console.log(`Vendas já existentes (reexecução idempotente): ${vendasJaExistentes}`);
  console.log(`Pedidos pulados (sem representante mapeado — financeiro interno/house account): ${vendasPuladasSemRepresentante}`);
  console.log(`Pedidos pulados (sem contrato vigente na data): ${vendasPuladasSemContrato}`);
  console.log(`Baixas de parcela criadas (com apuração de comissão processada): ${baixasCriadas}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
