"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useEstadoMemoria } from "@/ganchos/useEstadoMemoria";
import type { FiltroAtivo } from "@/componentes/BarraFiltros";
import { COLUNA_REGISTRO } from "../leiaute/acesso";
import { montarColunas, type ColunaGrade } from "../leiaute/colunas";
import { LIMITES } from "../limites";
import type { DoWorker, FiltrosGrade, LinhaJanela, ParaWorker } from "../leitura/protocolo";

export type { ColunaGrade };

interface UseGradeRegistroProps {
  worker: Worker | null;
  contagens: Record<string, number>;
}

/**
 * Janela carregada, sempre atrelada ao filtro que a produziu.
 *
 * Guardar as linhas junto da chave do filtro é o que impede a resposta de um
 * filtro antigo de pintar a grade de um filtro novo — e dispensa limpar o
 * estado dentro de um efeito, que provocava um render em cascata a cada
 * mudança de filtro.
 */
interface Janela {
  chave: string;
  linhas: LinhaJanela[];
  /** `null` enquanto a primeira resposta não chegou. */
  total: number | null;
}

export function useGradeRegistro({ worker, contagens }: UseGradeRegistroProps) {
  const [filtros, setFiltros] = useEstadoMemoria<FiltrosGrade>("icms_ipi_grade_filtros", {});
  const [larguras, setLarguras] = useEstadoMemoria<Record<string, number>>(
    "icms_ipi_grade_larguras",
    {}
  );

  const [opcoes, setOpcoes] = useState<Record<string, string[]>>({});
  const [truncadas, setTruncadas] = useState<string[]>([]);

  const chave = useMemo(() => JSON.stringify(filtros), [filtros]);
  const [janela, setJanela] = useState<Janela>({ chave, linhas: [], total: null });

  // A janela de um filtro que já mudou não vale mais nada.
  const atual: Janela = janela.chave === chave ? janela : { chave, linhas: [], total: null };

  const requisicaoRef = useRef(0);
  const emVooRef = useRef(new Set<number>());

  /**
   * As colunas do planilhão: uma por informação distinta do arquivo, sempre as
   * mesmas. Filtrar é escolher valores nas colunas — nunca trocar o conjunto de
   * colunas —, que é o comportamento da tela de Consulta.
   */
  const colunas = useMemo(() => montarColunas(contagens), [contagens]);

  /** Registro único escolhido no filtro, só para rotular o cabeçalho. */
  const registroSelecionado = useMemo(() => {
    const escolhidos = filtros[COLUNA_REGISTRO];
    return escolhidos?.length === 1 ? escolhidos[0] : null;
  }, [filtros]);

  // Respostas do worker.
  useEffect(() => {
    if (!worker) return;

    const aoReceber = (evento: MessageEvent<DoWorker>) => {
      const msg = evento.data;

      if (msg.tipo === "JANELA_OK") {
        // Descarta a resposta de uma requisição que já foi superada por outra.
        if (msg.requisicao !== requisicaoRef.current) return;
        emVooRef.current.delete(msg.offset);
        setJanela((anterior) => {
          const base = anterior.chave === chave ? anterior.linhas : [];
          const linhas = base.slice();
          msg.linhas.forEach((linha, i) => {
            linhas[msg.offset + i] = linha;
          });
          return { chave, linhas, total: msg.total };
        });
        return;
      }

      if (msg.tipo === "VALORES_TABELA_OK") {
        if (msg.requisicao !== requisicaoRef.current) return;
        setOpcoes(msg.valores);
        setTruncadas(msg.truncadas);
      }
    };

    worker.addEventListener("message", aoReceber);
    return () => worker.removeEventListener("message", aoReceber);
  }, [worker, chave]);

  const pedirJanela = useCallback(
    (offset: number) => {
      if (!worker) return;
      const alinhado = Math.max(0, offset);
      if (emVooRef.current.has(alinhado)) return;
      emVooRef.current.add(alinhado);
      worker.postMessage({
        tipo: "JANELA",
        requisicao: requisicaoRef.current,
        offset: alinhado,
        limite: LIMITES.LINHAS_POR_JANELA,
        filtros,
      } satisfies ParaWorker);
    },
    [worker, filtros]
  );

  /*
   * Toda mudança de filtro abre uma requisição nova: as respostas das antigas
   * passam a ser descartadas pelo número, e a primeira janela é pedida na hora
   * — sem depender do virtualizador, que com zero linhas não renderiza nada e
   * portanto nunca pediria a janela que o tiraria do zero. Era esse laço que
   * deixava a grade presa em "Carregando" para sempre depois de um filtro sem
   * resultado, mesmo depois de limpar os filtros.
   */
  useEffect(() => {
    if (!worker) return;
    requisicaoRef.current += 1;
    emVooRef.current.clear();

    worker.postMessage({
      tipo: "JANELA",
      requisicao: requisicaoRef.current,
      offset: 0,
      limite: LIMITES.LINHAS_POR_JANELA,
      filtros,
    } satisfies ParaWorker);

    worker.postMessage({
      tipo: "VALORES_TABELA",
      requisicao: requisicaoRef.current,
      filtros,
      colunas: colunas.map((c) => c.nome),
    } satisfies ParaWorker);
  }, [worker, filtros, colunas]);

  /** Pede as janelas que faltam para cobrir o intervalo visível. */
  const garantirIntervalo = useCallback(
    (primeira: number, ultima: number) => {
      if (atual.total === null) return;
      for (let i = primeira; i <= ultima; i++) {
        if (atual.linhas[i]) continue;
        pedirJanela(Math.max(0, i - LIMITES.FOLGA_DA_JANELA));
        return;
      }
    },
    [atual.total, atual.linhas, pedirJanela]
  );

  const filtrar = useCallback(
    (coluna: string, valores: string[] | null) => {
      setFiltros((anterior) => {
        const novo = { ...anterior };
        if (!valores || valores.length === 0) delete novo[coluna];
        else novo[coluna] = valores;
        return novo;
      });
    },
    [setFiltros]
  );

  const limparFiltros = useCallback(() => setFiltros({}), [setFiltros]);

  const larguraDa = useCallback(
    (id: string, padrao: number) => larguras[id] ?? padrao,
    [larguras]
  );

  const redimensionar = useCallback(
    (id: string, largura: number) => {
      setLarguras((anterior) => ({ ...anterior, [id]: Math.max(60, Math.round(largura)) }));
    },
    [setLarguras]
  );

  const filtrosAtivos = useMemo((): FiltroAtivo[] => {
    return Object.entries(filtros).map(([nome, valores]) => ({
      id: nome,
      rotulo: colunas.find((c) => c.nome === nome)?.titulo ?? nome,
      valores,
      onRemover: () => filtrar(nome, null),
    }));
  }, [filtros, colunas, filtrar]);

  return {
    linhas: atual.linhas,
    total: atual.total,
    carregando: atual.total === null,
    colunas,
    filtros,
    filtrosAtivos,
    opcoes,
    truncadas,
    registroSelecionado,
    larguraDa,
    redimensionar,
    garantirIntervalo,
    filtrar,
    limparFiltros,
  };
}
