"use client";

import { useState } from "react";
import { dividirPorDestaque } from "@/consulta/destaque";

/** Acima disto a descrição fecha em duas linhas e ganha o "Ver mais". */
const LIMITE = 150;

interface DescricaoRegraProps {
  texto: string;
  /** O termo buscado, para marcar onde ele aparece. */
  termo: string;
}

/**
 * A descrição da regra, em texto corrido.
 *
 * Sem o realce de termos fiscais das outras telas. Aqui ele pintava "TIPI",
 * cada código citado e cada "zero" de toda descrição com pastilhas e cores — e
 * a única marca que ajuda quem consulta é a do termo que ele acabou de buscar,
 * que sumia no meio das outras.
 */
export function DescricaoRegra({ texto, termo }: DescricaoRegraProps) {
  const [expandido, setExpandido] = useState(false);

  if (!texto) {
    return <span className="text-text-tertiary">—</span>;
  }

  const longo = texto.length > LIMITE;
  const trechos = termo.trim() ? dividirPorDestaque(texto, termo) : [{ texto, destaque: false }];

  return (
    <div className="flex flex-col items-start">
      <p
        className={`max-w-[75ch] text-sm leading-6 text-text-secondary ${longo && !expandido ? "line-clamp-2" : ""}`}
        title={longo && !expandido ? texto : undefined}
      >
        {trechos.map((trecho, i) =>
          trecho.destaque ? (
            <mark key={i} className="rounded-sm bg-accent-soft px-0.5 text-text-primary">
              {trecho.texto}
            </mark>
          ) : (
            trecho.texto
          ),
        )}
      </p>
      {longo && (
        <button
          type="button"
          onClick={() => setExpandido(!expandido)}
          className="rounded-sm text-xs font-medium text-accent transition-colors hover:text-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {expandido ? "Ver menos" : "Ver mais"}
        </button>
      )}
    </div>
  );
}
