"use client";

import { CampoBusca } from "@/componentes/CampoBusca";
import { SeletorCst } from "./SeletorCst";
import type { OpcaoCst } from "./useFiltroCst";

interface ControlesConsultaProps {
  cst: string;
  opcoesCst: OpcaoCst[];
  onCstChange: (cst: string) => void;
  busca: string;
  onBuscaChange: (valor: string) => void;
}

/** Faixa única de controles da consulta: o recorte e a busca vivem juntos. */
export function ControlesConsulta({
  cst,
  opcoesCst,
  onCstChange,
  busca,
  onBuscaChange,
}: ControlesConsultaProps) {
  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
      <SeletorCst valor={cst} opcoes={opcoesCst} onChange={onCstChange} />
      <CampoBusca
        valor={busca}
        onChange={onBuscaChange}
        className="min-w-0 flex-1"
      />
    </div>
  );
}
