"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useEstadoMemoria } from "@/ganchos/useEstadoMemoria";
import { usePreferencia } from "@/ganchos/usePreferencia";
import type { FiltroAtivo } from "@/componentes/BarraFiltros";
import { COLUNA_REGISTRO } from "../leiaute/acesso";
import {
  colunasVisiveisDe,
  estadoDasColunas,
  montarColunas,
  type ColunaGrade,
} from "../leiaute/colunas";
import { LIMITES } from "../limites";
import type { DoWorker, FiltrosGrade, LinhaJanela, ParaWorker } from "../leitura/protocolo";

export type { ColunaGrade };

/**
 * Referência estável para "nenhuma decisão tomada ainda".
 *
 * Precisa ser constante de módulo, e não `{}` escrito na chamada:
 * `usePreferencia` devolve este mesmo objeto enquanto não há nada salvo, e um
 * literal novo a cada render faria o `useSyncExternalStore` enxergar um
 * snapshot diferente toda vez — que é como se entra num laço de re-render.
 */
const SEM_ESCOLHA: Readonly<Record<string, boolean>> = {};
const EMPTY_OPCOES: Readonly<Record<string, string[]>> = {};

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

  /*
   * As opções ficam atreladas à chave do filtro que as produziu, como a janela.
   * Sem o carimbo, entre a troca de filtro e a resposta do worker, a grade
   * desenhava as linhas do filtro novo com as colunas do filtro velho — e as
   * colunas "pulavam" duas vezes por clique.
   */
  const [opcoesBrutas, setOpcoes] = useState<{ chave: string; valores: Record<string, string[]> }>({
    chave: "",
    valores: {},
  });
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

  /**
   * Decisão EXPLÍCITA do usuário por coluna. Ausente = automático.
   *
   * Guardar só o que ele decidiu, e não a lista inteira do que está visível, é
   * o que faz a escolha envelhecer bem: um arquivo novo traz outras colunas, e
   * uma lista fechada ou esconderia as novas ou ressuscitaria as antigas. Aqui
   * o que ele não tocou continua seguindo a regra automática.
   *
   * Vai para o `localStorage` porque são nomes de campo do leiaute — dado
   * público, não conteúdo do arquivo. Os filtros, que guardam valores lidos da
   * escrituração, continuam em memória.
   */
  const [escolhaDeColunas, setEscolhaDeColunas] = usePreferencia<Record<string, boolean>>(
    "icms_ipi_colunas",
    SEM_ESCOLHA
  );

  /**
   * Colunas em que nenhuma linha do recorte atual tem valor.
   *
   * Sai de graça do que o worker já calcula para os menus de filtro: se a
   * coluna não oferece nenhum valor — ou oferece só o vazio —, não há o que ler
   * ali. Como as opções respeitam os filtros ativos, a conta acompanha o
   * recorte: filtrar por C170 esconde as colunas que só o bloco E preenche.
   *
   * Enquanto a primeira resposta não chega, `opcoes` está vazio e NADA é
   * considerado vazio — senão a grade abriria com uma coluna só e piscaria
   * inteira quando os valores chegassem.
   */
  // Opções de um filtro que já mudou não valem: `{}` tem semântica segura
  // ("ainda não sei") e mantém a grade inteira até a resposta certa chegar.
  const opcoes = opcoesBrutas.chave === chave ? opcoesBrutas.valores : EMPTY_OPCOES;
  const estadoColunas = useMemo(() => estadoDasColunas(colunas, opcoes), [colunas, opcoes]);

  /**
   * "Mostrar todas" é estado de SESSÃO, não preferência.
   *
   * A versão anterior gravava no localStorage uma decisão por coluna ausente —
   * na prática o mapa de quais blocos a escrituração do cliente tem, que
   * sobrevivia ao "Encerrar análise". É informação estrutural, não fiscal, mas
   * é rastro do arquivo e não precisa persistir: quem quer ver tudo quer ver
   * tudo agora, neste arquivo.
   */
  const [revelarTudo, setRevelarTudo] = useEstadoMemoria("icms_ipi_grade_revelar", false);

  /**
   * O que de fato vai para a grade.
   *
   * A coluna do registro nunca some: é a referência que diz de onde a linha
   * veio, e sem ela a grade fica ilegível. Uma coluna com filtro ativo também
   * não some, mesmo que o filtro a tenha esvaziado — sumir com a coluna que o
   * usuário está usando esconde o próprio controle de desfazer.
   */
  const comFiltro = useMemo(
    () => new Set(Object.keys(filtros).filter((nome) => filtros[nome]?.length)),
    [filtros]
  );

  const colunasVisiveis = useMemo(
    () =>
      revelarTudo
        ? colunas
        : colunasVisiveisDe(colunas, estadoColunas, escolhaDeColunas, comFiltro),
    [colunas, estadoColunas, escolhaDeColunas, comFiltro, revelarTudo]
  );

  /**
   * Colunas COM DADOS que estão escondidas por escolha do usuário.
   *
   * É o número que merece destaque: uma coluna "não se aplica" escondida não
   * esconde nada; uma coluna cheia escondida esconde informação fiscal — e a
   * escolha atravessa arquivos, então quem escondeu CFOP em janeiro abre
   * fevereiro sem CFOP e sem lembrar por quê.
   */
  const cheiasOcultas = useMemo(() => {
    const visiveis = new Set(colunasVisiveis.map((c) => c.nome));
    return colunas.filter(
      (c) => !visiveis.has(c.nome) && !estadoColunas.ausentes.has(c.nome)
    ).length;
  }, [colunas, colunasVisiveis, estadoColunas]);

  const alternarColuna = useCallback(
    (nome: string, visivel: boolean) => {
      /*
       * Quando a escolha coincide com o que o automático já faria, a chave é
       * APAGADA em vez de gravada.
       *
       * Sem isso a preferência só cresce: marcar e desmarcar uma coluna deixava
       * uma decisão fixa para sempre, e ela passava a valer no arquivo seguinte
       * mesmo quando o automático teria acertado sozinho. Guardar só a
       * divergência é o que faz a escolha envelhecer bem.
       */
      const automatico = !estadoColunas.ausentes.has(nome);
      const proximo = { ...escolhaDeColunas };
      if (visivel === automatico) delete proximo[nome];
      else proximo[nome] = visivel;
      setEscolhaDeColunas(proximo);
    },
    [escolhaDeColunas, setEscolhaDeColunas, estadoColunas]
  );

  /** Volta todas as colunas ao automático: preenchidas aparecem, vazias não. */
  const restaurarColunas = useCallback(() => {
    setEscolhaDeColunas({});
    setRevelarTudo(false);
  }, [setEscolhaDeColunas, setRevelarTudo]);

  /** Mostra tudo nesta sessão, inclusive o que não se aplica ao recorte. */
  const mostrarTodasAsColunas = useCallback(() => setRevelarTudo(true), [setRevelarTudo]);

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
        setOpcoes({ chave, valores: msg.valores });
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
    /** Todas as colunas do arquivo — é o universo que o seletor lista. */
    colunas,
    /** As que a grade desenha agora. */
    colunasVisiveis,
    estadoColunas,
    cheiasOcultas,
    revelarTudo,
    escolhaDeColunas,
    alternarColuna,
    restaurarColunas,
    mostrarTodasAsColunas,
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
