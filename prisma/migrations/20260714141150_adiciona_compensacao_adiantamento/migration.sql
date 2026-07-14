-- CreateTable
CREATE TABLE "compensacoes_adiantamento" (
    "id" TEXT NOT NULL,
    "adiantamentoId" TEXT NOT NULL,
    "pagamentoRegularId" TEXT NOT NULL,
    "valorCompensado" DECIMAL(14,2) NOT NULL,
    "criadoPorUsuarioId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compensacoes_adiantamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "compensacoes_adiantamento_adiantamentoId_idx" ON "compensacoes_adiantamento"("adiantamentoId");

-- CreateIndex
CREATE INDEX "compensacoes_adiantamento_pagamentoRegularId_idx" ON "compensacoes_adiantamento"("pagamentoRegularId");

-- AddForeignKey
ALTER TABLE "compensacoes_adiantamento" ADD CONSTRAINT "compensacoes_adiantamento_adiantamentoId_fkey" FOREIGN KEY ("adiantamentoId") REFERENCES "pagamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensacoes_adiantamento" ADD CONSTRAINT "compensacoes_adiantamento_pagamentoRegularId_fkey" FOREIGN KEY ("pagamentoRegularId") REFERENCES "pagamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
