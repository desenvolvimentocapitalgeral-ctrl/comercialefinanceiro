/** Nomeia o tipo de contrato a partir das regras vigentes — nunca só "motor". */
export function tipoContrato(
  temComissao: boolean,
  temBonificacao: boolean,
): { label: string; cor: "verde" | "ambar" | "vermelho" | "neutro" | "azul" } {
  if (temComissao && temBonificacao) return { label: "Comissão + Bonificação", cor: "azul" };
  if (temComissao) return { label: "Só comissão", cor: "neutro" };
  if (temBonificacao) return { label: "Só bonificação", cor: "neutro" };
  return { label: "Sem regra vigente", cor: "vermelho" };
}
