"use client";

import { useRef } from "react";
import { SearchX } from "lucide-react";

import type { RegraAgrupada } from "@/consulta/agrupar";
import type { ColunaConsulta } from "@/consulta/colunas";
import type { FiltrosColuna } from "@/comum/filtrosColuna";
import { FiltroColuna } from "@/componentes/FiltroColuna";
import { NavegacaoLateral } from "@/componentes/NavegacaoLateral";
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
  const areaRef = useRef<HTMLDivElement>(null);
  const mostrarAliquota = colunas.some((coluna) => coluna.id === "aliquota");

  return (
    <div className="relative bg-surface-card rounded-xl shadow-(--shadow-card) overflow-hidden">
      <div
        ref={areaRef}
        className="custom-scrollbar overflow-auto"
        style={{ maxHeight: "var(--altura-tabela)" }}
      >
        <table className="min-w-full text-left">
          <caption className="sr-only">Tabela de registros do SPED</caption>
          {/*
            Cabeçalho FIXO. Numa tabela de mil regras, rolar cem linhas e não
            saber mais qual coluna é a alíquota obriga a voltar ao topo — e o
            uso real desta tela é varrer, não ler as primeiras dez.

            Ele gruda no topo da CAIXA acima, não no da janela: a caixa rola nos
            dois eixos, e para um `sticky` lá dentro a janela não existe. Tentar
            grudá-lo na janela (`top` igual à altura do cabeçalho do site) é o
            que fazia a linha de títulos subir por cima do campo de busca.
          */}
          <thead>
            <tr>
              {colunas.map((coluna, i) => (
                <th
                  key={coluna.id}
                  scope="col"
                  /*
                    O `sticky` vai na CÉLULA, não no `<thead>`: o Tailwind aplica
                    `border-collapse: collapse` em toda tabela, e com colapso de
                    bordas o navegador ignora `position: sticky` na linha e no
                    grupo.
                  */
                  className={`sticky top-0 z-10 bg-surface-head px-3 py-2 text-[11px] font-bold text-text-secondary uppercase tracking-wider whitespace-nowrap align-middle shadow-(--shadow-header) ${coluna.alinhamento}`}
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

      <NavegacaoLateral area={areaRef} />
    </div>
  );
}
