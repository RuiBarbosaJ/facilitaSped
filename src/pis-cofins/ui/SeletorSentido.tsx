"use client";

import { ArrowDownLeft, ArrowUpRight, Info } from "lucide-react";

import type { RegimeDeApuracao, Sentido, SentidoDetectado } from "@/pis-cofins/auditoria";

interface SeletorSentidoProps {
  sentido: Sentido;
  /** Como a ferramenta chegou nessa ponta sozinha. */
  deteccao: SentidoDetectado;
  /** Verdadeiro quando a ponta atual veio de uma escolha do usuário. */
  manual: boolean;
  onSentido: (sentido: Sentido | null) => void;
  regime: RegimeDeApuracao;
  onRegime: (regime: RegimeDeApuracao) => void;
}

const PONTAS: { valor: Sentido; rotulo: string; ajuda: string; Icone: typeof ArrowUpRight }[] = [
  {
    valor: "saida",
    rotulo: "Saída (vendas)",
    ajuda: "CST de receita, faixa 01 a 49 das tabelas 4.3.3 e 4.3.4",
    Icone: ArrowUpRight,
  },
  {
    valor: "entrada",
    rotulo: "Entrada (compras)",
    ajuda: "CST de aquisição, faixa 50 a 99 das mesmas tabelas",
    Icone: ArrowDownLeft,
  },
];

const REGIMES: { valor: RegimeDeApuracao; rotulo: string; consequencia: string }[] = [
  {
    valor: "nao-cumulativo",
    rotulo: "Não cumulativo",
    consequencia: "compra sem benefício recebe CST 50 — com direito a crédito",
  },
  {
    valor: "cumulativo",
    rotulo: "Cumulativo",
    consequencia: "compra sem benefício recebe CST 70 — sem direito a crédito",
  },
];

/**
 * De que ponta da operação a planilha fala, e o que isso muda.
 *
 * A mesma tabela do SPED governa compra e venda, e o código muda: o NCM de
 * alíquota zero sai com CST 06 e entra com 73. Auditar uma planilha de compras
 * contra a coluna de saída reprova todas as linhas e oferece, como correção,
 * trocar o código certo pelo da outra ponta — erro que chega pronto, com cara
 * de conserto.
 *
 * Por isso a ponta detectada aparece SEMPRE, com o motivo à vista, e não só
 * quando a ferramenta está em dúvida: quem confere precisa poder discordar
 * antes de olhar a lista, e não depois de exportar.
 */
export function SeletorSentido({
  sentido,
  deteccao,
  manual,
  onSentido,
  regime,
  onRegime,
}: SeletorSentidoProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface-card p-4 shadow-(--shadow-card)">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary">Ponta da operação</p>
          <p className="mt-0.5 flex items-start gap-1.5 text-xs text-text-secondary">
            <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              {manual ? (
                <>
                  Definida por você.{" "}
                  <button
                    type="button"
                    onClick={() => onSentido(null)}
                    className="underline underline-offset-2 hover:text-text-primary"
                  >
                    Voltar ao que a planilha indica
                  </button>
                  .
                </>
              ) : (
                deteccao.motivo
              )}
            </span>
          </p>
        </div>

        <div
          role="group"
          aria-label="Ponta da operação"
          className="flex shrink-0 gap-1 rounded-lg border border-border-strong p-1"
        >
          {PONTAS.map(({ valor, rotulo, ajuda, Icone }) => {
            const ativa = sentido === valor;
            return (
              <button
                key={valor}
                type="button"
                aria-pressed={ativa}
                title={ajuda}
                onClick={() => onSentido(valor)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  ativa
                    ? "bg-accent text-accent-contrast"
                    : "text-text-secondary hover:bg-surface-page"
                }`}
              >
                <Icone size={13} aria-hidden />
                {rotulo}
              </button>
            );
          })}
        </div>
      </div>

      {!deteccao.confiante && !manual && (
        <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
          Nada na planilha disse de que ponta ela fala — nem o título da coluna de CST, nem CFOP, nem
          os códigos informados. A auditoria está lendo como <strong>saída</strong>, que é o padrão.
          Se for uma planilha de compras, troque acima antes de conferir a lista.
        </p>
      )}

      {sentido === "entrada" && (
        <div className="flex flex-col gap-2 border-t border-border-subtle pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text-primary">Regime de apuração</p>
            <p className="mt-0.5 text-xs text-text-secondary">
              {REGIMES.find((r) => r.valor === regime)?.consequencia}. A planilha não diz qual é o
              caso, e a diferença entre os dois códigos é crédito tomado ou crédito perdido.
            </p>
          </div>
          <div
            role="group"
            aria-label="Regime de apuração"
            className="flex shrink-0 gap-1 rounded-lg border border-border-strong p-1"
          >
            {REGIMES.map(({ valor, rotulo }) => {
              const ativo = regime === valor;
              return (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => onRegime(valor)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    ativo
                      ? "bg-accent text-accent-contrast"
                      : "text-text-secondary hover:bg-surface-page"
                  }`}
                >
                  {rotulo}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
