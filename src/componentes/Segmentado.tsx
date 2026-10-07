import type { ComponentType } from "react";

export interface OpcaoSegmentada<T extends string> {
  valor: T;
  rotulo: string;
  /** O que a opção quer dizer, por extenso. */
  dica?: string;
  Icone?: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
}

interface SegmentadoProps<T extends string> {
  /** O nome da escolha, para o leitor de tela. */
  rotulo: string;
  opcoes: readonly OpcaoSegmentada<T>[];
  valor: T;
  onChange: (valor: T) => void;
}

/**
 * Duas ou três opções lado a lado, uma escolhida — saída ou entrada, não
 * cumulativo ou cumulativo.
 *
 * Fundo cheio na escolhida, e não o azul claro das listas de recorte: estas
 * são premissas da auditoria, e a resposta errada aqui muda o resultado
 * inteiro. Precisam se ler de longe.
 */
export function Segmentado<T extends string>({ rotulo, opcoes, valor, onChange }: SegmentadoProps<T>) {
  return (
    <div
      role="group"
      aria-label={rotulo}
      className="inline-flex w-fit shrink-0 gap-0.5 rounded-md border border-border-strong bg-surface-card p-0.5"
    >
      {opcoes.map(({ valor: opcao, rotulo: texto, dica, Icone }) => {
        const ativa = valor === opcao;
        return (
          <button
            key={opcao}
            type="button"
            aria-pressed={ativa}
            title={dica}
            onClick={() => onChange(opcao)}
            className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-sm font-medium whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              ativa ? "bg-accent text-accent-contrast" : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
            }`}
          >
            {Icone && <Icone size={14} aria-hidden />}
            {texto}
          </button>
        );
      })}
    </div>
  );
}
