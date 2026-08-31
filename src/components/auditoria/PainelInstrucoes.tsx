"use client";

import { useState } from "react";
import { Download, Info, Loader2 } from "lucide-react";
import { COLUNAS_MODELO, COLUNAS_OBRIGATORIAS } from "@/lib/auditoria";
import { gerarXlsx, baixarArquivo } from "@/lib/planilha";

/** Linhas de exemplo que vão no modelo, para o usuário ver o formato esperado. */
const EXEMPLOS: (string | number)[][] = [
  ["Pimentão verde", "0709.60.00", "101", "06", "06"],
  ["Farinha de trigo", "1101.00.10", "113", "06", "06"],
  ["Cerveja lata 350 ml", "2203.00.00", "", "01", "01"],
];

/** Explica o leiaute esperado e entrega um modelo em branco. */
export function PainelInstrucoes() {
  const [gerando, setGerando] = useState(false);

  async function baixarModelo() {
    setGerando(true);
    try {
      const bytes = await gerarXlsx(
        [[...COLUNAS_MODELO], ...EXEMPLOS],
        "Produtos",
        [40, 16, 26, 10, 12]
      );
      baixarArquivo(bytes, "modelo-auditoria-ncm.xlsx");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 px-2 mb-2">
      <div className="flex flex-1 items-start gap-3 text-sm text-text-secondary">
        <span className="shrink-0 grid place-items-center size-8 rounded-full bg-accent-soft text-accent">
          <Info size={16} aria-hidden />
        </span>
        <div className="min-w-0">
          <p>
            Utilize o <strong className="font-semibold text-text-primary">relatório padrão de NCM</strong> do Alterdata (.xls/.xlsx) ou preencha o nosso modelo padrão.
          </p>
          <p className="mt-1.5 text-xs text-text-tertiary">
            Colunas esperadas:{" "}
            {COLUNAS_MODELO.map((coluna, i) => (
              <span key={coluna}>
                {i > 0 && ", "}
                <span
                  className={
                    (COLUNAS_OBRIGATORIAS as readonly string[]).includes(coluna)
                      ? "font-mono font-medium text-text-secondary"
                      : "font-mono"
                  }
                >
                  {coluna}
                </span>
              </span>
            ))}
            . As duas primeiras são obrigatórias.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={baixarModelo}
        disabled={gerando}
        className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-surface-card px-4 py-2 text-sm font-medium text-accent border border-border-subtle shadow-sm hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
      >
        {gerando ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Download size={16} aria-hidden />}
        Baixar Modelo Padrão
      </button>
    </div>
  );
}
