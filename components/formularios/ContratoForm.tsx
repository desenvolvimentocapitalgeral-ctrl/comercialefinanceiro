"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  contratoSchema,
  TIPOS_CALCULO,
  MOMENTOS_APURACAO,
  TIPOS_META,
  BASES_CICLO,
  type ContratoFormValues,
} from "@/lib/validacoes/contrato";
import { criarContrato } from "@/app/(dashboard)/contratos/actions";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

/** Campo numérico opcional: input vazio deve virar `undefined`, nunca NaN (valueAsNumber converteria "" para NaN). */
function comoNumeroOpcional(valor: string): number | undefined {
  return valor === "" ? undefined : Number(valor);
}

const LABEL_TIPO_CALCULO: Record<(typeof TIPOS_CALCULO)[number], string> = {
  DESC_POL1: "Tabela de desconto por dose — com bônus (DESC_POL1)",
  DESC_POL2: "Tabela de desconto por dose — sem bônus (DESC_POL2)",
  META: "Meta de doses (META)",
  POLV3_LEGACY: "Faixa por faturamento do ciclo — legado (POLV3_LEGACY)",
  FIXO: "Valor fixo mensal + excedente (FIXO)",
  SEMTAB: "Sem tabela definida — bloqueia cálculo (SEMTAB)",
};

interface RepresentanteOpcao {
  id: string;
  nome: string;
}

interface ContratoFormProps {
  representantes: RepresentanteOpcao[];
  valoresIniciais?: Partial<ContratoFormValues>;
  metadadosIA?: { resumoIA?: string; clausulasDuvidosas?: string[] };
}

export function ContratoForm({ representantes, valoresIniciais, metadadosIA }: ContratoFormProps) {
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [sobreposicao, setSobreposicao] = useState<{ dados: ContratoFormValues; contratoAnteriorNumero: string | null } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ContratoFormValues>({
    resolver: zodResolver(contratoSchema),
    defaultValues: {
      representanteId: "",
      numero: "",
      vigenciaInicio: "",
      vigenciaFim: "",
      regraComissao: { tipoCalculo: "DESC_POL1", momentoApuracao: "RECEBIMENTO", aplicaSobre: "", condicoesEspeciais: "" },
      temBonificacao: false,
      regraBonificacao: { tipoCalculo: "DESC_POL1", tipoMeta: "VALOR_FATURAMENTO", baseCiclo: "FATURAMENTO", bonusFixoValor: 0, percentualSemMeta: 0 },
      ...valoresIniciais,
    },
  });

  const temBonificacao = watch("temBonificacao");
  const tipoMeta = watch("regraBonificacao.tipoMeta");

  async function onSubmit(dados: ContratoFormValues) {
    setErroServidor(null);
    setEnviando(true);
    const resultado = await criarContrato(dados, false, metadadosIA);
    setEnviando(false);

    if (!resultado.sucesso && resultado.codigo === "SOBREPOSICAO_VIGENCIA") {
      setSobreposicao({ dados, contratoAnteriorNumero: resultado.contratoAnteriorNumero });
      return;
    }

    if (!resultado.sucesso) {
      setErroServidor(resultado.erro);
      return;
    }

    router.push("/contratos");
    router.refresh();
  }

  async function confirmarEncerramentoAnterior() {
    if (!sobreposicao) return;
    setEnviando(true);
    const resultado = await criarContrato(sobreposicao.dados, true, metadadosIA);
    setEnviando(false);
    setSobreposicao(null);

    if (!resultado.sucesso) {
      setErroServidor(resultado.erro);
      return;
    }

    router.push("/contratos");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-2xl flex-col gap-6" noValidate>
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">Dados do contrato</legend>

        <Campo label="Representante" erro={errors.representanteId?.message}>
          <select className="input" {...register("representanteId")}>
            <option value="">Selecione...</option>
            {representantes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Número/referência (opcional)" erro={errors.numero?.message}>
          <input className="input" {...register("numero")} />
        </Campo>

        <div className="grid grid-cols-2 gap-4">
          <Campo label="Vigência início" erro={errors.vigenciaInicio?.message}>
            <input className="input" type="date" {...register("vigenciaInicio")} />
          </Campo>
          <Campo label="Vigência fim (opcional)" erro={errors.vigenciaFim?.message}>
            <input className="input" type="date" {...register("vigenciaFim")} />
          </Campo>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Campo label="Multa confidencialidade (x)" erro={errors.multaConfidencialidadeMultiplicador?.message}>
            <input className="input" type="number" step="0.1" {...register("multaConfidencialidadeMultiplicador", { setValueAs: comoNumeroOpcional })} />
          </Campo>
          <Campo label="Multa não-concorrência (x)" erro={errors.multaNaoConcorrenciaMultiplicador?.message}>
            <input className="input" type="number" step="0.1" {...register("multaNaoConcorrenciaMultiplicador", { setValueAs: comoNumeroOpcional })} />
          </Campo>
          <Campo label="Multa descumprimento (%)" erro={errors.multaDescumprimentoPercentual?.message}>
            <input className="input" type="number" step="0.1" {...register("multaDescumprimentoPercentual", { setValueAs: comoNumeroOpcional })} />
          </Campo>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <legend className="mb-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">Regra de comissão</legend>

        <Campo label="Motor de cálculo" erro={errors.regraComissao?.tipoCalculo?.message}>
          <select className="input" {...register("regraComissao.tipoCalculo")}>
            {TIPOS_CALCULO.map((tipo) => (
              <option key={tipo} value={tipo}>
                {LABEL_TIPO_CALCULO[tipo]}
              </option>
            ))}
          </select>
        </Campo>

        <Campo label="Percentual (usado apenas no motor FIXO / percentual único)" erro={errors.regraComissao?.percentual?.message}>
          <input className="input" type="number" step="0.001" {...register("regraComissao.percentual", { setValueAs: comoNumeroOpcional })} />
        </Campo>

        <Campo label="Momento de apuração" erro={errors.regraComissao?.momentoApuracao?.message}>
          <select className="input" {...register("regraComissao.momentoApuracao")}>
            <option value="RECEBIMENTO">Recebimento da parcela (padrão)</option>
            <option value="FATURAMENTO">Faturamento (exceção)</option>
          </select>
        </Campo>

        <Campo label="Aplica sobre (categoria de produto — vazio = todos)" erro={errors.regraComissao?.aplicaSobre?.message}>
          <input className="input" {...register("regraComissao.aplicaSobre")} />
        </Campo>

        <Campo label="Condições especiais" erro={errors.regraComissao?.condicoesEspeciais?.message}>
          <textarea className="input" rows={2} {...register("regraComissao.condicoesEspeciais")} />
        </Campo>
      </fieldset>

      <fieldset className="flex flex-col gap-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <label className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          <input type="checkbox" {...register("temBonificacao")} />
          Este contrato tem bonificação
        </label>

        {temBonificacao && (
          <div className="flex flex-col gap-4">
            <Campo label="Motor de cálculo" erro={errors.regraBonificacao?.tipoCalculo?.message}>
              <select className="input" {...register("regraBonificacao.tipoCalculo")}>
                {TIPOS_CALCULO.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {LABEL_TIPO_CALCULO[tipo]}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo label="Tipo de meta" erro={errors.regraBonificacao?.tipoMeta?.message}>
              <select className="input" {...register("regraBonificacao.tipoMeta")}>
                {TIPOS_META.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo === "QUANTIDADE_DOSES" ? "Quantidade de doses" : "Valor de faturamento (R$)"}
                  </option>
                ))}
              </select>
            </Campo>

            {tipoMeta === "QUANTIDADE_DOSES" ? (
              <Campo label="Meta em doses/ciclo" erro={errors.regraBonificacao?.metaQuantidadeDoses?.message}>
                <input className="input" type="number" {...register("regraBonificacao.metaQuantidadeDoses", { setValueAs: comoNumeroOpcional })} />
              </Campo>
            ) : (
              <Campo label="Meta em R$/ciclo" erro={errors.regraBonificacao?.metaValorFaturamento?.message}>
                <input className="input" type="number" step="0.01" {...register("regraBonificacao.metaValorFaturamento", { setValueAs: comoNumeroOpcional })} />
              </Campo>
            )}

            <Campo label="Base do ciclo" erro={errors.regraBonificacao?.baseCiclo?.message}>
              <select className="input" {...register("regraBonificacao.baseCiclo")}>
                {BASES_CICLO.map((base) => (
                  <option key={base} value={base}>
                    {base === "FATURAMENTO" ? "Faturamento" : "Recebimento"}
                  </option>
                ))}
              </select>
            </Campo>

            <div className="grid grid-cols-3 gap-4">
              <Campo label="Bônus fixo (R$)" erro={errors.regraBonificacao?.bonusFixoValor?.message}>
                <input className="input" type="number" step="0.01" {...register("regraBonificacao.bonusFixoValor", { valueAsNumber: true })} />
              </Campo>
              <Campo label="% sem meta (flat)" erro={errors.regraBonificacao?.percentualSemMeta?.message}>
                <input className="input" type="number" step="0.001" {...register("regraBonificacao.percentualSemMeta", { valueAsNumber: true })} />
              </Campo>
              <Campo label="% sobre excedente" erro={errors.regraBonificacao?.percentualExcedente?.message}>
                <input className="input" type="number" step="0.001" {...register("regraBonificacao.percentualExcedente", { setValueAs: comoNumeroOpcional })} />
              </Campo>
            </div>

            <Campo label="Condições de perda" erro={errors.regraBonificacao?.condicoesPerda?.message}>
              <textarea className="input" rows={2} {...register("regraBonificacao.condicoesPerda")} />
            </Campo>
          </div>
        )}
      </fieldset>

      {erroServidor && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {erroServidor}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={enviando} className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
          {enviando ? "Salvando..." : "Cadastrar contrato"}
        </button>
        <button type="button" onClick={() => router.push("/contratos")} className="rounded-md border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700">
          Cancelar
        </button>
      </div>

      <ConfirmModal
        aberto={sobreposicao !== null}
        titulo="Contrato ativo já existe"
        mensagem={`Já existe um contrato ativo (${sobreposicao?.contratoAnteriorNumero ?? "sem número"}) vigente para este representante. Deseja encerrá-lo na véspera da nova vigência e prosseguir?`}
        confirmando={enviando}
        onConfirmar={confirmarEncerramentoAnterior}
        onCancelar={() => setSobreposicao(null)}
      />
    </form>
  );
}

function Campo({ label, erro, children }: { label: string; erro?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">{label}</label>
      {children}
      {erro && <span className="text-xs text-red-600">{erro}</span>}
    </div>
  );
}
