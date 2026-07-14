-- CreateEnum
CREATE TYPE "PerfilUsuario" AS ENUM ('ADMIN', 'FINANCEIRO', 'REPRESENTANTE');

-- CreateEnum
CREATE TYPE "StatusContrato" AS ENUM ('ATIVO', 'ENCERRADO', 'RESCISAO_PENDENTE_FORMALIZACAO', 'SEM_TABELA_COMISSAO');

-- CreateEnum
CREATE TYPE "StatusAssinaturaContrato" AS ENUM ('COMPLETA', 'PENDENTE_ASSINATURA_CONTRATADA', 'PENDENTE_ASSINATURA_CONTRATANTE');

-- CreateEnum
CREATE TYPE "MomentoApuracaoComissao" AS ENUM ('FATURAMENTO', 'RECEBIMENTO');

-- CreateEnum
CREATE TYPE "TipoMetaBonificacao" AS ENUM ('QUANTIDADE_DOSES', 'VALOR_FATURAMENTO');

-- CreateEnum
CREATE TYPE "BaseCicloBonificacao" AS ENUM ('FATURAMENTO', 'RECEBIMENTO');

-- CreateEnum
CREATE TYPE "StatusParcela" AS ENUM ('PENDENTE', 'RECEBIDA', 'RECEBIDA_PARCIAL', 'CANCELADA', 'RENEGOCIADA');

-- CreateEnum
CREATE TYPE "StatusApuracao" AS ENUM ('PENDENTE', 'APROVADA', 'PAGA', 'CANCELADA', 'BLOQUEADA_DADO_MANUAL_FALTANTE');

-- CreateEnum
CREATE TYPE "StatusImportacao" AS ENUM ('PROCESSANDO', 'CONCLUIDA', 'CONCLUIDA_COM_ERROS', 'FALHOU');

-- CreateEnum
CREATE TYPE "TipoImportacao" AS ENUM ('PRODUTOS', 'CLIENTES', 'CONTAS_A_RECEBER');

-- CreateEnum
CREATE TYPE "TipoPagamento" AS ENUM ('REGULAR', 'ADIANTAMENTO');

-- CreateTable
CREATE TABLE "empresas" (
    "id" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "diaInicioCiclo" INTEGER NOT NULL DEFAULT 11,
    "diaFimCiclo" INTEGER NOT NULL DEFAULT 10,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "perfil" "PerfilUsuario" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "representantes" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "nome" TEXT NOT NULL,
    "cpfCnpj" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "representantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "representante_aliases" (
    "id" TEXT NOT NULL,
    "representanteId" TEXT NOT NULL,
    "nomeOrigem" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "representante_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dados_bancarios_representante" (
    "id" TEXT NOT NULL,
    "representanteId" TEXT NOT NULL,
    "titularDivergente" BOOLEAN NOT NULL DEFAULT false,
    "nomeTitular" TEXT NOT NULL,
    "cpfCnpjTitular" TEXT NOT NULL,
    "banco" TEXT NOT NULL,
    "agencia" TEXT NOT NULL,
    "conta" TEXT NOT NULL,
    "chavePix" TEXT,
    "anexoAutorizacaoUrl" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dados_bancarios_representante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "politicas_comerciais" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "versao" TEXT NOT NULL,
    "tipoCalculo" TEXT NOT NULL,
    "vigenciaCicloInicio" TEXT NOT NULL,
    "bonusFixoValor" DECIMAL(14,2),
    "faturamentoMinimoBonus" DECIMAL(14,2),
    "arquivoOriginalUrl" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "politicas_comerciais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tabelas_desconto_comissao" (
    "id" TEXT NOT NULL,
    "politicaComercialId" TEXT NOT NULL,
    "descontoMinimo" DECIMAL(10,2) NOT NULL,
    "descontoMaximo" DECIMAL(10,2) NOT NULL,
    "percentualComissao" DECIMAL(6,3) NOT NULL,

    CONSTRAINT "tabelas_desconto_comissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contratos" (
    "id" TEXT NOT NULL,
    "representanteId" TEXT NOT NULL,
    "politicaComercialId" TEXT,
    "numero" TEXT,
    "vigenciaInicio" TIMESTAMP(3) NOT NULL,
    "vigenciaFim" TIMESTAMP(3),
    "status" "StatusContrato" NOT NULL DEFAULT 'ATIVO',
    "statusAssinatura" "StatusAssinaturaContrato" NOT NULL DEFAULT 'PENDENTE_ASSINATURA_CONTRATADA',
    "multaConfidencialidadeMultiplicador" DECIMAL(5,2),
    "multaNaoConcorrenciaMultiplicador" DECIMAL(5,2),
    "multaDescumprimentoPercentual" DECIMAL(5,2),
    "arquivoOriginalUrl" TEXT,
    "resumoIA" TEXT,
    "clausulasDuvidosas" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regras_comissao" (
    "id" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "tipoCalculo" TEXT NOT NULL,
    "percentual" DECIMAL(6,3),
    "momentoApuracao" "MomentoApuracaoComissao" NOT NULL DEFAULT 'RECEBIMENTO',
    "aplicaSobre" TEXT,
    "condicoesEspeciais" TEXT,
    "vigenciaCicloInicio" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regras_comissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regras_bonificacao" (
    "id" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "tipoCalculo" TEXT NOT NULL,
    "tipoMeta" "TipoMetaBonificacao" NOT NULL,
    "metaQuantidadeDoses" INTEGER,
    "metaValorFaturamento" DECIMAL(14,2),
    "baseCiclo" "BaseCicloBonificacao" NOT NULL DEFAULT 'FATURAMENTO',
    "bonusFixoValor" DECIMAL(14,2) NOT NULL,
    "percentualSemMeta" DECIMAL(6,3) NOT NULL,
    "percentualExcedente" DECIMAL(6,3),
    "faixasEscalonadas" JSONB,
    "condicoesPerda" TEXT,
    "prorateaPrimeiroCiclo" BOOLEAN NOT NULL DEFAULT false,
    "vigenciaCicloInicio" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regras_bonificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produtos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nomePadrao" TEXT NOT NULL,
    "codigoInterno" TEXT NOT NULL,
    "precoTabela" DECIMAL(10,2) NOT NULL,
    "ranking" INTEGER,
    "linhaGenetica" TEXT,
    "pedigree" JSONB,
    "categoria" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produto_historico_preco" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "precoTabela" DECIMAL(10,2) NOT NULL,
    "vigenciaInicio" TIMESTAMP(3) NOT NULL,
    "vigenciaFim" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "produto_historico_preco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produto_aliases" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "nomeOrigem" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "produto_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nomePadrao" TEXT NOT NULL,
    "cpfCnpj" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente_aliases" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "nomeOrigem" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cliente_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campanhas" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3) NOT NULL,
    "percentualComissaoEspecial" DECIMAL(6,3),
    "categoriaProdutoAlvo" TEXT,
    "produtoIdAlvo" TEXT,
    "representanteIdAlvo" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campanhas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendas" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "representanteId" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "numeroPedido" TEXT,
    "dataVenda" TIMESTAMP(3) NOT NULL,
    "dataEntregaFisica" TIMESTAMP(3),
    "cicloId" TEXT NOT NULL,
    "valorTotal" DECIMAL(14,2) NOT NULL,
    "quantidadeParcelas" INTEGER NOT NULL,
    "dosesVendidas" INTEGER,
    "descontoConcedidoPorDose" DECIMAL(10,2),
    "origem" TEXT NOT NULL DEFAULT 'IMPORTACAO',
    "vendaAutorizadaExcepcionalmente" BOOLEAN NOT NULL DEFAULT false,
    "percentualRessarcimentoRisco" DECIMAL(5,2),
    "origemImportacaoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parcelas" (
    "id" TEXT NOT NULL,
    "vendaId" TEXT NOT NULL,
    "numeroParcela" INTEGER NOT NULL,
    "valorParcela" DECIMAL(14,2) NOT NULL,
    "dataVencimento" TIMESTAMP(3) NOT NULL,
    "status" "StatusParcela" NOT NULL DEFAULT 'PENDENTE',
    "parcelaOrigemRenegociacaoId" TEXT,
    "origemImportacaoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parcelas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baixas_parcela" (
    "id" TEXT NOT NULL,
    "parcelaId" TEXT NOT NULL,
    "dataRecebimento" TIMESTAMP(3) NOT NULL,
    "valorRecebido" DECIMAL(14,2) NOT NULL,
    "cicloId" TEXT NOT NULL,
    "origemImportacaoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "baixas_parcela_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apuracoes_comissao" (
    "id" TEXT NOT NULL,
    "parcelaId" TEXT NOT NULL,
    "baixaParcelaId" TEXT,
    "representanteId" TEXT NOT NULL,
    "regraComissaoId" TEXT NOT NULL,
    "campanhaId" TEXT,
    "cicloId" TEXT NOT NULL,
    "valorBase" DECIMAL(14,2) NOT NULL,
    "percentualAplicado" DECIMAL(6,3) NOT NULL,
    "valorComissao" DECIMAL(14,2) NOT NULL,
    "status" "StatusApuracao" NOT NULL DEFAULT 'PENDENTE',
    "motivoBloqueio" TEXT,
    "calculadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apuracoes_comissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estornos_comissao" (
    "id" TEXT NOT NULL,
    "apuracaoComissaoId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "valorEstornado" DECIMAL(14,2) NOT NULL,
    "cicloDoEstorno" TEXT NOT NULL,
    "descontarDeProximoPagamento" BOOLEAN NOT NULL DEFAULT true,
    "compensado" BOOLEAN NOT NULL DEFAULT false,
    "criadoPorUsuarioId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estornos_comissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apuracoes_bonificacao" (
    "id" TEXT NOT NULL,
    "representanteId" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "regraBonificacaoId" TEXT NOT NULL,
    "cicloId" TEXT NOT NULL,
    "valorApurado" DECIMAL(14,2) NOT NULL,
    "dosesApuradas" INTEGER,
    "metaValor" DECIMAL(14,2) NOT NULL,
    "percentualAtingimento" DECIMAL(6,2) NOT NULL,
    "bateuMeta" BOOLEAN NOT NULL,
    "motivoPerda" TEXT,
    "valorBonificacao" DECIMAL(14,2) NOT NULL,
    "status" "StatusApuracao" NOT NULL DEFAULT 'PENDENTE',
    "calculadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apuracoes_bonificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajustes_bonificacao" (
    "id" TEXT NOT NULL,
    "apuracaoBonificacaoId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "valorAjuste" DECIMAL(14,2) NOT NULL,
    "criadoPorUsuarioId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajustes_bonificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos" (
    "id" TEXT NOT NULL,
    "representanteId" TEXT NOT NULL,
    "tipo" "TipoPagamento" NOT NULL DEFAULT 'REGULAR',
    "dataPagamento" TIMESTAMP(3) NOT NULL,
    "valorTotal" DECIMAL(14,2) NOT NULL,
    "comprovanteUrl" TEXT,
    "reciboUrl" TEXT,
    "assinaturaConfirmadaEm" TIMESTAMP(3),
    "assinaturaIp" TEXT,
    "aprovadoPorUsuarioId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamento_itens" (
    "id" TEXT NOT NULL,
    "pagamentoId" TEXT NOT NULL,
    "apuracaoComissaoId" TEXT,
    "apuracaoBonificacaoId" TEXT,
    "valor" DECIMAL(14,2) NOT NULL,
    "valorPago" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "pagamento_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs_auditoria" (
    "id" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "valorAnterior" JSONB,
    "valorNovo" JSONB,
    "usuarioId" TEXT NOT NULL,
    "motivo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "importacoes_arquivo" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "tipo" "TipoImportacao" NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "urlArquivo" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "status" "StatusImportacao" NOT NULL DEFAULT 'PROCESSANDO',
    "linhasProcessadas" INTEGER NOT NULL DEFAULT 0,
    "linhasComErro" INTEGER NOT NULL DEFAULT 0,
    "logErros" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidoEm" TIMESTAMP(3),

    CONSTRAINT "importacoes_arquivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empresas_cnpj_key" ON "empresas"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_empresaId_idx" ON "usuarios"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "representantes_usuarioId_key" ON "representantes"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "representantes_cpfCnpj_key" ON "representantes"("cpfCnpj");

-- CreateIndex
CREATE INDEX "representantes_empresaId_idx" ON "representantes"("empresaId");

-- CreateIndex
CREATE INDEX "representante_aliases_representanteId_idx" ON "representante_aliases"("representanteId");

-- CreateIndex
CREATE UNIQUE INDEX "representante_aliases_nomeOrigem_origem_key" ON "representante_aliases"("nomeOrigem", "origem");

-- CreateIndex
CREATE UNIQUE INDEX "dados_bancarios_representante_representanteId_key" ON "dados_bancarios_representante"("representanteId");

-- CreateIndex
CREATE INDEX "politicas_comerciais_empresaId_vigenciaCicloInicio_idx" ON "politicas_comerciais"("empresaId", "vigenciaCicloInicio");

-- CreateIndex
CREATE UNIQUE INDEX "politicas_comerciais_tipoCalculo_versao_key" ON "politicas_comerciais"("tipoCalculo", "versao");

-- CreateIndex
CREATE INDEX "tabelas_desconto_comissao_politicaComercialId_idx" ON "tabelas_desconto_comissao"("politicaComercialId");

-- CreateIndex
CREATE INDEX "contratos_representanteId_vigenciaInicio_idx" ON "contratos"("representanteId", "vigenciaInicio");

-- CreateIndex
CREATE INDEX "regras_comissao_contratoId_vigenciaCicloInicio_idx" ON "regras_comissao"("contratoId", "vigenciaCicloInicio");

-- CreateIndex
CREATE INDEX "regras_bonificacao_contratoId_vigenciaCicloInicio_idx" ON "regras_bonificacao"("contratoId", "vigenciaCicloInicio");

-- CreateIndex
CREATE UNIQUE INDEX "produtos_codigoInterno_key" ON "produtos"("codigoInterno");

-- CreateIndex
CREATE INDEX "produtos_empresaId_idx" ON "produtos"("empresaId");

-- CreateIndex
CREATE INDEX "produto_historico_preco_produtoId_vigenciaInicio_idx" ON "produto_historico_preco"("produtoId", "vigenciaInicio");

-- CreateIndex
CREATE INDEX "produto_aliases_produtoId_idx" ON "produto_aliases"("produtoId");

-- CreateIndex
CREATE UNIQUE INDEX "produto_aliases_nomeOrigem_origem_key" ON "produto_aliases"("nomeOrigem", "origem");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_cpfCnpj_key" ON "clientes"("cpfCnpj");

-- CreateIndex
CREATE INDEX "clientes_empresaId_idx" ON "clientes"("empresaId");

-- CreateIndex
CREATE INDEX "cliente_aliases_clienteId_idx" ON "cliente_aliases"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_aliases_nomeOrigem_origem_key" ON "cliente_aliases"("nomeOrigem", "origem");

-- CreateIndex
CREATE INDEX "campanhas_empresaId_dataInicio_dataFim_idx" ON "campanhas"("empresaId", "dataInicio", "dataFim");

-- CreateIndex
CREATE INDEX "vendas_empresaId_cicloId_idx" ON "vendas"("empresaId", "cicloId");

-- CreateIndex
CREATE INDEX "vendas_representanteId_cicloId_idx" ON "vendas"("representanteId", "cicloId");

-- CreateIndex
CREATE INDEX "vendas_clienteId_idx" ON "vendas"("clienteId");

-- CreateIndex
CREATE INDEX "vendas_produtoId_idx" ON "vendas"("produtoId");

-- CreateIndex
CREATE INDEX "parcelas_status_idx" ON "parcelas"("status");

-- CreateIndex
CREATE UNIQUE INDEX "parcelas_vendaId_numeroParcela_key" ON "parcelas"("vendaId", "numeroParcela");

-- CreateIndex
CREATE INDEX "baixas_parcela_parcelaId_idx" ON "baixas_parcela"("parcelaId");

-- CreateIndex
CREATE INDEX "baixas_parcela_cicloId_idx" ON "baixas_parcela"("cicloId");

-- CreateIndex
CREATE UNIQUE INDEX "apuracoes_comissao_baixaParcelaId_key" ON "apuracoes_comissao"("baixaParcelaId");

-- CreateIndex
CREATE INDEX "apuracoes_comissao_representanteId_cicloId_idx" ON "apuracoes_comissao"("representanteId", "cicloId");

-- CreateIndex
CREATE INDEX "apuracoes_comissao_status_idx" ON "apuracoes_comissao"("status");

-- CreateIndex
CREATE INDEX "estornos_comissao_apuracaoComissaoId_idx" ON "estornos_comissao"("apuracaoComissaoId");

-- CreateIndex
CREATE INDEX "apuracoes_bonificacao_representanteId_cicloId_idx" ON "apuracoes_bonificacao"("representanteId", "cicloId");

-- CreateIndex
CREATE INDEX "apuracoes_bonificacao_status_idx" ON "apuracoes_bonificacao"("status");

-- CreateIndex
CREATE UNIQUE INDEX "apuracoes_bonificacao_representanteId_regraBonificacaoId_ci_key" ON "apuracoes_bonificacao"("representanteId", "regraBonificacaoId", "cicloId");

-- CreateIndex
CREATE INDEX "ajustes_bonificacao_apuracaoBonificacaoId_idx" ON "ajustes_bonificacao"("apuracaoBonificacaoId");

-- CreateIndex
CREATE INDEX "pagamentos_representanteId_idx" ON "pagamentos"("representanteId");

-- CreateIndex
CREATE INDEX "pagamento_itens_pagamentoId_idx" ON "pagamento_itens"("pagamentoId");

-- CreateIndex
CREATE INDEX "logs_auditoria_entidade_entidadeId_idx" ON "logs_auditoria"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "logs_auditoria_usuarioId_idx" ON "logs_auditoria"("usuarioId");

-- CreateIndex
CREATE INDEX "importacoes_arquivo_empresaId_tipo_criadoEm_idx" ON "importacoes_arquivo"("empresaId", "tipo", "criadoEm");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "representantes" ADD CONSTRAINT "representantes_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "representantes" ADD CONSTRAINT "representantes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "representante_aliases" ADD CONSTRAINT "representante_aliases_representanteId_fkey" FOREIGN KEY ("representanteId") REFERENCES "representantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dados_bancarios_representante" ADD CONSTRAINT "dados_bancarios_representante_representanteId_fkey" FOREIGN KEY ("representanteId") REFERENCES "representantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "politicas_comerciais" ADD CONSTRAINT "politicas_comerciais_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tabelas_desconto_comissao" ADD CONSTRAINT "tabelas_desconto_comissao_politicaComercialId_fkey" FOREIGN KEY ("politicaComercialId") REFERENCES "politicas_comerciais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_representanteId_fkey" FOREIGN KEY ("representanteId") REFERENCES "representantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_politicaComercialId_fkey" FOREIGN KEY ("politicaComercialId") REFERENCES "politicas_comerciais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regras_comissao" ADD CONSTRAINT "regras_comissao_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regras_bonificacao" ADD CONSTRAINT "regras_bonificacao_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produto_historico_preco" ADD CONSTRAINT "produto_historico_preco_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produto_aliases" ADD CONSTRAINT "produto_aliases_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_aliases" ADD CONSTRAINT "cliente_aliases_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanhas" ADD CONSTRAINT "campanhas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_representanteId_fkey" FOREIGN KEY ("representanteId") REFERENCES "representantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendas" ADD CONSTRAINT "vendas_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "contratos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcelas" ADD CONSTRAINT "parcelas_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "vendas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcelas" ADD CONSTRAINT "parcelas_parcelaOrigemRenegociacaoId_fkey" FOREIGN KEY ("parcelaOrigemRenegociacaoId") REFERENCES "parcelas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baixas_parcela" ADD CONSTRAINT "baixas_parcela_parcelaId_fkey" FOREIGN KEY ("parcelaId") REFERENCES "parcelas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apuracoes_comissao" ADD CONSTRAINT "apuracoes_comissao_parcelaId_fkey" FOREIGN KEY ("parcelaId") REFERENCES "parcelas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apuracoes_comissao" ADD CONSTRAINT "apuracoes_comissao_baixaParcelaId_fkey" FOREIGN KEY ("baixaParcelaId") REFERENCES "baixas_parcela"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apuracoes_comissao" ADD CONSTRAINT "apuracoes_comissao_campanhaId_fkey" FOREIGN KEY ("campanhaId") REFERENCES "campanhas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estornos_comissao" ADD CONSTRAINT "estornos_comissao_apuracaoComissaoId_fkey" FOREIGN KEY ("apuracaoComissaoId") REFERENCES "apuracoes_comissao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apuracoes_bonificacao" ADD CONSTRAINT "apuracoes_bonificacao_regraBonificacaoId_fkey" FOREIGN KEY ("regraBonificacaoId") REFERENCES "regras_bonificacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes_bonificacao" ADD CONSTRAINT "ajustes_bonificacao_apuracaoBonificacaoId_fkey" FOREIGN KEY ("apuracaoBonificacaoId") REFERENCES "apuracoes_bonificacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_representanteId_fkey" FOREIGN KEY ("representanteId") REFERENCES "representantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamento_itens" ADD CONSTRAINT "pagamento_itens_pagamentoId_fkey" FOREIGN KEY ("pagamentoId") REFERENCES "pagamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamento_itens" ADD CONSTRAINT "pagamento_itens_apuracaoComissaoId_fkey" FOREIGN KEY ("apuracaoComissaoId") REFERENCES "apuracoes_comissao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamento_itens" ADD CONSTRAINT "pagamento_itens_apuracaoBonificacaoId_fkey" FOREIGN KEY ("apuracaoBonificacaoId") REFERENCES "apuracoes_bonificacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importacoes_arquivo" ADD CONSTRAINT "importacoes_arquivo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
