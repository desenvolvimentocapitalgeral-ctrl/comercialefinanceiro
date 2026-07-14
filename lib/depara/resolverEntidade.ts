import { normalizarTexto, normalizarCpfCnpj } from "@/lib/depara/normalizar";
import { similaridadeCombinada } from "@/lib/depara/similaridade";

export interface CandidatoEntidade {
  id: string;
  nome: string;
  cpfCnpj?: string | null;
}

export interface AliasRegistrado {
  nomeOrigem: string;
  entidadeId: string;
}

export interface CandidatoFuzzy {
  entidadeId: string;
  nome: string;
  similaridade: number;
}

export type ResultadoResolucao =
  | { tipo: "IDENTIFICADOR_FORTE"; entidadeId: string }
  | { tipo: "ALIAS_EXATO"; entidadeId: string }
  | { tipo: "FUZZY_ALTA"; entidadeId: string; similaridade: number }
  | { tipo: "FUZZY_MEDIA"; candidatos: CandidatoFuzzy[] }
  | { tipo: "NOVO" };

export interface LimiaresConfianca {
  alta: number; // >= alta: match automático, mas auditável
  media: number; // [media, alta): exige confirmação humana
  // < media: NOVO (cadastro novo ou decisão manual)
}

/** Faixas padrão para Cliente/Produto (Prompt 2, §5.4). */
export const LIMIARES_PADRAO: LimiaresConfianca = { alta: 0.9, media: 0.7 };

/**
 * Representante usa limiar mais conservador — falso positivo aqui atribui
 * comissão à pessoa errada, o que é bem mais grave que duplicar um cliente.
 */
export const LIMIARES_REPRESENTANTE: LimiaresConfianca = { alta: 0.95, media: 0.85 };

/**
 * Pipeline de-para (Prompt 2, §5.4): normalização → identificador forte
 * (CNPJ/CPF) → alias exato já registrado → fuzzy (Levenshtein + tokens) em
 * 3 faixas de confiança. Função pura — não toca banco, só recebe os
 * candidatos já carregados e decide.
 */
export function resolverEntidade(
  nomeOrigemBruto: string,
  cpfCnpjOrigemBruto: string | null | undefined,
  candidatos: CandidatoEntidade[],
  aliases: AliasRegistrado[],
  limiares: LimiaresConfianca = LIMIARES_PADRAO,
): ResultadoResolucao {
  // 1. Identificador forte — CNPJ/CPF é o critério mais confiável que existe.
  if (cpfCnpjOrigemBruto) {
    const cpfCnpjOrigem = normalizarCpfCnpj(cpfCnpjOrigemBruto);
    if (cpfCnpjOrigem) {
      const porDocumento = candidatos.find((c) => c.cpfCnpj && normalizarCpfCnpj(c.cpfCnpj) === cpfCnpjOrigem);
      if (porDocumento) return { tipo: "IDENTIFICADOR_FORTE", entidadeId: porDocumento.id };
    }
  }

  const nomeOrigem = normalizarTexto(nomeOrigemBruto);

  // 2. Alias exato já registrado (nome que já apareceu antes numa importação e foi mapeado).
  const porAlias = aliases.find((a) => normalizarTexto(a.nomeOrigem) === nomeOrigem);
  if (porAlias) return { tipo: "ALIAS_EXATO", entidadeId: porAlias.entidadeId };

  // 3. Fuzzy — Levenshtein + similaridade de tokens, nas 3 faixas de confiança.
  const candidatosComSimilaridade: CandidatoFuzzy[] = candidatos
    .map((c) => ({ entidadeId: c.id, nome: c.nome, similaridade: similaridadeCombinada(nomeOrigemBruto, c.nome) }))
    .sort((a, b) => b.similaridade - a.similaridade);

  const melhor = candidatosComSimilaridade[0];
  if (!melhor || melhor.similaridade < limiares.media) return { tipo: "NOVO" };

  if (melhor.similaridade >= limiares.alta) {
    return { tipo: "FUZZY_ALTA", entidadeId: melhor.entidadeId, similaridade: melhor.similaridade };
  }

  return { tipo: "FUZZY_MEDIA", candidatos: candidatosComSimilaridade.filter((c) => c.similaridade >= limiares.media).slice(0, 5) };
}
