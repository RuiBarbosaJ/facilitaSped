"use client";

import { TODOS_CST, type OpcaoCst } from "@/consulta/ui/useFiltroCst";

interface SeletorCstProps {
  valor: string;
  opcoes: OpcaoCst[];
  onChange: (cst: string) => void;
}

/** Escolhe qual CST a tabela mostra. As opções vêm dos próprios dados. */
export function SeletorCst({ valor, opcoes, onChange }: SeletorCstProps) {
  return (
    <label className="flex min-w-0 shrink-0 items-center gap-2 text-sm text-text-secondary">
      <span className="shrink-0 font-medium whitespace-nowrap">CST</span>
      <select
        value={valor}
        onChange={(evento) => onChange(evento.target.value)}
        aria-label="Filtrar por CST"
        className="block min-w-0 max-w-full rounded-lg border border-border-strong bg-surface-card py-2 pl-2.5 pr-8 text-sm text-text-primary transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent sm:w-72"
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
