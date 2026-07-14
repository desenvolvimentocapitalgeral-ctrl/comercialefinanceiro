import { getDocumentProxy, extractText } from "unpdf";

export interface ResultadoExtracaoPdf {
  sucesso: true;
  texto: string;
  quantidadePaginas: number;
}

export type ResultadoExtracao = ResultadoExtracaoPdf | { sucesso: false; erro: string; codigo: string };

/**
 * Extrai o texto puro de um PDF de contrato (Prompt 2, §5.3, passo 1 do
 * pipeline: "Upload de PDF → extração de texto"). Não faz nenhuma
 * interpretação — só devolve o texto bruto para o prompt da IA.
 */
export async function extrairTextoContrato(bufferPdf: ArrayBuffer): Promise<ResultadoExtracao> {
  try {
    const documento = await getDocumentProxy(new Uint8Array(bufferPdf));
    const { text: texto, totalPages } = await extractText(documento, { mergePages: true });

    if (texto.trim().length === 0) {
      return { sucesso: false, erro: "O PDF não contém texto extraível (pode ser uma digitalização escaneada sem OCR).", codigo: "PDF_SEM_TEXTO" };
    }

    return { sucesso: true, texto, quantidadePaginas: totalPages };
  } catch (erro) {
    return {
      sucesso: false,
      erro: `Não foi possível ler o PDF: ${erro instanceof Error ? erro.message : "erro desconhecido"}`,
      codigo: "PDF_INVALIDO",
    };
  }
}
