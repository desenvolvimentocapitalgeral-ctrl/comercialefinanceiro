/**
 * Importa dados reais de representantes, produtos e tabelas de desconto a
 * partir de data/private/*.json (gitignored — nunca commitado). Script local,
 * não faz parte do build/deploy. Idempotente: pode ser reexecutado.
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db/client";
import { calcularCiclo } from "@/lib/calculos/ciclo";
import { parseDataLocal } from "@/lib/utils/data";

const DIR = path.join(process.cwd(), "data", "private");

interface RepresentanteImportado {
  nome: string;
  cpfCnpj: string;
  email: string | null;
  telefone: string | null;
  ativo: boolean;
  tipoCalculo: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  statusContrato: string;
  bonusFixoValor: number | null;
  faturamentoMinimoBonus: number | null;
  metaQuantidadeDoses: number | null;
  percentualSemMeta: number | null;
  percentualExcedente: number | null;
  percentualFixo: number | null;
  multaConfidencialidadeMultiplicador: number | null;
  multaNaoConcorrenciaMultiplicador: number | null;
  multaDescumprimentoPercentual: number | null;
  observacoes: string | null;
}

interface ProdutoImportado {
  codigoInterno: string;
  nomePadrao: string;
  precoTabela: number;
  categoria: string | null;
  linhaGenetica: string | null;
}

interface FaixaDesconto {
  descontoMinimo: number;
  descontoMaximo: number;
  percentualComissao: number;
}

function limparCpfCnpj(valor: string): string {
  return valor.replace(/\D/g, "");
}

async function main() {
  const representantes: RepresentanteImportado[] = JSON.parse(fs.readFileSync(path.join(DIR, "representantes.json"), "utf-8"));
  const produtos: ProdutoImportado[] = JSON.parse(fs.readFileSync(path.join(DIR, "produtos.json"), "utf-8"));
  const tabelas: { DESC_POL1: FaixaDesconto[]; DESC_POL2: FaixaDesconto[] } = JSON.parse(
    fs.readFileSync(path.join(DIR, "tabela-desconto.json"), "utf-8"),
  );

  const empresa = await prisma.empresa.upsert({
    where: { cnpj: "46583901000154" },
    update: { razaoSocial: "Agropecuária Monte Sião Ltda", nomeFantasia: "Monte Sião Melhoramentos Genéticos" },
    create: {
      razaoSocial: "Agropecuária Monte Sião Ltda",
      nomeFantasia: "Monte Sião Melhoramentos Genéticos",
      cnpj: "46583901000154",
      diaInicioCiclo: 11,
      diaFimCiclo: 10,
    },
  });
  console.log("Empresa:", empresa.nomeFantasia);

  // Aponta o usuário ADMIN de dev para a empresa real, para enxergar os dados importados sem trocar de login.
  await prisma.usuario.updateMany({ where: { perfil: "ADMIN" }, data: { empresaId: empresa.id } });

  // --- Produtos ---
  let produtosCriados = 0;
  for (const p of produtos) {
    const existente = await prisma.produto.findUnique({ where: { codigoInterno: p.codigoInterno } });
    if (existente) continue;
    const produto = await prisma.produto.create({
      data: {
        empresaId: empresa.id,
        nomePadrao: p.nomePadrao,
        codigoInterno: p.codigoInterno,
        precoTabela: p.precoTabela,
        categoria: p.categoria,
        linhaGenetica: p.linhaGenetica,
      },
    });
    await prisma.produtoHistoricoPreco.create({
      data: { produtoId: produto.id, precoTabela: p.precoTabela, vigenciaInicio: new Date(), vigenciaFim: null },
    });
    produtosCriados++;
  }
  console.log(`Produtos: ${produtosCriados} criados, ${produtos.length - produtosCriados} já existiam.`);

  // --- Políticas comerciais (tabela de desconto DESC_POL1/DESC_POL2) ---
  const politicaIds: Record<string, string> = {};
  for (const tipo of ["DESC_POL1", "DESC_POL2"] as const) {
    const politica = await prisma.politicaComercial.upsert({
      where: { tipoCalculo_versao: { tipoCalculo: tipo, versao: "importada-2026" } },
      update: {},
      create: { empresaId: empresa.id, versao: "importada-2026", tipoCalculo: tipo, vigenciaCicloInicio: "2026-01" },
    });
    politicaIds[tipo] = politica.id;

    const jaTemFaixas = await prisma.tabelaDescontoComissao.count({ where: { politicaComercialId: politica.id } });
    if (jaTemFaixas === 0) {
      for (const faixa of tabelas[tipo]) {
        await prisma.tabelaDescontoComissao.create({
          data: {
            politicaComercialId: politica.id,
            descontoMinimo: faixa.descontoMinimo,
            descontoMaximo: faixa.descontoMaximo,
            percentualComissao: faixa.percentualComissao,
          },
        });
      }
    }
  }
  console.log("Políticas comerciais (DESC_POL1/DESC_POL2) com tabela de desconto prontas.");

  // --- Representantes + Contratos + Regras ---
  let repsCriados = 0;
  let repsExistentes = 0;
  let contratosCriados = 0;
  let bloqueados = 0;

  for (const r of representantes) {
    const cpfCnpj = limparCpfCnpj(r.cpfCnpj);
    if (!cpfCnpj) {
      console.log(`Pulado (sem CPF/CNPJ válido): ${r.nome}`);
      continue;
    }

    let representante = await prisma.representante.findUnique({ where: { cpfCnpj } });
    if (representante) {
      repsExistentes++;
    } else {
      representante = await prisma.representante.create({
        data: { empresaId: empresa.id, nome: r.nome, cpfCnpj, email: r.email, telefone: r.telefone, ativo: r.ativo, observacoes: r.observacoes },
      });
      repsCriados++;
    }

    const contratoExistente = await prisma.contrato.findFirst({ where: { representanteId: representante.id } });
    if (contratoExistente) continue; // idempotência: não duplica contrato em reexecuções

    const vigenciaInicio = parseDataLocal(r.vigenciaInicio);
    const vigenciaFim = r.vigenciaFim ? parseDataLocal(r.vigenciaFim) : null;
    const cicloIdInicio = calcularCiclo(vigenciaInicio).cicloId;

    const politicaComercialId = r.tipoCalculo === "DESC_POL1" || r.tipoCalculo === "DESC_POL2" ? politicaIds[r.tipoCalculo] : null;

    const contrato = await prisma.contrato.create({
      data: {
        representanteId: representante.id,
        politicaComercialId,
        vigenciaInicio,
        vigenciaFim,
        status: r.statusContrato as never,
        statusAssinatura: "PENDENTE_ASSINATURA_CONTRATADA",
        multaConfidencialidadeMultiplicador: r.multaConfidencialidadeMultiplicador,
        multaNaoConcorrenciaMultiplicador: r.multaNaoConcorrenciaMultiplicador,
        multaDescumprimentoPercentual: r.multaDescumprimentoPercentual,
      },
    });
    contratosCriados++;
    if (r.statusContrato === "SEM_TABELA_COMISSAO") bloqueados++;

    await prisma.regraComissao.create({
      data: {
        contratoId: contrato.id,
        tipoCalculo: r.tipoCalculo,
        percentual: r.percentualFixo,
        momentoApuracao: "RECEBIMENTO",
        vigenciaCicloInicio: cicloIdInicio,
      },
    });

    // Bonificação: só cria regra quando há meta/bônus definidos na fonte.
    const temBonificacao = r.bonusFixoValor !== null && (r.metaQuantidadeDoses !== null || r.faturamentoMinimoBonus !== null);
    if (temBonificacao) {
      const tipoMeta = r.metaQuantidadeDoses !== null ? "QUANTIDADE_DOSES" : "VALOR_FATURAMENTO";
      await prisma.regraBonificacao.create({
        data: {
          contratoId: contrato.id,
          tipoCalculo: r.tipoCalculo,
          tipoMeta,
          metaQuantidadeDoses: r.metaQuantidadeDoses,
          metaValorFaturamento: r.faturamentoMinimoBonus,
          baseCiclo: "RECEBIMENTO",
          bonusFixoValor: r.bonusFixoValor ?? 0,
          percentualSemMeta: r.percentualSemMeta ?? 0,
          percentualExcedente: r.percentualExcedente,
          vigenciaCicloInicio: cicloIdInicio,
        },
      });
    }
  }

  console.log(`Representantes: ${repsCriados} criados, ${repsExistentes} já existiam.`);
  console.log(`Contratos: ${contratosCriados} criados (${bloqueados} em SEM_TABELA_COMISSAO).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
