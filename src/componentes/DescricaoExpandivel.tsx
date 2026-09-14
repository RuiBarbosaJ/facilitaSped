"use client";

import { useState } from "react";

interface DescricaoExpandivelProps {
  texto: string;
  limiteCaracteres?: number;
  className?: string;
  /**
   * Liga o destaque de termos fiscais. Só vale para texto da Receita: num dado
   * do cliente ("REFRIGERANTE COCA COLA ZERO 2L") o realce pintaria "ZERO" com
   * o mesmo verde de "alíquota zero" e sugeriria um benefício que não existe.
   */
  destacar?: boolean;
}

const REGEX_DESTAQUE = /(Lei n[º°o]? [\d./]+|art\. [\dº°A-Za-z]+|Decreto n[º°o]? [\d./]+|\bCap[íi]tulos? \d{1,2}\b|\b(?:NCM|TIPI|CST|PIS\/?Pasep|COFINS|Alíquota zero|isenção|isento|isenta|suspensão|suspensa|zero|reduzida a zero)\b|\b\d{2}\.\d{2}\b|\b\d{4}\.\d{1,2}(?:\.\d{2})?\b|\b\d+(?:,\d+)?%)/gi;

function destacarTexto(texto: string) {
  if (!texto) return null;
  return texto.split(REGEX_DESTAQUE).map((parte, i) => {
    // Índices ímpares são os grupos capturados pelo regex
    if (i % 2 === 1) {
      const p = parte.toLowerCase();

      // 1. Códigos NCM/TIPI ou Siglas (Renderiza como Badge de Código)
      if (/^\d{2,4}\.\d{1,2}(?:\.\d{2})?$/.test(parte) || p === "ncm" || p === "tipi" || p === "cst" || p === "pis/pasep" || p === "cofins" || /^cap[íi]tulos? \d{1,2}$/.test(p)) {
        return (
          <span key={i} className="font-mono bg-badge-ncm-bg text-badge-ncm-text px-1 py-0.5 mx-0.5 rounded text-[0.9em] font-medium shadow-sm border border-border-subtle/50">
            {parte}
          </span>
        );
      }

      // 2. Benefícios e Alíquotas (Renderiza como Pill Verde Sucesso)
      if (/%$/.test(parte) || /zero|isenç[ãa]o|isento|isenta|suspens[ãa]o|suspensa/.test(p)) {
        return (
          <span key={i} className="bg-success-soft text-success px-1.5 py-0.5 mx-0.5 rounded-md text-[0.85em] font-bold uppercase tracking-wider">
            {parte}
          </span>
        );
      }

      // 3. Base Legal (Leis, Decretos, Artigos) (Renderiza como Citação/Link)
      if (/lei|decreto|art\./.test(p)) {
        return (
          <span key={i} className="text-accent font-semibold underline decoration-accent/30 underline-offset-2">
            {parte}
          </span>
        );
      }

      // Fallback: Apenas negrito
      return (
        <strong key={i} className="font-semibold text-text-primary">
          {parte}
        </strong>
      );
    }
    return parte;
  });
}

/** 
 * Mostra um texto com clamp de linhas, oferecendo botão para expandir 
 * caso o conteúdo passe de um limite arbitrário de caracteres.
 * Palavras-chave importantes (NCMs, Leis, Alíquotas) são destacadas em negrito.
 */
export function DescricaoExpandivel({ texto, limiteCaracteres = 150, className = "text-sm text-text-secondary", destacar = true }: DescricaoExpandivelProps) {
  const [expandido, setExpandido] = useState(false);

  if (!texto) {
    return <span className="text-text-tertiary">—</span>;
  }

  const muitoLongo = texto.length > limiteCaracteres;

  return (
    <div className="flex flex-col items-start gap-1">
      <div 
        className={`${className} ${!expandido && muitoLongo ? "line-clamp-2" : ""} min-w-[200px] lg:max-w-2xl xl:max-w-3xl 2xl:max-w-5xl`}
        title={!expandido && muitoLongo ? texto : undefined}
      >
        {destacar ? destacarTexto(texto) : texto}
      </div>
      {muitoLongo && (
        <button
          type="button"
          onClick={() => setExpandido(!expandido)}
          className="text-xs font-medium text-accent hover:text-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded transition-colors"
        >
          {expandido ? "Ver menos" : "Ver mais"}
        </button>
      )}
    </div>
  );
}
