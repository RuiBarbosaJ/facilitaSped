"use client";

import { Search } from "lucide-react";

interface CampoBuscaProps {
  valor: string;
  onChange: (valor: string) => void;
}

/** Campo de busca do cabeçalho, filtrando por NCM ou descrição. */
export function CampoBusca({ valor, onChange }: CampoBuscaProps) {
  return (
    <div className="relative group flex-1">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-tertiary group-focus-within:text-accent transition-colors">
        <Search size={16} aria-hidden />
      </div>
      <input
        type="search"
        value={valor}
        onChange={(evento) => onChange(evento.target.value)}
        placeholder="Busque por NCM ou descrição..."
        aria-label="Buscar por NCM ou descrição nas tabelas do SPED"
        className="block w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border-strong bg-surface-card text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
      />
    </div>
  );
}
