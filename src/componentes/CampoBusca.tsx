"use client";

import { GooeyInput } from "@/components/ui/gooey-input";

interface CampoBuscaProps {
  valor: string;
  onChange: (valor: string) => void;
  /** Textos próprios de quem reaproveita o campo; o padrão é a busca do SPED. */
  placeholder?: string;
  rotulo?: string;
  className?: string;
}

/** Campo de busca padrão do sistema. */
export function CampoBusca({
  valor,
  onChange,
  placeholder = "Busque por NCM ou descrição...",
  rotulo = "Buscar por NCM ou descrição nas tabelas do SPED",
  className,
}: CampoBuscaProps) {
  return (
    <GooeyInput
      value={valor}
      onValueChange={onChange}
      placeholder={placeholder}
      aria-label={rotulo}
      clearOnClose={false}
      collapsedWidth={48}
      expandedWidth={360}
      className={`w-full justify-start ${className ?? ""}`}
      classNames={{
        filterWrap: "w-fit sm:w-full",
        buttonRow: "w-fit sm:w-full",
        trigger:
          "justify-start bg-surface-card text-text-primary ring-1 ring-border-strong hover:bg-surface-page",
        input: "text-text-primary placeholder:text-text-tertiary",
        bubbleSurface:
          "bg-surface-card text-text-primary ring-1 ring-border-strong",
      }}
    />
  );
}
