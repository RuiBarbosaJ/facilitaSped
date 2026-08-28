"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useTema, definirTema, type Tema } from "@/hooks/useTema";

const OPCOES: { valor: Tema; rotulo: string; Icone: typeof Sun }[] = [
  { valor: "claro", rotulo: "Tema claro", Icone: Sun },
  { valor: "sistema", rotulo: "Seguir o sistema", Icone: Monitor },
  { valor: "escuro", rotulo: "Tema escuro", Icone: Moon },
];

/**
 * Controle segmentado de tema. Três estados explícitos em vez de um botão que
 * alterna: assim o usuário vê que "seguir o sistema" existe e qual está ativo.
 */
export function BotaoTema() {
  const atual = useTema();

  return (
    <div
      role="radiogroup"
      aria-label="Tema da interface"
      className="inline-flex items-center gap-0.5 p-0.5 rounded-lg border border-border-subtle bg-surface-page"
    >
      {OPCOES.map(({ valor, rotulo, Icone }) => {
        const ativo = atual === valor;
        return (
          <button
            key={valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            aria-label={rotulo}
            title={rotulo}
            onClick={() => definirTema(valor)}
            className={`p-1.5 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              ativo
                ? "bg-surface-card text-accent shadow-xs"
                : "text-text-tertiary hover:text-text-primary"
            }`}
          >
            <Icone size={16} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
