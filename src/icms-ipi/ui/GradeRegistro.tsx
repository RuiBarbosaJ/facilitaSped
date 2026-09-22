"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Check, Copy } from "lucide-react";

import { BarraFiltros } from "@/componentes/BarraFiltros";
import { NavegacaoLateral } from "@/componentes/NavegacaoLateral";
import { FiltroColuna } from "@/componentes/FiltroColuna";
import { COLUNA_REGISTRO, valorDaColuna } from "../leiaute/acesso";
import { larguraPadraoDe, type ColunaGrade } from "../leiaute/colunas";
import type { Achado, Severidade } from "@/regras/nucleo/contrato";
import {
  idDaCorrecao,
  type Correcao,
  type CorrecaoDeCampo,
} from "../regravacao/correcoes";
import { FiltroDeLinhas } from "./FiltroDeLinhas";
import {
  chaveDaCelula,
  marcarAuditoria,
  type MarcasDaAuditoria,
} from "../auditoria/recorte";
import {
  BORDA_SEVERIDADE,
  ESTILO_SEVERIDADE,
  FUNDO_SEVERIDADE,
  ROTULO_SEVERIDADE,
  TAMANHO_ICONE_FIXO,
} from "./colunasAchados";
import { descreverValor, temDominio } from "../leiaute/dominios";
import { LIMITES } from "../limites";
import { SeletorColunas } from "./SeletorColunas";
import { useGradeRegistro } from "./useGradeRegistro";

export interface GradeRegistroProps {
  worker: Worker | null;
  contagens: Record<string, number>;
  /** Apontamentos do arquivo — é por eles que a grade recorta por severidade. */
  achados?: readonly Achado[];
  /**
   * TUDO o que a regravação pode corrigir, aprovado ou não.
   *
   * A grade precisa das propostas inteiras, e não só das aprovadas, porque é
   * nela que o contador APROVA: a caixa de cada linha só existe onde há algo a
   * aprovar. Nenhum valor corrigido é desenhado aqui — a grade continua
   * mostrando o arquivo COMO ELE FOI LIDO, que é o que ele confere.
   */
  propostas?: readonly Correcao[];
  /** Ids já aprovados. É o que marca a caixa de cada linha. */
  aprovadas?: readonly string[];
  /** Aprova ou reprova, de uma vez, tudo o que cai nestas linhas. */
  onAlternarLinhas?: (linhas: readonly number[], aprovar: boolean) => void;
}

const ALTURA_DA_LINHA = 34;
const LARGURA_DA_NUMERACAO = 72;
/** A mesma coluna, com espaço para a caixa de aprovação. */
const LARGURA_COM_SELECAO = 108;

/** Campos numéricos alinham à direita, como em qualquer planilha contábil. */
const TIPOS_NUMERICOS = new Set(["valor", "quantidade", "aliquota"]);

/**
 * O que a coluna é, em uma linha, no topo do menu de filtro.
 *
 * Numa planilha de mais de cem colunas o rótulo curto ("Nº Doc.", "Cód.") não
 * basta: o contador precisa saber qual campo do layout é aquele e em quais
 * registros ele aparece — porque só as linhas desses registros têm valor ali.
 */
function descricaoDaColuna(coluna: ColunaGrade): string {
  if (coluna.nome === COLUNA_REGISTRO) {
    return "Código do registro SPED de cada linha do arquivo.";
  }

  const onde =
    coluna.registros.length === 1
      ? `presente no registro ${coluna.registros[0]}`
      : `presente nos registros ${coluna.registros.join(", ")}`;
  const decodificada = temDominio(coluna.nome)
    ? " Os valores abaixo vêm com o significado do Guia Prático."
    : "";

  return `Campo ${coluna.nome} do layout, ${onde}.${decodificada}`;
}

const SEM_PROPOSTAS: readonly Correcao[] = [];
const SEM_APROVADAS: readonly string[] = [];

export function GradeRegistro({
  worker,
  contagens,
  achados,
  propostas = SEM_PROPOSTAS,
  aprovadas = SEM_APROVADAS,
  onAlternarLinhas,
}: GradeRegistroProps) {
  /*
   * O que VAI para o arquivo — e não o que poderia ir.
   *
   * É a régua das duas coisas que dependem dela: o recorte por "Corrigidas" e
   * a prévia na célula. Proposta não aprovada não é correção: mostrá-la como
   * corrigida faria a grade prometer um arquivo que a exportação não gera.
   */
  const correcoesAprovadas = useMemo(() => {
    const marcadas = new Set(aprovadas);
    return propostas.filter((c) => marcadas.has(idDaCorrecao(c)));
  }, [propostas, aprovadas]);
  const {
    linhas,
    total,
    carregando,
    // A grade desenha as VISÍVEIS; o seletor precisa do universo inteiro.
    colunas: todasAsColunas,
    colunasVisiveis: colunas,
    estadoColunas,
    cheiasOcultas,
    revelarTudo,
    escolhaDeColunas,
    alternarColuna,
    restaurarColunas,
    mostrarTodasAsColunas,
    ocultarTodasAsColunas,
    recorte,
    recorteAtivo,
    resumoDoRecorte,
    alternarSeveridadeDoRecorte,
    alternarCorrigidasDoRecorte,
    limparRecorte,
    linhasRecortadas,
    colunasRecortadas,
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
  } = useGradeRegistro({
    worker,
    contagens,
    achados,
    propostas,
    correcoes: correcoesAprovadas,
  });

  /**
   * As propostas de cada linha do arquivo.
   *
   * Só as de campo: a correção que INSERE linha não tem linha no arquivo lido e
   * portanto não tem caixa que a alcance — ela é aprovada na revisão.
   */
  const propostasPorLinha = useMemo(() => {
    const mapa = new Map<number, Correcao[]>();
    for (const proposta of propostas) {
      if (proposta.tipo !== "campo") continue;
      const lista = mapa.get(proposta.nl);
      if (lista) lista.push(proposta);
      else mapa.set(proposta.nl, [proposta]);
    }
    return mapa;
  }, [propostas]);

  const idsAprovados = useMemo(() => new Set(aprovadas), [aprovadas]);

  /**
   * A correção de cada célula — aprovada ou apenas sugerida.
   *
   * As DUAS entram, e é isso que responde à pergunta de quem abre uma linha
   * vermelha: "existe conserto para isto?". Mostrar só as aprovadas escondia
   * justamente o caso em que a resposta importa — a sugestão nasce desmarcada,
   * então a célula ficaria igual a uma sem conserto nenhum, e o contador não
   * teria como saber que bastava um clique.
   *
   * A aprovada aparece como RESULTADO (o valor novo no lugar do antigo); a
   * sugerida aparece como PROPOSTA (o valor atual, e o proposto ao lado da
   * seta). São estados visualmente diferentes porque são fatos diferentes: um
   * vai para o arquivo, o outro ainda não.
   *
   * Só correção de CAMPO entra. A que insere linha não tem célula onde pousar,
   * e a de forma — o delimitador final — não muda campo nenhum: ela aparece na
   * caixa de aprovação da linha, que é onde ela de fato acontece.
   */
  const correcaoPorCelula = useMemo(() => {
    const aprovadasPorId = new Set(correcoesAprovadas.map(idDaCorrecao));
    const mapa = new Map<
      string,
      { correcao: CorrecaoDeCampo; aprovada: boolean }
    >();
    for (const correcao of propostas) {
      if (correcao.tipo !== "campo") continue;
      mapa.set(chaveDaCelula(correcao.nl, correcao.campo), {
        correcao,
        aprovada: aprovadasPorId.has(idDaCorrecao(correcao)),
      });
    }
    return mapa;
  }, [propostas, correcoesAprovadas]);

  /**
   * Onde a auditoria encostou, indexado.
   *
   * Montado uma vez por arquivo: a grade redesenha dezenas de células por
   * quadro de rolagem, e varrer a lista de achados a cada célula seria O(células
   * × achados) — dezenas de milhões de comparações por rolagem num arquivo com
   * o teto de apontamentos cheio.
   */
  const marcas = useMemo(() => marcarAuditoria(achados ?? []), [achados]);

  /** A coluna de seleção só existe quando há algo a aprovar. */
  const podeSelecionar =
    propostasPorLinha.size > 0 && Boolean(onAlternarLinhas);
  const larguraDaNumeracao = podeSelecionar
    ? LARGURA_COM_SELECAO
    : LARGURA_DA_NUMERACAO;

  /** Linha aprovada é linha em que TODAS as propostas estão aprovadas. */
  const linhaAprovada = useCallback(
    (nl: number) => {
      const lista = propostasPorLinha.get(nl);
      if (!lista || lista.length === 0) return false;
      return lista.every((c) => idsAprovados.has(idDaCorrecao(c)));
    },
    [propostasPorLinha, idsAprovados],
  );

  /**
   * As linhas que a caixa do cabeçalho alcança.
   *
   * É o RECORTE que manda, não a janela carregada: a grade é virtualizada e só
   * tem em memória as linhas que já rolaram para a tela. Marcar "todas" com
   * base nelas aprovaria um punhado e deixaria o resto para trás, sem nada
   * dizendo isso.
   */
  const linhasSelecionaveis = useMemo(() => {
    if (!linhasRecortadas) return [...propostasPorLinha.keys()];
    return linhasRecortadas.filter((nl) => propostasPorLinha.has(nl));
  }, [linhasRecortadas, propostasPorLinha]);

  const aprovadasNoRecorte = useMemo(
    () => linhasSelecionaveis.filter(linhaAprovada).length,
    [linhasSelecionaveis, linhaAprovada],
  );

  const alternarLinha = useCallback(
    (nl: number, aprovar: boolean) => onAlternarLinhas?.([nl], aprovar),
    [onAlternarLinhas],
  );

  const areaRef = useRef<HTMLDivElement>(null);
  const [copiada, setCopiada] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState("");

  /** Célula com o foco do teclado (padrão de grade: um único ponto de tabulação). */
  const [foco, setFoco] = useState({ linha: 0, coluna: 0 });

  const totalDeLinhas = total ?? 0;

  const virtualizador = useVirtualizer({
    count: totalDeLinhas,
    getScrollElement: () => areaRef.current,
    estimateSize: () => ALTURA_DA_LINHA,
    overscan: 10,
  });

  /** Largura das colunas fixas: a seta da esquerda não pode cobri-las. */
  const larguraFixa =
    larguraDaNumeracao +
    (colunas[0]
      ? larguraDa(`col_${colunas[0].nome}`, larguraPadraoDe(colunas[0]))
      : 0);

  const linhasVirtuais = virtualizador.getVirtualItems();
  const primeira = linhasVirtuais[0]?.index ?? 0;
  const ultima = linhasVirtuais[linhasVirtuais.length - 1]?.index ?? 0;

  useEffect(() => {
    if (linhasVirtuais.length > 0) garantirIntervalo(primeira, ultima);
  }, [primeira, ultima, linhasVirtuais.length, garantirIntervalo]);

  const copiar = useCallback(
    async (valor: string, id: string, rotulo: string) => {
      if (!valor) return;
      try {
        await navigator.clipboard.writeText(valor);
        setCopiada(id);
        setAnuncio(`${rotulo} copiado.`);
        window.setTimeout(
          () => setCopiada((atual) => (atual === id ? null : atual)),
          1500,
        );
      } catch {
        setAnuncio(
          `Não foi possível copiar ${rotulo}: o navegador bloqueou a área de transferência.`,
        );
      }
    },
    [],
  );

  /*
   * Navegação por teclado.
   *
   * Com virtualização, marcar toda célula como focável criaria centenas de
   * paradas de Tab e ainda assim deixaria de fora tudo o que não está
   * renderizado. O padrão de grade resolve os dois: uma única parada de Tab, e
   * as setas movem o foco — arrastando a rolagem junto quando a próxima linha
   * ainda não foi montada.
   */
  const navegar = useCallback(
    (evento: React.KeyboardEvent<HTMLTableSectionElement>) => {
      const ultimaColuna = colunas.length;
      const ultimaLinha = Math.max(0, totalDeLinhas - 1);
      const destino = { ...foco };

      switch (evento.key) {
        case "ArrowDown":
          destino.linha = Math.min(ultimaLinha, foco.linha + 1);
          break;
        case "ArrowUp":
          destino.linha = Math.max(0, foco.linha - 1);
          break;
        case "ArrowRight":
          destino.coluna = Math.min(ultimaColuna, foco.coluna + 1);
          break;
        case "ArrowLeft":
          destino.coluna = Math.max(0, foco.coluna - 1);
          break;
        case "PageDown":
          destino.linha = Math.min(ultimaLinha, foco.linha + 20);
          break;
        case "PageUp":
          destino.linha = Math.max(0, foco.linha - 20);
          break;
        case "Home":
          destino.coluna = 0;
          if (evento.ctrlKey) destino.linha = 0;
          break;
        case "End":
          destino.coluna = ultimaColuna;
          if (evento.ctrlKey) destino.linha = ultimaLinha;
          break;
        default:
          return;
      }

      evento.preventDefault();
      setFoco(destino);
      if (destino.linha !== foco.linha)
        virtualizador.scrollToIndex(destino.linha);
    },
    [colunas.length, foco, totalDeLinhas, virtualizador],
  );

  /*
   * Traz o foco de volta para dentro da grade quando ela encolhe.
   *
   * O conjunto de colunas mudou de fixo para variável: esconder as vazias, ou
   * filtrar por um registro, reduz a grade em tempo de execução. Sem este
   * ajuste, quem estava com o foco na coluna 60 e viu a grade cair para 12
   * ficava com o teclado morto — `ArrowLeft` andava uma casa por vez a partir
   * de 60, e nenhuma delas existia para receber foco, então nada acontecia na
   * tela por dezenas de teclas.
   */
  useEffect(() => {
    setFoco((atual) =>
      atual.coluna > colunas.length
        ? { ...atual, coluna: colunas.length }
        : atual,
    );
  }, [colunas.length]);

  // Devolve o foco do DOM à célula ativa — inclusive depois de a rolagem
  // finalmente montar a linha para onde o teclado apontou.
  useEffect(() => {
    const area = areaRef.current;
    if (!area || !area.contains(document.activeElement)) return;
    area
      .querySelector<HTMLElement>(
        `[data-celula="${foco.linha}-${foco.coluna}"]`,
      )
      ?.focus({ preventScroll: true });
  }, [foco, linhasVirtuais.length]);

  const cabecalhos = useMemo(
    () =>
      colunas.map((coluna, indice) => {
        const id = `col_${coluna.nome}`;
        const padrao = larguraPadraoDe(coluna);
        const fixa = coluna.nome === COLUNA_REGISTRO;

        return (
          <th
            key={coluna.nome}
            scope="col"
            aria-colindex={indice + 2}
            className={`shrink-0 border-r border-border-subtle bg-surface-head px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary whitespace-nowrap relative ${
              fixa ? "sticky z-40 shadow-[2px_0_4px_-1px_rgb(0_0_0/0.08)]" : ""
            }`}
            style={{
              width: larguraDa(id, padrao),
              left: fixa ? larguraDaNumeracao : undefined,
            }}
          >
            <div className="flex items-center gap-1.5 pr-1">
              <SeloDaColuna marca={marcas.colunas.get(coluna.nome)} />
              <span
                className="truncate"
                title={`${coluna.titulo} (${coluna.nome})`}
              >
                {coluna.titulo}
              </span>
              <FiltroColuna
                rotulo={coluna.titulo}
                opcoes={opcoes[coluna.nome] ?? []}
                selecionados={filtros[coluna.nome]}
                onChange={(valores) => filtrar(coluna.nome, valores)}
                alinharDireita={indice > colunas.length * 0.6}
                descricao={descricaoDaColuna(coluna)}
                descreverValor={(valor) => descreverValor(coluna.nome, valor)}
              />
            </div>
            <AlcaDeRedimensionamento
              rotulo={coluna.titulo}
              largura={larguraDa(id, padrao)}
              onLargura={(largura) => redimensionar(id, largura)}
            />
          </th>
        );
      }),
    [
      colunas,
      filtros,
      filtrar,
      larguraDa,
      larguraDaNumeracao,
      marcas,
      opcoes,
      redimensionar,
    ],
  );

  /** Colunas com filtro ativo: o seletor as trava visíveis. */
  const colunasFiltradas = useMemo(
    () => new Set(Object.keys(filtros).filter((nome) => filtros[nome]?.length)),
    [filtros],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BarraFiltros filtros={filtrosAtivos} onLimparTudo={limparFiltros} />
        <SeletorColunas
          colunas={todasAsColunas}
          visiveis={colunas}
          marcas={marcas}
          estado={estadoColunas}
          escolha={escolhaDeColunas}
          onAlternar={alternarColuna}
          onRestaurar={restaurarColunas}
          onMostrarTodas={mostrarTodasAsColunas}
          onOcultarTodas={ocultarTodasAsColunas}
          recortadoPorCorrecoes={recorteAtivo && colunasRecortadas > 0}
          fixa={COLUNA_REGISTRO}
          filtradas={colunasFiltradas}
          cheiasOcultas={cheiasOcultas}
          revelarTudo={revelarTudo}
        />
      </div>

      <FiltroDeLinhas
        recorte={recorte}
        resumo={resumoDoRecorte}
        onAlternarSeveridade={alternarSeveridadeDoRecorte}
        onAlternarCorrigidas={alternarCorrigidasDoRecorte}
        onLimpar={limparRecorte}
      />

      {recorteAtivo && (
        <p
          role="status"
          className="rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-xs text-accent"
        >
          {(linhasRecortadas?.length ?? 0) === 0
            ? "Nenhuma linha do arquivo corresponde ao recorte — por isso a grade está vazia."
            : `Mostrando ${
                linhasRecortadas?.length === 1
                  ? "a única linha"
                  : `as ${(linhasRecortadas?.length ?? 0).toLocaleString("pt-BR")} linhas`
              } que o recorte alcança${
                colunasRecortadas > 0
                  ? `, com ${colunasRecortadas === 1 ? "a coluna apontada" : `as ${colunasRecortadas} colunas apontadas`}`
                  : " — nenhum apontamento aponta uma célula específica, então as colunas continuam como estavam"
              }.`}{" "}
          A célula com seta mostra o conserto: em verde, o que já vai para o
          arquivo gerado; em azul tracejado, o que está sugerido e espera a
          caixa da linha ser marcada. O resto da grade é o arquivo como ele
          veio, e o motivo de cada correção está na lista de apontamentos.
          {resumoDoRecorte.linhasNovas > 0 &&
            ` ${resumoDoRecorte.linhasNovas === 1 ? "Uma linha nova será inserida e não aparece" : `${resumoDoRecorte.linhasNovas} linhas novas serão inseridas e não aparecem`} aqui — ${resumoDoRecorte.linhasNovas === 1 ? "ela só existe" : "elas só existem"} no TXT gerado.`}
        </p>
      )}

      {truncadas.length > 0 && (
        <p className="text-xs text-text-tertiary">
          As colunas {truncadas.join(", ")} têm mais de{" "}
          {LIMITES.OPCOES_POR_COLUNA.toLocaleString("pt-BR")} valores distintos;
          o menu lista apenas os primeiros. Use a busca dentro do menu para
          chegar a um valor específico.
        </p>
      )}

      <div
        className="relative flex flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-card shadow-(--shadow-card)"
        style={{ height: "var(--altura-tabela)" }}
      >
        <div
          ref={areaRef}
          role="region"
          aria-label="Linhas do arquivo SPED"
          tabIndex={0}
          className="custom-scrollbar flex-1 overflow-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
          style={{ isolation: "isolate" }}
        >
          <table
            role="grid"
            aria-label={
              registroSelecionado
                ? `Linhas do registro ${registroSelecionado}`
                : "Linhas do arquivo SPED"
            }
            aria-rowcount={totalDeLinhas + 1}
            aria-colcount={colunas.length + 1}
            className="w-full border-collapse text-sm"
            style={{ display: "grid" }}
          >
            <caption className="sr-only">
              Uma coluna por campo do layout. Cada linha preenche apenas as
              colunas do seu registro. Use as setas para navegar entre as
              células e Enter para copiar a célula em foco.
            </caption>

            <thead
              className="sticky top-0 bg-surface-head"
              style={{ display: "grid", zIndex: 30 }}
            >
              <tr
                aria-rowindex={1}
                style={{
                  display: "flex",
                  width: "max-content",
                  minWidth: "100%",
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                <th
                  scope="col"
                  aria-colindex={1}
                  className="sticky left-0 z-50 flex shrink-0 items-center gap-2 border-r border-border-subtle bg-surface-head px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary"
                  style={{ width: larguraDaNumeracao }}
                >
                  {podeSelecionar && (
                    <input
                      type="checkbox"
                      /*
                       * Desabilitada quando o recorte não alcança nenhuma linha
                       * corrigível. Habilitada, ela era um clique que não fazia
                       * nada: o usuário marcava, nada mudava, e não havia nada
                       * na tela dizendo que o recorte era o motivo.
                       */
                      disabled={linhasSelecionaveis.length === 0}
                      className="shrink-0 rounded border-border-strong text-accent focus:ring-accent disabled:cursor-not-allowed disabled:opacity-40"
                      checked={
                        linhasSelecionaveis.length > 0 &&
                        aprovadasNoRecorte === linhasSelecionaveis.length
                      }
                      /*
                       * Indeterminado é o terceiro estado que o HTML só aceita
                       * por propriedade, nunca por atributo — e é ele que
                       * impede a caixa de mentir: com metade das linhas
                       * aprovadas, uma caixa vazia diria "nada aprovado".
                       */
                      ref={(elemento) => {
                        if (!elemento) return;
                        elemento.indeterminate =
                          aprovadasNoRecorte > 0 &&
                          aprovadasNoRecorte < linhasSelecionaveis.length;
                      }}
                      onChange={(evento) =>
                        onAlternarLinhas?.(
                          linhasSelecionaveis,
                          evento.target.checked,
                        )
                      }
                      aria-label={`Aprovar a correção das ${linhasSelecionaveis.length} linhas corrigíveis do recorte`}
                      title={
                        linhasSelecionaveis.length === 0
                          ? "Nenhuma linha do recorte atual tem correção proposta. Limpe as marcações de severidade para alcançar as linhas que têm."
                          : `${aprovadasNoRecorte} de ${linhasSelecionaveis.length} ${
                              linhasSelecionaveis.length === 1
                                ? "linha corrigível"
                                : "linhas corrigíveis"
                            } aprovadas. A caixa age sobre o recorte inteiro, e não apenas sobre o que está na tela.`
                      }
                    />
                  )}
                  Linha
                </th>
                {cabecalhos}
              </tr>
            </thead>

            <tbody
              onKeyDown={navegar}
              style={{
                display: "grid",
                height: `${virtualizador.getTotalSize()}px`,
                position: "relative",
              }}
            >
              {linhasVirtuais.map((linhaVirtual) => {
                const dados = linhas[linhaVirtual.index];
                const fundo =
                  linhaVirtual.index % 2 !== 0
                    ? "var(--surface-page)"
                    : "var(--surface-card)";

                return (
                  <tr
                    key={linhaVirtual.index}
                    aria-rowindex={linhaVirtual.index + 2}
                    className="absolute left-0 top-0 flex border-b border-border-subtle"
                    style={{
                      width: "max-content",
                      minWidth: "100%",
                      height: `${linhaVirtual.size}px`,
                      transform: `translateY(${linhaVirtual.start}px)`,
                      backgroundColor: fundo,
                    }}
                  >
                    {dados ? (
                      <Celulas
                        indiceDaLinha={linhaVirtual.index}
                        numeroDaLinha={dados.nl}
                        campos={dados.campos}
                        colunas={colunas}
                        fundo={fundo}
                        larguraDaNumeracao={larguraDaNumeracao}
                        marcas={marcas}
                        correcoes={correcaoPorCelula}
                        selecionavel={
                          podeSelecionar && propostasPorLinha.has(dados.nl)
                        }
                        aprovada={linhaAprovada(dados.nl)}
                        onAlternarLinha={alternarLinha}
                        foco={foco}
                        copiada={copiada}
                        larguraDa={larguraDa}
                        onFoco={setFoco}
                        onCopiar={copiar}
                      />
                    ) : (
                      <td
                        className="flex items-center px-3 py-2 text-xs text-text-tertiary"
                        style={{ width: larguraDaNumeracao }}
                      >
                        …
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {totalDeLinhas === 0 && (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-text-secondary">
              {carregando ? (
                <span>Carregando as linhas…</span>
              ) : (
                <>
                  <span>Nenhuma linha corresponde aos filtros aplicados.</span>
                  {filtrosAtivos.length > 0 && (
                    <button
                      type="button"
                      onClick={limparFiltros}
                      className="rounded-lg border border-border-strong px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
                    >
                      Limpar filtros
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <NavegacaoLateral area={areaRef} recuoEsquerda={larguraFixa} />
      </div>

      <p className="text-xs text-text-tertiary" aria-live="polite">
        {total === null
          ? "Carregando…"
          : `${total.toLocaleString("pt-BR")} ${total === 1 ? "linha" : "linhas"}${
              filtrosAtivos.length > 0 ? " com os filtros aplicados" : ""
            } · ${colunas.length} de ${todasAsColunas.length} colunas${
              todasAsColunas.length > colunas.length
                ? ` (${todasAsColunas.length - colunas.length} ocultas: ${
                    estadoColunas.ausentes.size
                  } não se aplicam ao recorte${
                    Object.keys(escolhaDeColunas).length > 0
                      ? ", o resto por sua escolha"
                      : ""
                  })`
                : ""
            }.`}
      </p>

      <p className="sr-only" role="status" aria-live="polite">
        {anuncio}
      </p>
    </div>
  );
}

interface CelulasProps {
  indiceDaLinha: number;
  numeroDaLinha: number;
  campos: string[];
  colunas: ColunaGrade[];
  fundo: string;
  larguraDaNumeracao: number;
  marcas: MarcasDaAuditoria;
  /** Correções por célula (`nl|campo`), aprovadas e sugeridas. */
  correcoes: ReadonlyMap<
    string,
    { correcao: CorrecaoDeCampo; aprovada: boolean }
  >;
  /** A linha tem correção a aprovar — só então a caixa existe. */
  selecionavel: boolean;
  aprovada: boolean;
  onAlternarLinha: (nl: number, aprovar: boolean) => void;
  foco: { linha: number; coluna: number };
  copiada: string | null;
  larguraDa: (id: string, padrao: number) => number;
  onFoco: (foco: { linha: number; coluna: number }) => void;
  onCopiar: (valor: string, id: string, rotulo: string) => void;
}

function Celulas({
  indiceDaLinha,
  numeroDaLinha,
  campos,
  colunas,
  fundo,
  larguraDaNumeracao,
  marcas,
  correcoes,
  selecionavel,
  aprovada,
  onAlternarLinha,
  foco,
  copiada,
  larguraDa,
  onFoco,
  onCopiar,
}: CelulasProps) {
  const podeReservar = larguraDaNumeracao > LARGURA_DA_NUMERACAO;
  /*
   * A linha inteira é marcada com uma faixa na lateral do número.
   *
   * É o que dá corpo ao apontamento que fala do DOCUMENTO e não de uma célula —
   * "documento sem registro analítico" não tem coluna para pintar. Sem a faixa,
   * a linha apareceria no recorte por "Erro" sem nada colorido, e a primeira
   * pergunta de quem olha seria "por que esta linha está aqui?".
   */
  const daLinha = marcas.linhas.get(numeroDaLinha);

  const celulas = [
    <td
      key="numero"
      role="gridcell"
      aria-colindex={1}
      data-celula={`${indiceDaLinha}-0`}
      tabIndex={foco.linha === indiceDaLinha && foco.coluna === 0 ? 0 : -1}
      onFocus={() => onFoco({ linha: indiceDaLinha, coluna: 0 })}
      /*
       * A caixa é operada pela PRÓPRIA CÉLULA no teclado, e não por foco
       * próprio. Numa grade virtualizada, um `input` focável por linha criaria
       * centenas de paradas de Tab que aparecem e somem com a rolagem; aqui a
       * seta chega à célula e o espaço aprova, como o Enter copia nas outras.
       */
      onKeyDown={(evento) => {
        if (!selecionavel) return;
        if (evento.key !== " " && evento.key !== "Enter") return;
        evento.preventDefault();
        onAlternarLinha(numeroDaLinha, !aprovada);
      }}
      title={
        daLinha
          ? `Linha com apontamento de severidade ${ROTULO_SEVERIDADE[daLinha].toLowerCase()}.`
          : undefined
      }
      className={`sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r border-border-subtle py-2 pr-3 font-mono text-[11px] text-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
        daLinha
          ? `border-l-[3px] pl-[9px] ${BORDA_SEVERIDADE[daLinha]}`
          : "pl-3"
      }`}
      style={{ width: larguraDaNumeracao, backgroundColor: fundo }}
    >
      {selecionavel ? (
        <input
          type="checkbox"
          tabIndex={-1}
          checked={aprovada}
          onChange={(evento) =>
            onAlternarLinha(numeroDaLinha, evento.target.checked)
          }
          onClick={(evento) => evento.stopPropagation()}
          aria-label={`Aprovar a correção da linha ${numeroDaLinha}`}
          title="Esta linha tem correção proposta. Marque para que ela entre no TXT gerado."
          className="shrink-0 rounded border-border-strong text-accent focus:ring-accent"
        />
      ) : (
        /*
         * A linha sem proposta mostra um traço, não um vazio.
         *
         * O espaço em branco reservado alinhava os números e não dizia nada:
         * quem tentava marcar uma linha apontada e não achava a caixa ficava
         * sem saber se o controle não existia ou se ele é que não tinha
         * encontrado. O traço afirma — e o título explica.
         */
        podeReservar && (
          <span
            className="w-3.5 shrink-0 text-center text-text-tertiary/60"
            title="Esta linha não tem correção proposta: a auditoria não tem valor a propor para ela."
          >
            –
          </span>
        )
      )}
      {numeroDaLinha}
    </td>,
  ];

  colunas.forEach((coluna, indice) => {
    const bruto = valorDaColuna(campos, coluna.nome);
    /*
     * `null` e `""` são fatos diferentes e a célula mostra os dois de jeitos
     * diferentes. `null` = o registro desta linha nem possui o campo: não se
     * aplica, traço esmaecido. `""` = o campo existe e veio vazio: se era
     * obrigatório, é o erro que o contador está procurando, e não pode ter a
     * mesma cara do "não se aplica".
     */
    const naoSeAplica = bruto === null;
    const valor = bruto ?? "";
    const id = `${indiceDaLinha}-${indice + 1}`;
    const ativa = foco.linha === indiceDaLinha && foco.coluna === indice + 1;
    const numerica = TIPOS_NUMERICOS.has(coluna.tipo);
    const fixa = coluna.nome === COLUNA_REGISTRO;
    const significado = descreverValor(coluna.nome, valor);
    const conserto = correcoes.get(chaveDaCelula(numeroDaLinha, coluna.nome));
    const corrigida = conserto?.aprovada ? conserto.correcao : null;
    const sugerida = conserto && !conserto.aprovada ? conserto.correcao : null;
    const apontada = marcas.celulas.get(
      chaveDaCelula(numeroDaLinha, coluna.nome),
    );
    /*
     * A correção vence a severidade na pintura.
     *
     * A célula que já vai sair corrigida não é mais um problema a resolver —
     * mantê-la vermelha mandaria o contador conferir de novo o que ele acabou
     * de aprovar. O porquê da correção continua na lista de apontamentos, que
     * é onde ele lê o detalhe; aqui ele vê o resultado.
     */
    const pintura = corrigida
      ? null
      : apontada
        ? FUNDO_SEVERIDADE[apontada]
        : null;

    celulas.push(
      <td
        key={coluna.nome}
        role="gridcell"
        aria-colindex={indice + 2}
        data-celula={id}
        tabIndex={ativa ? 0 : -1}
        aria-label={`${coluna.titulo}: ${
          valor ? `${valor}${significado ? `, ${significado}` : ""}` : "vazio"
        }${
          corrigida
            ? `, será corrigido para ${corrigida.para || "vazio"}`
            : sugerida
              ? `, com correção sugerida para ${sugerida.para || "vazio"}, ainda não aprovada`
              : apontada
                ? `, com apontamento de severidade ${ROTULO_SEVERIDADE[apontada].toLowerCase()}`
                : ""
        }`}
        title={
          corrigida
            ? `${corrigida.motivo} O valor no arquivo gerado será "${corrigida.para}"; o importado era "${corrigida.de}".`
            : sugerida
              ? `Correção sugerida: trocar "${sugerida.de}" por "${sugerida.para}". ${sugerida.motivo} Marque a caixa da linha ${numeroDaLinha} para que ela entre no arquivo gerado.`
              : apontada
                ? `Este campo tem apontamento de severidade ${ROTULO_SEVERIDADE[apontada].toLowerCase()}. O detalhe está na lista de apontamentos, pela linha ${numeroDaLinha}.`
                : undefined
        }
        onFocus={() => onFoco({ linha: indiceDaLinha, coluna: indice + 1 })}
        onClick={() => onFoco({ linha: indiceDaLinha, coluna: indice + 1 })}
        onKeyDown={(evento) => {
          if (evento.key !== "Enter" && evento.key !== " ") return;
          evento.preventDefault();
          onCopiar(valor, id, coluna.titulo);
        }}
        /*
         * A célula pintada não recebe o realce de hover.
         *
         * O realce é um azul translúcido por cima do fundo: sobre a célula
         * apontada ele lava a cor da severidade justamente enquanto o ponteiro
         * está nela — o momento em que o usuário está olhando para ela.
         */
        className={`group/celula relative flex shrink-0 items-center border-r border-border-subtle px-3 py-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
          pintura ? "" : "hover:bg-accent-soft/40"
        } ${
          numerica ? "justify-end font-mono" : "justify-start"
        } ${fixa ? "sticky z-20 font-mono font-medium shadow-[2px_0_4px_-1px_rgb(0_0_0/0.08)]" : ""} ${
          corrigida
            ? "bg-success-soft font-medium"
            : pintura
              ? `${pintura.celula} font-medium`
              : ""
        }`}
        style={{
          width: larguraDa(`col_${coluna.nome}`, larguraPadraoDe(coluna)),
          left: fixa ? larguraDaNumeracao : undefined,
          // A pintura vem por classe; o fundo em linha da coluna fixa a
          // apagaria, então ele sai de cena quando a célula está pintada.
          backgroundColor: fixa && !pintura && !corrigida ? fundo : undefined,
        }}
      >
        {corrigida || sugerida ? (
          /*
            A MESMA forma da aba de PIS/COFINS: o valor antigo riscado, a seta,
            o novo em destaque. As duas abas fazem a mesma promessa — "é assim
            que vai ficar" —, e duas gramáticas para a mesma promessa obrigam
            quem usa as duas a reaprender a ler a cada troca de tela.

            O que muda entre elas é só a cor do valor novo, porque o fato é
            outro: verde quando a correção já entra no arquivo, azul tracejado
            enquanto ela espera a caixa da linha ser marcada.
          */
          <span className="flex min-w-0 items-baseline gap-1 whitespace-nowrap">
            {/* O valor antigo é referência, não resposta: entra menor, para
                sobrar largura ao que de fato vai para o arquivo. */}
            <span className="truncate text-[11px] text-text-tertiary line-through">
              {(corrigida ?? sugerida)!.de || "—"}
            </span>
            <span className="shrink-0 text-text-tertiary">→</span>
            <span
              className={
                corrigida
                  ? "shrink-0 font-semibold text-success"
                  : "shrink-0 font-semibold text-accent underline decoration-dashed underline-offset-2"
              }
            >
              {(corrigida ?? sugerida)!.para || "(vazio)"}
            </span>
          </span>
        ) : valor ? (
          <span
            className={`truncate ${pintura ? pintura.texto : "text-text-primary"}`}
            title={significado ? `${valor} — ${significado}` : valor}
          >
            {valor}
          </span>
        ) : (
          <span
            aria-hidden={naoSeAplica}
            aria-label={naoSeAplica ? undefined : "campo em branco"}
            title={
              naoSeAplica
                ? undefined
                : "Campo em branco: o registro possui o campo e ele não foi preenchido"
            }
            className={
              naoSeAplica
                ? "text-text-tertiary/60"
                : "font-medium text-warning/80"
            }
          >
            {naoSeAplica ? "—" : "∅"}
          </span>
        )}

        {valor && (
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            onClick={(evento) => {
              evento.stopPropagation();
              onCopiar(valor, id, coluna.titulo);
            }}
            className="absolute right-1 rounded border border-border-subtle bg-surface-card p-0.5 opacity-0 transition-opacity group-hover/celula:opacity-100 group-focus-within/celula:opacity-100"
          >
            {copiada === id ? (
              <Check className="size-3 text-success" />
            ) : (
              <Copy className="size-3 text-text-tertiary" />
            )}
          </button>
        )}
      </td>,
    );
  });

  return <>{celulas}</>;
}

interface AlcaProps {
  rotulo: string;
  largura: number;
  onLargura: (largura: number) => void;
}

/**
 * Alça de redimensionamento operável por mouse, toque, caneta e teclado.
 *
 * O alvo real tem 16 px e a linha visível continua com 1 px: uma alça de 4 px
 * só no mouse deixava colunas estreitas permanentemente truncadas para quem usa
 * teclado ou toque — e é justamente nelas que moram a chave da NF-e, de 44
 * dígitos, e a descrição do produto.
 */
function AlcaDeRedimensionamento({ rotulo, largura, onLargura }: AlcaProps) {
  const arrastando = useRef<{ x: number; largura: number } | null>(null);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Redimensionar a coluna ${rotulo}`}
      aria-valuenow={largura}
      aria-valuemin={60}
      tabIndex={0}
      onPointerDown={(evento) => {
        evento.preventDefault();
        evento.currentTarget.setPointerCapture(evento.pointerId);
        arrastando.current = { x: evento.clientX, largura };
      }}
      onPointerMove={(evento) => {
        const inicio = arrastando.current;
        if (!inicio) return;
        onLargura(inicio.largura + (evento.clientX - inicio.x));
      }}
      onPointerUp={(evento) => {
        arrastando.current = null;
        evento.currentTarget.releasePointerCapture(evento.pointerId);
      }}
      onKeyDown={(evento) => {
        const passo = evento.shiftKey ? 40 : 8;
        if (evento.key === "ArrowRight") {
          evento.preventDefault();
          onLargura(largura + passo);
        } else if (evento.key === "ArrowLeft") {
          evento.preventDefault();
          onLargura(largura - passo);
        }
      }}
      className="absolute right-0 top-0 flex h-full w-4 -mr-2 cursor-col-resize touch-none justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span
        aria-hidden
        className="h-full w-px bg-transparent transition-colors hover:bg-accent"
      />
    </div>
  );
}

/**
 * O selo da coluna que tem apontamento no arquivo.
 *
 * Responde, no cabeçalho, a pergunta que o planilhão de noventa e quatro
 * colunas torna cara: em QUAIS campos a auditoria encostou? Sem ele, descobrir
 * isso é rolar o arquivo inteiro à procura de células coloridas.
 *
 * A contagem é do ARQUIVO, e não do recorte, de propósito: um selo que mudasse
 * de número a cada marcação viraria mais um número para conferir, e o que ele
 * precisa dizer é estável — "este campo tem problema nesta escrituração".
 */
function SeloDaColuna({
  marca,
}: {
  marca: { severidade: Severidade; quantidade: number } | undefined;
}) {
  if (!marca) return null;

  const { Icone } = ESTILO_SEVERIDADE[marca.severidade];
  const { texto } = FUNDO_SEVERIDADE[marca.severidade];
  const rotulo = ROTULO_SEVERIDADE[marca.severidade].toLowerCase();

  return (
    <span
      className={`inline-flex shrink-0 items-center ${texto}`}
      title={`${marca.quantidade.toLocaleString("pt-BR")} ${
        marca.quantidade === 1 ? "apontamento" : "apontamentos"
      } neste campo no arquivo; o mais grave é ${rotulo}.`}
      aria-label={`Campo com ${marca.quantidade} ${
        marca.quantidade === 1 ? "apontamento" : "apontamentos"
      }, o mais grave de severidade ${rotulo}`}
    >
      <Icone size={TAMANHO_ICONE_FIXO} className="shrink-0" aria-hidden />
    </span>
  );
}
