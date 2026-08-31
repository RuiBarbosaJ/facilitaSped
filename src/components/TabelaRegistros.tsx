"use client";

import { SearchX } from "lucide-react";

import type { RegraAgrupada } from "@/lib/agrupar";
import type { ColunaConsulta } from "@/lib/colunasConsulta";
import type { FiltrosColuna } from "@/lib/filtrosColuna";
import { FiltroColuna } from "./FiltroColuna";
import { LinhaRegistro } from "./LinhaRegistro";

interface TabelaRegistrosProps {
  /** Só a fatia que deve ser exibida. */
  regras: RegraAgrupada[];
  /** As colunas visíveis agora — a Alíquota some quando nenhuma regra tem uma. */
  colunas: ColunaConsulta[];
  filtros: FiltrosColuna;
  opcoesDe: (id: string) => string[];
  onFiltrar: (id: string, valores: string[] | null) => void;
  consulta: string;
}

/** Grade de resultados da consulta. */
export function TabelaRegistros({
  regras,
  colunas,
  filtros,
  opcoesDe,
  onFiltrar,
  consulta,
}: TabelaRegistrosProps) {
  const mostrarAliquota = colunas.some((coluna) => coluna.id === "aliquota");

  return (
    <div className="bg-surface-card rounded-xl shadow-(--shadow-card) overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <caption className="sr-only">Tabela de registros do SPED</caption>
          <thead className="bg-surface-head">
            <tr>
              {colunas.map((coluna, i) => (
                <th
                  key={coluna.id}
                  scope="col"
                  className={`px-4 py-3.5 text-xs font-bold text-text-secondary uppercase tracking-widest whitespace-nowrap align-middle ${coluna.alinhamento}`}
                  style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                >
                  <div
                    className={`flex items-center gap-1 ${
                      coluna.alinhamento === "text-right" ? "justify-end" : ""
                    }`}
                  >
                    <span>{coluna.rotulo}</span>
                    {coluna.valores && (
                      <FiltroColuna
                        rotulo={coluna.rotulo}
                        opcoes={opcoesDe(coluna.id)}
                        selecionados={filtros[coluna.id]}
                        onChange={(valores) => onFiltrar(coluna.id, valores)}
                        alinharDireita={i >= colunas.length / 2}
                      />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {regras.length > 0 ? (
              regras.map((regra) => (
                <LinhaRegistro key={regra.chave} regra={regra} mostrarAliquota={mostrarAliquota} />
              ))
            ) : (
              <tr>
                <td colSpan={colunas.length} className="h-[400px] px-6 text-center align-middle">
                  <SearchX className="mx-auto h-8 w-8 text-text-tertiary mb-3" aria-hidden />
                  <p className="text-text-secondary">
                    Nenhum resultado
                    {consulta ? ` para “${consulta}”` : " para este filtro"}
                  </p>
                  <p className="text-sm text-text-tertiary mt-1">
                    Tente outro termo ou remova um filtro na barra acima.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
