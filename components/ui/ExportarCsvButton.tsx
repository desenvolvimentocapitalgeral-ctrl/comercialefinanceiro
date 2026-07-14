"use client";

export function ExportarCsvButton({ csv, nomeArquivo }: { csv: string; nomeArquivo: string }) {
  function exportar() {
    // BOM UTF-8 garante acentuação correta ao abrir no Excel.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nomeArquivo;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={exportar}
      className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
    >
      Exportar CSV
    </button>
  );
}
