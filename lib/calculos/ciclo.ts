import { addMonths, setDate, isBefore, format } from "date-fns";

export interface CicloComercial {
  cicloId: string; // "2026-03"
  inicio: Date; // 2026-03-11
  fim: Date; // 2026-04-10
  label: string; // "11/03/2026 a 10/04/2026"
}

/**
 * Dado qualquer data, retorna o ciclo comercial (padrão 11 a 10) ao qual ela pertence.
 * diaInicio/diaFim vêm de Empresa.diaInicioCiclo/diaFimCiclo — nunca hardcode fora daqui.
 */
export function calcularCiclo(
  data: Date,
  diaInicio: number = 11,
  diaFim: number = 10,
): CicloComercial {
  const dia = data.getDate();
  const inicioNoMesAtual = dia >= diaInicio;
  const mesReferenciaInicio = inicioNoMesAtual ? data : addMonths(data, -1);

  const inicio = setDate(mesReferenciaInicio, diaInicio);
  const fim = setDate(addMonths(mesReferenciaInicio, 1), diaFim);
  const cicloId = format(mesReferenciaInicio, "yyyy-MM");
  const label = `${format(inicio, "dd/MM/yyyy")} a ${format(fim, "dd/MM/yyyy")}`;

  return { cicloId, inicio, fim, label };
}

/**
 * Lista os ciclos comerciais entre duas datas (inclusive) — usado pelo CycleSelector
 * e por relatórios de "últimos N ciclos". Nunca substituir por iteração de mês calendário.
 */
export function listarCiclosEntre(
  dataInicial: Date,
  dataFinal: Date,
  diaInicio: number = 11,
  diaFim: number = 10,
): CicloComercial[] {
  const ciclos: CicloComercial[] = [];
  let atual = calcularCiclo(dataInicial, diaInicio, diaFim);
  const ultimo = calcularCiclo(dataFinal, diaInicio, diaFim);

  while (isBefore(atual.inicio, ultimo.fim) || atual.cicloId === ultimo.cicloId) {
    ciclos.push(atual);
    if (atual.cicloId === ultimo.cicloId) break;
    atual = calcularCiclo(addMonths(atual.inicio, 1), diaInicio, diaFim);
  }

  return ciclos;
}

/** Um ciclo é considerado fechado quando a data atual é posterior ao fim do ciclo — nunca um estado armazenado. */
export function cicloEstaFechado(ciclo: CicloComercial, agora: Date = new Date()): boolean {
  return isBefore(ciclo.fim, agora);
}

/** Compara dois cicloId no formato AAAA-MM de forma ordenável (string já é ordenável, mas centraliza a regra). */
export function compararCicloId(a: string, b: string): number {
  return a.localeCompare(b);
}

/** Resolve, entre uma lista de itens versionados por vigenciaCicloInicio, qual vale para um cicloId alvo. */
export function resolverVigenciaPorCiclo<T extends { vigenciaCicloInicio: string }>(
  itens: T[],
  cicloIdAlvo: string,
): T | null {
  const candidatos = itens
    .filter((item) => compararCicloId(item.vigenciaCicloInicio, cicloIdAlvo) <= 0)
    .sort((a, b) => compararCicloId(b.vigenciaCicloInicio, a.vigenciaCicloInicio));
  return candidatos[0] ?? null;
}
