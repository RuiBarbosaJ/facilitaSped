import type { Severidade } from "@/regras/nucleo/tipos";
import type { Conserto, RegraExplicada } from "../regras";

/**
 * A severidade, no mesmo vocabulário de cor das telas de auditoria — escrita,
 * e não numa pastilha: impressa em preto e branco, a palavra continua dizendo
 * o que a cor dizia.
 */
function Severidade({ valor }: { valor: Severidade }) {
  const estilo =
    valor === "critico" || valor === "erro"
      ? "text-danger"
      : valor === "alerta"
        ? "text-warning"
        : "text-text-secondary";
  const rotulo = { critico: "crítico", erro: "erro", alerta: "alerta", info: "informativo" }[valor] ?? valor;

  return <span className={`text-xs font-medium ${estilo}`}>{rotulo}</span>;
}

const CONSERTO: Record<Conserto, { rotulo: string; estilo: string; explica: string }> = {
  automatica: {
    rotulo: "automática",
    estilo: "text-success",
    explica: "Recalculada do próprio arquivo e já aprovada.",
  },
  sugerida: {
    rotulo: "sugerida",
    estilo: "text-accent",
    explica: "O valor é dedutível, mas há decisão embutida: nasce desmarcada e espera aprovação.",
  },
  manual: {
    rotulo: "na origem",
    estilo: "text-text-secondary",
    explica: "Não há valor a propor — o conserto é no ERP, antes de gerar o arquivo.",
  },
};

export function SeloDeConserto({ valor }: { valor: Conserto }) {
  const { rotulo, estilo } = CONSERTO[valor];
  return (
    <span className={`text-xs font-medium ${estilo}`}>correção {rotulo}</span>
  );
}

export function LegendaDeConserto() {
  return (
    <dl className="grid max-w-3xl gap-x-6 gap-y-3 sm:grid-cols-3">
      {(Object.keys(CONSERTO) as Conserto[]).map((chave) => (
        <div key={chave}>
          <dt>
            <SeloDeConserto valor={chave} />
          </dt>
          <dd className="mt-0.5 text-sm leading-relaxed text-text-secondary">{CONSERTO[chave].explica}</dd>
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-xs font-semibold text-text-primary">{r.id}</span>
            <Severidade valor={r.severidade} />
            <span aria-hidden className="text-text-tertiary">·</span>
            <SeloDeConserto valor={r.conserto} />
            <span className="ml-auto font-mono text-xs text-text-tertiary">registro {r.registro}</span>
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
              <p className="text-xs font-medium text-text-tertiary">
                Sobre a correção
                {r.campoCorrigido && (
                  <span className="ml-1.5 font-mono font-normal">
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
