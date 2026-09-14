"use client";

import { Search } from "lucide-react";

interface CampoBuscaProps {
  valor: string;
  onChange: (valor: string) => void;
  /** Textos próprios de quem reaproveita o campo; o padrão é a busca do SPED. */
  placeholder?: string;
  rotulo?: string;
}

/** Campo de busca padrão do sistema. */
export function CampoBusca({
  valor,
  onChange,
  placeholder = "Busque por NCM ou descrição...",
  rotulo = "Buscar por NCM ou descrição nas tabelas do SPED",
}: CampoBuscaProps) {
  return (
    <div className="relative group flex-1">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-tertiary group-focus-within:text-accent transition-colors">
        <Search size={16} aria-hidden />
      </div>
      <input
        type="search"
        value={valor}
        onChange={(evento) => onChange(evento.target.value)}
        placeholder={placeholder}
        aria-label={rotulo}
        className="block w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border-strong bg-surface-card text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
      />
    </div>
  );
}
