"use client";

import { TODOS_CST, type OpcaoCst } from "@/hooks/useFiltroCst";

interface SeletorCstProps {
  valor: string;
  opcoes: OpcaoCst[];
  onChange: (cst: string) => void;
}

/** Escolhe qual CST a tabela mostra. As opções vêm dos próprios dados. */
export function SeletorCst({ valor, opcoes, onChange }: SeletorCstProps) {
  return (
    <label className="flex items-center gap-2 text-sm text-text-secondary shrink-0">
      <span className="font-medium whitespace-nowrap">CST</span>
      <select
        value={valor}
        onChange={(evento) => onChange(evento.target.value)}
        aria-label="Filtrar por CST"
        className="block w-full md:w-80 py-2 pl-2.5 pr-8 text-sm rounded-lg border border-border-strong bg-surface-card text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
      >
        {opcoes.map((opcao) => (
          <option key={opcao.cst} value={opcao.cst}>
            {opcao.rotulo}
          </option>
        ))}
        <option value={TODOS_CST}>Todos os CSTs</option>
      </select>
    </label>
  );
}
