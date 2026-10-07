"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { COLUNAS_MODELO, COLUNAS_OBRIGATORIAS } from "@/pis-cofins/auditoria";
import { gerarXlsx, baixarArquivo } from "@/pis-cofins/planilha";

/** Linhas de exemplo que vão no modelo, para o usuário ver o formato esperado. */
const EXEMPLOS: (string | number)[][] = [
  ["Pimentão verde", "0709.60.00", "101", "06", "06"],
  ["Farinha de trigo", "1101.00.10", "113", "06", "06"],
  ["Cerveja lata 350 ml", "2203.00.00", "", "01", "01"],
];

/**
 * Explica o leiaute esperado e entrega um modelo em branco.
 *
 * As colunas em lista, uma por linha, com a obrigatória marcada em texto — e não
 * numa frase corrida em que cinco nomes de coluna em fonte mono se emendavam.
 */
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

  const obrigatorias = COLUNAS_OBRIGATORIAS as readonly string[];

  return (
    <div className="flex flex-col gap-5 text-sm">
      <p className="max-w-md text-text-secondary">
        Use o <strong className="font-medium text-text-primary">relatório padrão de NCM</strong> do
        Alterdata (.xls ou .xlsx) ou o nosso modelo. A ferramenta procura o cabeçalho sozinha, em
        qualquer aba.
      </p>

      <div>
        <p className="text-xs font-medium text-text-tertiary">Colunas que ela lê</p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {COLUNAS_MODELO.map((coluna) => (
            <li key={coluna} className="flex items-baseline gap-2">
              <span className="font-mono text-[13px] text-text-primary">{coluna}</span>
              {obrigatorias.includes(coluna) && <span className="text-xs text-text-tertiary">obrigatória</span>}
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={baixarModelo}
        disabled={gerando}
        className="inline-flex w-fit items-center gap-2 rounded-md border border-border-strong bg-surface-card px-3 py-1.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
      >
        {gerando ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Download size={15} aria-hidden />}
        Baixar modelo
      </button>
    </div>
  );
}
