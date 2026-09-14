"use client";

import { FilterX, X } from "lucide-react";

export interface FiltroAtivo {
  /** Chave de render; para os filtros de coluna é o `id` da coluna. */
  id: string;
  /** De onde veio o filtro: "CST", "NCM", "Busca"... */
  rotulo: string;
  /** Um ou mais valores escolhidos. Vários viram "a, b +3". */
  valores: string[];
  onRemover: () => void;
}

/** Acima disso a etiqueta ocuparia a barra inteira. */
const VALORES_VISIVEIS = 2;

function resumir(valores: string[]): string {
  if (valores.length <= VALORES_VISIVEIS) return valores.join(", ");
  return `${valores.slice(0, VALORES_VISIVEIS).join(", ")} +${valores.length - VALORES_VISIVEIS}`;
}

/**
 * Tudo o que está filtrando a tabela agora, num lugar só.
 *
 * Os filtros ficavam espalhados por cartões de resumo, seletores no topo e
 * menus escondidos dentro do cabeçalho da tabela; com dois ou três ativos ao
 * mesmo tempo era normal ver a tabela vazia sem saber o que a estava vazando.
 * Cada etiqueta aqui desfaz o seu filtro, e "Limpar tudo" desfaz todos.
 */
export function BarraFiltros({
  filtros,
  onLimparTudo,
}: {
  filtros: FiltroAtivo[];
  onLimparTudo: () => void;
}) {
  if (filtros.length === 0) return null;

  return (
    <div
      role="group"
      aria-label="Filtros ativos"
      className="flex flex-wrap items-center gap-2 rounded-xl border border-border-subtle bg-surface-card px-3 py-2"
    >
      <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
        Filtros
      </span>

      {filtros.map((filtro) => (
        <span
          key={filtro.id}
          className="inline-flex max-w-full items-center gap-1 rounded-full bg-accent-soft py-0.5 pl-2.5 pr-1 text-xs text-accent"
        >
          <span className="truncate" title={`${filtro.rotulo}: ${filtro.valores.join(", ")}`}>
            <span className="font-semibold">{filtro.rotulo}:</span> {resumir(filtro.valores)}
          </span>
          <button
            type="button"
            onClick={filtro.onRemover}
            aria-label={`Remover filtro ${filtro.rotulo}`}
            className="shrink-0 rounded-full p-0.5 hover:bg-accent hover:text-accent-contrast focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X size={12} aria-hidden />
          </button>
        </span>
      ))}

      <button
        type="button"
        onClick={onLimparTudo}
        className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-text-secondary hover:bg-surface-page hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <FilterX size={14} aria-hidden />
        Limpar tudo
      </button>
    </div>
  );
}
