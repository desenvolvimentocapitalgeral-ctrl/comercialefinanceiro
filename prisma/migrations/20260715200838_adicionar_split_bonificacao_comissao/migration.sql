-- AlterTable
ALTER TABLE "apuracoes_bonificacao" ADD COLUMN     "valorBonusFixo" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "valorComissaoVariavel" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "regras_bonificacao" ADD COLUMN     "limiarExcedenteDoses" INTEGER;
