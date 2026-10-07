"use client";

import { useRef, type ReactNode } from "react";

import type { RegraAgrupada } from "@/consulta/agrupar";
import type { ColunaConsulta } from "@/consulta/colunas";
import type { FiltrosColuna } from "@/comum/filtrosColuna";
import { FiltroColuna } from "@/componentes/FiltroColuna";
import { NavegacaoLateral } from "@/componentes/NavegacaoLateral";
import { LinhaRegistro } from "./LinhaRegistro";

interface TabelaRegistrosProps {
  /** Só a fatia que deve ser exibida. */
  regras: RegraAgrupada[];
  /** As colunas visíveis agora — CST e Alíquota só aparecem quando dizem algo. */
  colunas: ColunaConsulta[];
  filtros: FiltrosColuna;
  opcoesDe: (id: string) => string[];
  onFiltrar: (id: string, valores: string[] | null) => void;
  /** O termo buscado, para cada linha marcar o que casou. */
  termo: string;
  /** O que vem depois da última linha, dentro da área que rola ("Mostrar mais"). */
  rodape?: ReactNode;
}

/** Grade de resultados da consulta. */
export function TabelaRegistros({
  regras,
  colunas,
  filtros,
  opcoesDe,
  onFiltrar,
  termo,
  rodape,
}: TabelaRegistrosProps) {
  const areaRef = useRef<HTMLDivElement>(null);
  const visiveis = new Set(colunas.map((coluna) => coluna.id));

  return (
    <div className="relative overflow-hidden rounded-lg border border-border-subtle bg-surface-card">
      {/*
        A tabela rola dentro da própria caixa a partir do tablet, para o
        cabeçalho fixo se ancorar nela (ver `--altura-tabela` no globals.css).
        A altura desconta o título e o resumo que esta tela põe acima da caixa.
        No celular a lista vira blocos e rola com a página: rolagem dentro de
        rolagem, num polegar, é a caixa que prende o dedo.
      */}
      <div
        ref={areaRef}
        className="custom-scrollbar md:max-h-[max(26rem,calc(100svh-var(--altura-cabecalho)-12.5rem))] md:overflow-auto"
      >
        <table className="w-full text-left max-md:block">
          <caption className="sr-only">Regras das tabelas do SPED</caption>
          {/*
            Cabeçalho FIXO. Numa tabela de mil regras, rolar cem linhas e não
            saber mais qual coluna é a natureza obriga a voltar ao topo — e o
            uso real desta tela é varrer, não ler as primeiras dez.

            O `sticky` vai na CÉLULA, não no `<thead>`: com `border-collapse` o
            navegador ignora `position: sticky` na linha e no grupo. A linha de
            baixo é sombra, e não borda, pelo mesmo motivo — borda colapsada
            fica para trás quando o conteúdo rola.
          */}
          <thead className="max-md:hidden">
            <tr>
              {colunas.map((coluna, i) => (
                <th
                  key={coluna.id}
                  scope="col"
                  className={`sticky top-0 z-10 bg-surface-card px-3 py-2 text-xs font-medium whitespace-nowrap text-text-secondary shadow-[inset_0_-1px_0_var(--border-subtle)] ${coluna.alinhamento} ${coluna.largura ?? ""}`}
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
          <tbody className="max-md:block">
            {regras.map((regra) => (
              <LinhaRegistro key={regra.chave} regra={regra} colunas={visiveis} termo={termo} />
            ))}
          </tbody>
        </table>

        {rodape}
      </div>

      <NavegacaoLateral area={areaRef} />
    </div>
  );
}
