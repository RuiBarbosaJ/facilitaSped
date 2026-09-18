"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

import type { RegraAgrupada } from "@/consulta/agrupar";
import { exportarCsv, exportarXlsx } from "@/consulta/exportar";

interface BotoesExportarProps {
  /** O RESULTADO da busca e dos filtros, não a base inteira. */
  regras: RegraAgrupada[];
  /** O CST do recorte, para o nome do arquivo. */
  cst: string;
}

/**
 * Levar o resultado para a planilha de conferência.
 *
 * O passo seguinte a toda busca nesta tela é cruzar o que se achou com a
 * planilha de produtos do cliente. Sem isto, esse cruzamento é cópia manual
 * linha a linha — e é exatamente aí que nasce o erro de digitação que a
 * ferramenta existe para evitar.
 */
export function BotoesExportar({ regras, cst }: BotoesExportarProps) {
  const [gerando, setGerando] = useState(false);
  const vazio = regras.length === 0;

  async function baixarXlsx() {
    setGerando(true);
    try {
      await exportarXlsx(regras, cst);
    } finally {
      setGerando(false);
    }
  }

  const classe =
    "inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-surface-card px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={baixarXlsx}
        disabled={vazio || gerando}
        aria-busy={gerando}
        title={
          vazio
            ? "Nenhuma regra no resultado atual"
            : `Exporta as ${regras.length.toLocaleString("pt-BR")} regras do resultado, com a busca e os filtros aplicados`
        }
        className={classe}
      >
        {gerando ? (
          <Loader2 size={13} className="animate-spin" aria-hidden />
        ) : (
          <Download size={13} aria-hidden />
        )}
        XLSX
      </button>

      <button
        type="button"
        onClick={() => exportarCsv(regras, cst)}
        disabled={vazio}
        title={
          vazio
            ? "Nenhuma regra no resultado atual"
            : "CSV separado por ponto e vírgula, com BOM — abre direto no Excel em português"
        }
        className={classe}
      >
        <Download size={13} aria-hidden />
        CSV
      </button>
    </div>
  );
}
