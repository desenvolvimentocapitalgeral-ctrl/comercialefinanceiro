/**
 * Normalização para matching (Prompt 2, §5.4, passo 1 do pipeline de-para):
 * minúsculas, sem acentos, espaços colapsados. Base para comparação exata
 * de alias e para o cálculo de similaridade fuzzy.
 */
export function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove diacríticos (acentos)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Remove tudo que não é dígito — usado para comparar CNPJ/CPF como identificador forte. */
export function normalizarCpfCnpj(valor: string): string {
  return valor.replace(/\D/g, "");
}
