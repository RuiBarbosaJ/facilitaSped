"use client";

import { Search } from "lucide-react";

interface CampoBuscaProps {
  valor: string;
  onChange: (valor: string) => void;
}

/** Campo de busca do cabeçalho, filtrando por NCM, CST, descrição ou natureza. */
export function CampoBusca({ valor, onChange }: CampoBuscaProps) {
  return (
    <div className="w-full md:w-96 relative group">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
        <Search size={18} aria-hidden />
      </div>
      <input
        type="search"
        value={valor}
        onChange={(evento) => onChange(evento.target.value)}
        placeholder="Busque por NCM, CST, descrição..."
        aria-label="Buscar nas tabelas do SPED"
        className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all shadow-sm"
      />
    </div>
  );
}
