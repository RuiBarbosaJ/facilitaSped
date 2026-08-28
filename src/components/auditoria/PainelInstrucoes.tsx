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
    <section
      aria-labelledby="instrucoes-titulo"
      className="bg-surface-card rounded-2xl border border-border-subtle shadow-(--shadow-card) p-6 flex flex-col gap-5"
    >
      <div className="flex items-start gap-3">
        <span className="shrink-0 grid place-items-center size-9 rounded-lg bg-accent-soft text-accent">
          <Info size={18} aria-hidden />
        </span>
        <div>
          <h2 id="instrucoes-titulo" className="font-semibold">
            Como preparar a planilha
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            Exporte do Alterdata o <strong className="font-medium text-text-primary">relatório padrão de NCM</strong>{" "}
            (.xls ou .xlsx). A primeira aba precisa trazer as colunas abaixo — outras colunas são ignoradas,
            e linhas de título antes do cabeçalho não atrapalham.
          </p>
        </div>
      </div>

      <ul className="flex flex-wrap gap-2" aria-label="Colunas esperadas">
        {COLUNAS_MODELO.map((coluna) => {
          const obrigatoria = (COLUNAS_OBRIGATORIAS as readonly string[]).includes(coluna);
          return (
            <li
              key={coluna}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm font-mono ${
                obrigatoria
                  ? "border-accent/40 bg-accent-soft text-accent"
                  : "border-border-subtle bg-surface-page text-text-secondary"
              }`}
            >
              {coluna}
              {obrigatoria && (
                <span className="text-[10px] font-sans font-semibold uppercase tracking-wider">obrigatória</span>
              )}
            </li>
          );
        })}
      </ul>

      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg bg-surface-page p-3">
          <dt className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Classificação</dt>
          <dd className="mt-1 text-text-secondary">
            NCM com ou sem pontos (<span className="font-mono">0709.60.00</span>). Zeros à esquerda perdidos
            pelo Excel são recompostos.
          </dd>
        </div>
        <div className="rounded-lg bg-surface-page p-3">
          <dt className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">CST PIS / COFINS</dt>
          <dd className="mt-1 text-text-secondary">
            Comparados com o CST que as tabelas 4.3.x do SPED indicam para o NCM.
          </dd>
        </div>
        <div className="rounded-lg bg-surface-page p-3">
          <dt className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Natureza da receita</dt>
          <dd className="mt-1 text-text-secondary">
            Conferida com o código da regra do SPED quando o NCM tem benefício.
          </dd>
        </div>
      </dl>

      <div>
        <button
          type="button"
          onClick={baixarModelo}
          disabled={gerando}
          className="inline-flex items-center gap-2 rounded-lg border border-border-strong bg-surface-card px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-page disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
        >
          {gerando ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Download size={16} aria-hidden />}
          Baixar Modelo Padrão (.xlsx)
        </button>
      </div>
    </section>
  );
}
