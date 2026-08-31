"use client";

import { Wand2 } from "lucide-react";

/** Valor especial que desliga o critério de correção. */
export const SEM_CORRECAO = "nenhum";

export interface OpcaoCorrecao {
  cst: string;
  rotulo: string;
  descricao: string;
}

/**
 * Critérios disponíveis seguindo a lógica do Alterdata:
 * - O usuário escolhe o CST do benefício-alvo (ex: 06 — Alíquota Zero)
 * - O sistema corrige: NCMs com essa regra no SPED → CST escolhido
 * - Os demais → CST 01 (tributação plena)
 */
export const OPCOES_CORRECAO: OpcaoCorrecao[] = [
  {
    cst: "06",
    rotulo: "CST 06 — Alíquota Zero",
    descricao: "NCMs com regra de alíquota zero no SPED recebem CST 06. Os demais recebem CST 01 (tributado).",
  },
  {
    cst: "07",
    rotulo: "CST 07 — Isenção",
    descricao: "NCMs com regra de isenção no SPED recebem CST 07. Os demais recebem CST 01 (tributado).",
  },
  {
    cst: "05",
    rotulo: "CST 05 — Substituição Tributária",
    descricao: "NCMs com substituição tributária no SPED recebem CST 05. Os demais recebem CST 01 (tributado).",
  },
  {
    cst: "02",
    rotulo: "CST 02 — Monofásico (alíquota diferenciada)",
    descricao: "NCMs com tributação monofásica no SPED recebem CST 02. Os demais recebem CST 01 (tributado).",
  },
  {
    cst: "04",
    rotulo: "CST 04 — Monofásico (revenda)",
    descricao: "NCMs monofásicos na revenda recebem CST 04. Os demais recebem CST 01 (tributado).",
  },
];

interface CriterioCorrecaoProps {
  valor: string;
  onChange: (cst: string) => void;
  /** Quantas linhas serão afetadas pela correção, para feedback imediato. */
  totalLinhas?: number;
  totalBeneficio?: number;
  totalTributado?: number;
}

/** Seletor de critério de correção estilo Alterdata, com descrição contextual. */
export function CriterioCorrecao({
  valor,
  onChange,
  totalLinhas = 0,
  totalBeneficio = 0,
  totalTributado = 0,
}: CriterioCorrecaoProps) {
  const opcaoAtiva = OPCOES_CORRECAO.find((o) => o.cst === valor);
  const ativo = valor !== SEM_CORRECAO;

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        ativo
          ? "border-accent bg-accent-soft"
          : "border-border-subtle bg-surface-card"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        {/* Ícone + título */}
        <span
          className={`grid size-9 shrink-0 place-items-center rounded-lg ${
            ativo ? "bg-accent text-accent-contrast" : "bg-surface-page text-text-tertiary"
          }`}
        >
          <Wand2 size={17} aria-hidden />
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary">
            Critério de Correção
          </p>
          <p className="text-xs text-text-secondary mt-0.5">
            {ativo
              ? opcaoAtiva?.descricao
              : "Escolha um critério para o sistema corrigir os CSTs automaticamente seguindo as tabelas do SPED, igual ao Alterdata."}
          </p>

          {/* Seletor */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              id="criterio-correcao"
              value={valor}
              onChange={(e) => onChange(e.target.value)}
              aria-label="Critério de correção de CST"
              className="py-2 pl-2.5 pr-8 text-sm rounded-lg border border-border-strong bg-surface-card text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
            >
              <option value={SEM_CORRECAO}>Sem correção — exibir planilha original</option>
              {OPCOES_CORRECAO.map((o) => (
                <option key={o.cst} value={o.cst}>
                  {o.rotulo}
                </option>
              ))}
            </select>

            {ativo && valor !== SEM_CORRECAO && (
              <button
                type="button"
                onClick={() => onChange(SEM_CORRECAO)}
                className="text-xs text-text-tertiary underline underline-offset-2 hover:text-text-secondary transition-colors"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Resumo da correção */}
          {ativo && totalLinhas > 0 && (
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 font-medium text-success">
                <span className="size-1.5 rounded-full bg-success" />
                {totalBeneficio.toLocaleString("pt-BR")} linha
                {totalBeneficio !== 1 ? "s" : ""} → CST {valor}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-badge-ncm-bg px-2.5 py-1 font-medium text-badge-ncm-text">
                <span className="size-1.5 rounded-full bg-text-tertiary" />
                {totalTributado.toLocaleString("pt-BR")} linha
                {totalTributado !== 1 ? "s" : ""} → CST 01
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
