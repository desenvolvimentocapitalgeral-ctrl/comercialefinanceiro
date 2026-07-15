import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth/config";
import { cicloComercialDoId } from "@/lib/calculos/ciclo";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { BotaoImprimir } from "@/components/ui/BotaoImprimir";

const FORMATO_MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_LABEL: Record<string, { label: string; cor: "verde" | "ambar" | "vermelho" | "neutro" | "azul" }> = {
  PENDENTE: { label: "Pendente", cor: "ambar" },
  APROVADA: { label: "Aprovada", cor: "azul" },
  PAGA: { label: "Paga", cor: "verde" },
  CANCELADA: { label: "Cancelada", cor: "neutro" },
};

export default async function ReciboBonificacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessao = await auth();
  const empresaId = sessao!.user.empresaId;

  const apuracao = await prisma.apuracaoBonificacao.findUnique({
    where: { id },
    include: { regraBonificacao: true, pagamentoItens: { include: { pagamento: true } } },
  });
  if (!apuracao) notFound();

  const [empresa, representante] = await Promise.all([
    prisma.empresa.findUniqueOrThrow({ where: { id: empresaId } }),
    prisma.representante.findUniqueOrThrow({ where: { id: apuracao.representanteId } }),
  ]);
  if (representante.empresaId !== empresaId) notFound();

  const ciclo = cicloComercialDoId(apuracao.cicloId);
  const pagamento = apuracao.pagamentoItens[0]?.pagamento ?? null;
  const regra = apuracao.regraBonificacao;

  const metaLabel =
    apuracao.dosesApuradas !== null
      ? `${Number(apuracao.metaValor)} doses`
      : FORMATO_MOEDA.format(Number(apuracao.metaValor));
  const apuradoLabel =
    apuracao.dosesApuradas !== null ? `${apuracao.dosesApuradas} doses` : FORMATO_MOEDA.format(Number(apuracao.valorApurado));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-8 print:p-0">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Recibo de bonificação/comissão</h1>
        <BotaoImprimir />
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-8 text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 print:border-0 print:p-0">
        <div className="flex items-start justify-between border-b border-neutral-200 pb-4 dark:border-neutral-800">
          <div>
            <p className="font-semibold">{empresa.nomeFantasia}</p>
            <p className="text-sm text-neutral-500">{empresa.razaoSocial}</p>
            <p className="text-sm text-neutral-500">CNPJ: {empresa.cnpj}</p>
          </div>
          <div className="text-right text-sm text-neutral-500">
            <p>Recibo</p>
            <p className="numerico">{apuracao.id.slice(-8).toUpperCase()}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 border-b border-neutral-200 pb-4 dark:border-neutral-800">
          <div>
            <p className="text-xs text-neutral-500">Representante</p>
            <p className="font-medium">{representante.nome}</p>
            <p className="text-sm text-neutral-500">{representante.cpfCnpj}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Ciclo comercial</p>
            <p className="font-medium">{apuracao.cicloId}</p>
            <p className="text-sm text-neutral-500">{ciclo.label}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4 border-b border-neutral-200 pb-4 dark:border-neutral-800">
          <div>
            <p className="text-xs text-neutral-500">Meta</p>
            <p className="numerico font-medium">{metaLabel}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Apurado</p>
            <p className="numerico font-medium">{apuradoLabel}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Bateu meta?</p>
            <StatusBadge label={apuracao.bateuMeta ? "Sim" : "Não"} cor={apuracao.bateuMeta ? "verde" : "ambar"} />
          </div>
        </div>

        <table className="mt-4 w-full text-left text-sm">
          <tbody>
            <tr className="border-b border-neutral-100 dark:border-neutral-800">
              <td className="py-2 text-neutral-600 dark:text-neutral-400">
                Bonificação (fixa){apuracao.bateuMeta ? ` — bônus por atingir a meta` : ""}
              </td>
              <td className="py-2 numerico text-right font-medium">{FORMATO_MOEDA.format(Number(apuracao.valorBonusFixo))}</td>
            </tr>
            <tr className="border-b border-neutral-100 dark:border-neutral-800">
              <td className="py-2 text-neutral-600 dark:text-neutral-400">
                Comissão (variável){!apuracao.bateuMeta ? ` — ${Number(regra.percentualSemMeta)}% sobre o valor apurado` : " — sobre o excedente da meta"}
              </td>
              <td className="py-2 numerico text-right font-medium">{FORMATO_MOEDA.format(Number(apuracao.valorComissaoVariavel))}</td>
            </tr>
            {apuracao.motivoPerda && (
              <tr>
                <td colSpan={2} className="py-2 text-xs text-neutral-500">
                  ⚠ {apuracao.motivoPerda}
                </td>
              </tr>
            )}
            <tr className="border-t-2 border-neutral-300 dark:border-neutral-700">
              <td className="py-2 font-semibold">Total</td>
              <td className="py-2 numerico text-right text-lg font-semibold">{FORMATO_MOEDA.format(Number(apuracao.valorBonificacao))}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-6 flex items-center justify-between border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <div>
            <p className="text-xs text-neutral-500">Status</p>
            <StatusBadge label={STATUS_LABEL[apuracao.status].label} cor={STATUS_LABEL[apuracao.status].cor} />
          </div>
          {pagamento && (
            <div className="text-right">
              <p className="text-xs text-neutral-500">Data do pagamento</p>
              <p className="font-medium">{pagamento.dataPagamento.toLocaleDateString("pt-BR")}</p>
            </div>
          )}
        </div>

        <p className="mt-8 text-center text-xs text-neutral-400">Documento gerado pelo sistema — apuração calculada em {apuracao.calculadoEm.toLocaleString("pt-BR")}.</p>
      </div>
    </div>
  );
}
