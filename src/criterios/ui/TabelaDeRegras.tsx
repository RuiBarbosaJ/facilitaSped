import type { Severidade } from "@/regras/nucleo/tipos";
import type { Conserto, RegraExplicada } from "../regras";

/** O selo de severidade, no mesmo vocabulário de cor das telas de auditoria. */
function Severidade({ valor }: { valor: Severidade }) {
  const estilo =
    valor === "critico" || valor === "erro"
      ? "border-danger/40 bg-danger-soft text-danger"
      : valor === "alerta"
        ? "border-warning/40 bg-warning-soft text-warning"
        : "border-border-subtle bg-surface-head text-text-secondary";

  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${estilo}`}>
      {valor}
    </span>
  );
}

const CONSERTO: Record<Conserto, { rotulo: string; estilo: string; explica: string }> = {
  automatica: {
    rotulo: "automática",
    estilo: "border-success/40 bg-success-soft text-success",
    explica: "Recalculada do próprio arquivo e já aprovada.",
  },
  sugerida: {
    rotulo: "sugerida",
    estilo: "border-accent/40 bg-accent-soft text-accent",
    explica: "O valor é dedutível, mas há decisão embutida: nasce desmarcada e espera aprovação.",
  },
  manual: {
    rotulo: "na origem",
    estilo: "border-border-subtle bg-surface-head text-text-secondary",
    explica: "Não há valor a propor — o conserto é no ERP, antes de gerar o arquivo.",
  },
};

export function SeloDeConserto({ valor }: { valor: Conserto }) {
  const { rotulo, estilo } = CONSERTO[valor];
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${estilo}`}>
      {rotulo}
    </span>
  );
}

export function LegendaDeConserto() {
  return (
    <dl className="grid max-w-3xl gap-2 sm:grid-cols-3">
      {(Object.keys(CONSERTO) as Conserto[]).map((chave) => (
        <div key={chave} className="rounded-md border border-border-subtle bg-surface-card p-3">
          <dt className="mb-1.5">
            <SeloDeConserto valor={chave} />
          </dt>
          <dd className="text-xs leading-relaxed text-text-secondary">{CONSERTO[chave].explica}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * As regras que rodam hoje, uma por linha.
 *
 * Não é uma tabela: cada regra tem uma condição, uma expressão, um motivo de
 * conserto e uma lista de campos, e nada disso cabe numa célula sem virar texto
 * cortado. Uma lista de fichas lê melhor no celular e imprime melhor — e esta
 * página vai ser impressa e anexada a papel de trabalho.
 */
export function ListaDeRegras({ regras }: { regras: readonly RegraExplicada[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {regras.map((r) => (
        <li
          key={r.id}
          id={r.id}
          className="scroll-mt-[calc(var(--altura-cabecalho)+1.5rem)] rounded-md border border-border-subtle bg-surface-card p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-text-primary">{r.id}</span>
            <Severidade valor={r.severidade} />
            <SeloDeConserto valor={r.conserto} />
            <span className="ml-auto rounded border border-border-subtle bg-surface-head px-1.5 py-0.5 font-mono text-[10px] text-text-tertiary">
              registro {r.registro}
            </span>
          </div>

          <p className="mt-2 text-sm font-medium text-text-primary">{r.nome}</p>
          <p className="mt-1 text-sm leading-relaxed text-text-secondary">{r.descricao}</p>

          {/*
            A condição e a expressão saem do dicionário como TEXTO, e é de
            propósito: um contador, um fiscal ou um revisor precisa conseguir ler
            a regra sem abrir o motor. Reproduzi-las aqui é o que permite
            conferir a ferramenta contra o Guia Prático sem confiar nela.
          */}
          <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-[6rem_1fr]">
            {r.condicao && (
              <>
                <dt className="text-text-tertiary">Aplica-se quando</dt>
                <dd className="font-mono break-words text-text-secondary">{r.condicao}</dd>
              </>
            )}
            <dt className="text-text-tertiary">Precisa valer</dt>
            <dd className="font-mono break-words text-text-secondary">{r.expressao}</dd>
            <dt className="text-text-tertiary">Campos</dt>
            <dd className="font-mono break-words text-text-secondary">{r.campos.join(" · ")}</dd>
          </dl>

          {r.motivoDoConserto && (
            <div className="mt-3 border-t border-border-subtle pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                Sobre a correção
                {r.campoCorrigido && (
                  <span className="ml-1.5 font-mono font-normal normal-case tracking-normal">
                    ({r.campoCorrigido})
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">{r.motivoDoConserto}</p>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
