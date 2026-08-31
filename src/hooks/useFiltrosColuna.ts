"use client";

import { useCallback, useMemo, useRef, useLayoutEffect } from "react";

import {
  contarFiltrosAtivos,
  filtrarPorColunas,
  opcoesDaColuna,
  sanearFiltros,
  type ColunaFiltravel,
  type FiltrosColuna,
} from "@/lib/filtrosColuna";
import { useEstadoMemoria } from "./useEstadoMemoria";

export interface EstadoFiltrosColuna<T> {
  /** Seleção já saneada — só contém valores que existem nos dados de agora. */
  filtros: FiltrosColuna;
  /** Os itens que passaram por todos os filtros de coluna. */
  itensFiltrados: T[];
  /** Quantas colunas estão filtrando — o contador da barra de filtros. */
  ativos: number;
  /** Opções do menu de uma coluna, já cruzadas com os filtros das outras. */
  opcoesDe: (id: string) => string[];
  /** `null` ou lista vazia desliga o filtro daquela coluna. */
  definir: (id: string, valores: string[] | null) => void;
  limpar: () => void;
}

/**
 * Todo o ciclo de vida dos filtros de coluna de uma tabela.
 *
 * `itens` é a lista ANTES dos filtros de coluna (depois da busca, do CST, dos
 * cartões de resumo). É contra ela que as opções são calculadas e as seleções
 * velhas são descartadas — usar a lista já filtrada faria o menu esconder as
 * próprias opções marcadas.
 *
 * `aoMudar` avisa a página para voltar a paginação ao topo; fica numa ref para
 * que os callbacks devolvidos mantenham a identidade entre renders.
 */
export function useFiltrosColuna<T>(
  itens: T[],
  colunas: ColunaFiltravel<T>[],
  chaveMemoria: string,
  aoMudar?: () => void
): EstadoFiltrosColuna<T> {
  const [bruto, setBruto] = useEstadoMemoria<FiltrosColuna>(chaveMemoria, {});

  const filtros = useMemo(() => sanearFiltros(itens, colunas, bruto), [itens, colunas, bruto]);

  const filtrosRef = useRef(filtros);
  const aoMudarRef = useRef(aoMudar);

  useLayoutEffect(() => {
    filtrosRef.current = filtros;
    aoMudarRef.current = aoMudar;
  }, [filtros, aoMudar]);

  const itensFiltrados = useMemo(
    () => filtrarPorColunas(itens, colunas, filtros),
    [itens, colunas, filtros]
  );

  const opcoesDe = useCallback(
    (id: string) => opcoesDaColuna(itens, colunas, filtros, id),
    [itens, colunas, filtros]
  );

  const definir = useCallback(
    (id: string, valores: string[] | null) => {
      // Parte da versão saneada, não da guardada: senão uma seleção morta que
      // ainda estava no store voltaria a valer na próxima alteração.
      const novos = { ...filtrosRef.current };
      if (!valores || valores.length === 0) delete novos[id];
      else novos[id] = valores;
      setBruto(novos);
      aoMudarRef.current?.();
    },
    [setBruto]
  );

  const limpar = useCallback(() => {
    setBruto({});
    aoMudarRef.current?.();
  }, [setBruto]);

  return {
    filtros,
    itensFiltrados,
    ativos: contarFiltrosAtivos(filtros),
    opcoesDe,
    definir,
    limpar,
  };
}
