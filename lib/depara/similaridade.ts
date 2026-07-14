import { normalizarTexto } from "@/lib/depara/normalizar";

/** Distância de edição clássica (inserção/remoção/substituição). */
export function distanciaLevenshtein(a: string, b: string): number {
  const linhas = a.length + 1;
  const colunas = b.length + 1;
  const matriz: number[][] = Array.from({ length: linhas }, () => new Array<number>(colunas).fill(0));

  for (let i = 0; i < linhas; i++) matriz[i][0] = i;
  for (let j = 0; j < colunas; j++) matriz[0][j] = j;

  for (let i = 1; i < linhas; i++) {
    for (let j = 1; j < colunas; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      matriz[i][j] = Math.min(matriz[i - 1][j] + 1, matriz[i][j - 1] + 1, matriz[i - 1][j - 1] + custo);
    }
  }

  return matriz[linhas - 1][colunas - 1];
}

/** 1 = idêntico, 0 = completamente diferente — normalizado pelo comprimento da maior string. */
export function similaridadeLevenshtein(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - distanciaLevenshtein(a, b) / maxLen;
}

/** Similaridade de Jaccard sobre o conjunto de palavras (tokens) — robusta à ordem das palavras. */
export function similaridadeTokens(a: string, b: string): number {
  const tokensA = new Set(a.split(" ").filter(Boolean));
  const tokensB = new Set(b.split(" ").filter(Boolean));
  if (tokensA.size === 0 && tokensB.size === 0) return 1;

  const intersecao = [...tokensA].filter((t) => tokensB.has(t)).length;
  const uniao = new Set([...tokensA, ...tokensB]).size;
  return uniao === 0 ? 1 : intersecao / uniao;
}

/**
 * Combina similaridade por caractere (Levenshtein) e por token (Jaccard) —
 * pega o melhor dos dois mundos: nomes com uma palavra a mais/a menos
 * ("Fulano Silva" vs "Fulano de Souza Silva") pontuam bem em tokens mesmo
 * com Levenshtein baixo, e erros de digitação pontuam bem em Levenshtein
 * mesmo com tokens diferentes.
 */
export function similaridadeCombinada(bruto1: string, bruto2: string): number {
  const a = normalizarTexto(bruto1);
  const b = normalizarTexto(bruto2);
  if (a === b) return 1;

  const porCaractere = similaridadeLevenshtein(a, b);
  const porToken = similaridadeTokens(a, b);
  return Math.max(porCaractere, porToken * 0.95);
}
