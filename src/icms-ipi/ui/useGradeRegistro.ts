"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useEstadoMemoria } from "@/ganchos/useEstadoMemoria";
import { usePreferencia } from "@/ganchos/usePreferencia";
import type { FiltroAtivo } from "@/componentes/BarraFiltros";
import { COLUNA_REGISTRO } from "../leiaute/acesso";
import {
  colunasVisiveisDe,
  estadoDasColunas,
  colunasCorrigidas,
  montarColunas,
  recortarPorCampos,
  type ColunaGrade,
} from "../leiaute/colunas";
import { LIMITES } from "../limites";
import type { Achado, Severidade } from "@/regras/nucleo/contrato";
import {
  alternarSeveridade,
  camposDoRecorte,
  linhasDoRecorte,
  recorteAtivo,
  resumirRecorte,
  RECORTE_ABERTO,
  type RecorteDaGrade,
} from "../auditoria/recorte";
import type { Correcao } from "../regravacao/correcoes";
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

/** Listas vazias estáveis — mesmo motivo de SEM_ESCOLHA. */
const SEM_CORRECOES: readonly Correcao[] = [];
const SEM_ACHADOS: readonly Achado[] = [];

interface UseGradeRegistroProps {
  worker: Worker | null;
  contagens: Record<string, number>;
  /**
   * Apontamentos e correções do arquivo — a matéria-prima do recorte.
   *
   * Entram aqui para que a grade possa responder "onde estão os erros?" e "o
   * que eu já mandei corrigir?" — perguntas que nenhum filtro de coluna alcança,
   * porque a resposta não está em campo nenhum do arquivo.
   */
  achados?: readonly Achado[];
  /** TUDO que a regravação pode corrigir — é o que o recorte alcança. */
  propostas?: readonly Correcao[];
  /** O subconjunto aprovado, só para a contagem que a tela mostra. */
  correcoes?: readonly Correcao[];
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

export function useGradeRegistro({
  worker,
  contagens,
  achados = SEM_ACHADOS,
  propostas = SEM_CORRECOES,
  correcoes = SEM_CORRECOES,
}: UseGradeRegistroProps) {
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

  /**
   * O recorte é estado de SESSÃO, como "Mostrar todas".
   *
   * Depende dos apontamentos e das correções DESTE arquivo, e os dois morrem
   * com ele. Uma preferência persistida abriria o arquivo seguinte já recortado
   * por erros que não existem mais — grade vazia, sem explicação à vista.
   */
  const [recorte, setRecorte] = useEstadoMemoria<RecorteDaGrade>(
    "icms_ipi_grade_recorte",
    RECORTE_ABERTO
  );

  /** Quantas LINHAS cada marcação traria. É o que o selo de cada uma promete. */
  const resumoDoRecorte = useMemo(
    () => resumirRecorte(achados, propostas, correcoes),
    [achados, propostas, correcoes]
  );

  /**
   * As linhas do recorte. `undefined` significa "sem recorte".
   *
   * A distinção entre `undefined` e `[]` é o ponto: com uma severidade marcada e
   * nenhuma linha nela, o recorte é uma lista VAZIA e a grade fica vazia — que é
   * a resposta certa. Mandar `undefined` ali mostraria o arquivo inteiro
   * justamente quando não há nada para ver.
   */
  const linhasRecortadas = useMemo(
    () => linhasDoRecorte(achados, propostas, recorte),
    [achados, propostas, recorte]
  );

  /** Os campos que o recorte destaca — o recorte de colunas. */
  const camposRecortados = useMemo(
    () => camposDoRecorte(achados, propostas, recorte),
    [achados, propostas, recorte]
  );

  const recorte_ativo = recorteAtivo(recorte);

  /*
   * A chave carrega o recorte junto dos filtros.
   *
   * Sem isso, ligar e desligar uma marcação reaproveitaria a janela do estado
   * anterior: a grade mostraria as linhas do arquivo inteiro dizendo que são as
   * recortadas, ou o contrário.
   */
  const chave = useMemo(
    () => JSON.stringify([filtros, linhasRecortadas]),
    [filtros, linhasRecortadas]
  );
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

  /**
   * Com o modo ligado, coluna que a auditoria não mexeu vira "não se aplica".
   *
   * A regra e a guarda estão em `recortarPorCampos`, com teste próprio: é
   * lógica pura sobre conjuntos e não tem por que morar dentro de um hook.
   */
  const estadoColunas = useMemo(() => {
    const base = estadoDasColunas(colunas, opcoes);
    if (!recorte_ativo) return base;
    return recortarPorCampos(base, colunas, camposRecortados);
  }, [colunas, opcoes, recorte_ativo, camposRecortados]);

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

  /**
   * Esvazia a grade para montá-la do zero, coluna a coluna.
   *
   * É o caminho oposto ao automático, e existe porque em um planilhão de cem
   * colunas desmarcar noventa e cinco é inviável: quem sabe quais três colunas
   * quer ver chega mais rápido começando do vazio.
   *
   * Grava um `false` explícito por coluna, e não um sinalizador de "tudo
   * escondido". A diferença aparece no arquivo seguinte: com `false` por
   * coluna, uma coluna que só existe no arquivo novo continua seguindo o
   * automático em vez de nascer escondida por uma decisão que ninguém tomou
   * sobre ela.
   *
   * A coluna do registro fica de fora — é a referência da linha — e as colunas
   * com filtro ativo continuam visíveis por conta de `colunasVisiveisDe`:
   * esconder o controle que o usuário está usando esconderia o desfazer junto.
   */
  const ocultarTodasAsColunas = useCallback(() => {
    const proximo: Record<string, boolean> = {};
    for (const coluna of colunas) {
      if (coluna.nome === COLUNA_REGISTRO) continue;
      // O que o automático já esconde não precisa de decisão gravada.
      if (estadoColunas.ausentes.has(coluna.nome)) continue;
      proximo[coluna.nome] = false;
    }
    setEscolhaDeColunas(proximo);
    setRevelarTudo(false);
  }, [colunas, estadoColunas, setEscolhaDeColunas, setRevelarTudo]);

  /** Liga e desliga uma severidade do recorte. */
  const alternarSeveridadeDoRecorte = useCallback(
    (severidade: Severidade, marcada: boolean) =>
      setRecorte((atual) => alternarSeveridade(atual, severidade, marcada)),
    [setRecorte]
  );

  /** Liga e desliga as linhas que a regravação vai reescrever. */
  const alternarCorrigidasDoRecorte = useCallback(
    (marcada: boolean) => setRecorte((atual) => ({ ...atual, corrigidas: marcada })),
    [setRecorte]
  );

  /** Volta a grade ao arquivo inteiro. */
  const limparRecorte = useCallback(() => setRecorte(RECORTE_ABERTO), [setRecorte]);

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
        linhas: linhasRecortadas,
      } satisfies ParaWorker);
    },
    [worker, filtros, linhasRecortadas]
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
      linhas: linhasRecortadas,
    } satisfies ParaWorker);

    worker.postMessage({
      tipo: "VALORES_TABELA",
      requisicao: requisicaoRef.current,
      filtros,
      colunas: colunas.map((c) => c.nome),
      linhas: linhasRecortadas,
    } satisfies ParaWorker);
  }, [worker, filtros, colunas, linhasRecortadas]);

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
    ocultarTodasAsColunas,
    /** O recorte por apontamento e por correção, e como mexer nele. */
    recorte,
    recorteAtivo: recorte_ativo,
    resumoDoRecorte,
    alternarSeveridadeDoRecorte,
    alternarCorrigidasDoRecorte,
    limparRecorte,
    /** As linhas do recorte — é sobre elas que a seleção em massa age. */
    linhasRecortadas,
    /**
     * Quantas COLUNAS DA GRADE o recorte destaca.
     *
     * Não é o tamanho do conjunto de campos: nem todo campo apontado é coluna —
     * o `(delimitador final)` fala da forma da linha. Anunciar "1 coluna" ali
     * prometeria um recorte de colunas que não vai acontecer.
     */
    colunasRecortadas: colunasCorrigidas(colunas, camposRecortados).length,
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
