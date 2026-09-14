"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Check, Copy } from "lucide-react";

import { BarraFiltros } from "@/componentes/BarraFiltros";
import { NavegacaoLateral } from "@/componentes/NavegacaoLateral";
import { FiltroColuna } from "@/componentes/FiltroColuna";
import { COLUNA_REGISTRO, valorDaColuna } from "../leiaute/acesso";
import { larguraPadraoDe, type ColunaGrade } from "../leiaute/colunas";
import { descreverValor, temDominio } from "../leiaute/dominios";
import { LIMITES } from "../limites";
import { SeletorColunas } from "./SeletorColunas";
import { useGradeRegistro } from "./useGradeRegistro";

export interface GradeRegistroProps {
  worker: Worker | null;
  contagens: Record<string, number>;
}

const ALTURA_DA_LINHA = 34;
const LARGURA_DA_NUMERACAO = 72;

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

export function GradeRegistro({ worker, contagens }: GradeRegistroProps) {
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
  } = useGradeRegistro({ worker, contagens });

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
    LARGURA_DA_NUMERACAO +
    (colunas[0] ? larguraDa(`col_${colunas[0].nome}`, larguraPadraoDe(colunas[0])) : 0);

  const linhasVirtuais = virtualizador.getVirtualItems();
  const primeira = linhasVirtuais[0]?.index ?? 0;
  const ultima = linhasVirtuais[linhasVirtuais.length - 1]?.index ?? 0;

  useEffect(() => {
    if (linhasVirtuais.length > 0) garantirIntervalo(primeira, ultima);
  }, [primeira, ultima, linhasVirtuais.length, garantirIntervalo]);

  const copiar = useCallback(async (valor: string, id: string, rotulo: string) => {
    if (!valor) return;
    try {
      await navigator.clipboard.writeText(valor);
      setCopiada(id);
      setAnuncio(`${rotulo} copiado.`);
      window.setTimeout(() => setCopiada((atual) => (atual === id ? null : atual)), 1500);
    } catch {
      setAnuncio(`Não foi possível copiar ${rotulo}: o navegador bloqueou a área de transferência.`);
    }
  }, []);

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
        case "ArrowDown": destino.linha = Math.min(ultimaLinha, foco.linha + 1); break;
        case "ArrowUp": destino.linha = Math.max(0, foco.linha - 1); break;
        case "ArrowRight": destino.coluna = Math.min(ultimaColuna, foco.coluna + 1); break;
        case "ArrowLeft": destino.coluna = Math.max(0, foco.coluna - 1); break;
        case "PageDown": destino.linha = Math.min(ultimaLinha, foco.linha + 20); break;
        case "PageUp": destino.linha = Math.max(0, foco.linha - 20); break;
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
      if (destino.linha !== foco.linha) virtualizador.scrollToIndex(destino.linha);
    },
    [colunas.length, foco, totalDeLinhas, virtualizador]
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
      atual.coluna > colunas.length ? { ...atual, coluna: colunas.length } : atual
    );
  }, [colunas.length]);

  // Devolve o foco do DOM à célula ativa — inclusive depois de a rolagem
  // finalmente montar a linha para onde o teclado apontou.
  useEffect(() => {
    const area = areaRef.current;
    if (!area || !area.contains(document.activeElement)) return;
    area
      .querySelector<HTMLElement>(`[data-celula="${foco.linha}-${foco.coluna}"]`)
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
            style={{ width: larguraDa(id, padrao), left: fixa ? LARGURA_DA_NUMERACAO : undefined }}
          >
            <div className="flex items-center gap-1.5 pr-1">
              <span className="truncate" title={`${coluna.titulo} (${coluna.nome})`}>
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
    [colunas, filtros, filtrar, larguraDa, opcoes, redimensionar]
  );

  /** Colunas com filtro ativo: o seletor as trava visíveis. */
  const colunasFiltradas = useMemo(
    () => new Set(Object.keys(filtros).filter((nome) => filtros[nome]?.length)),
    [filtros]
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BarraFiltros filtros={filtrosAtivos} onLimparTudo={limparFiltros} />
        <SeletorColunas
          colunas={todasAsColunas}
          visiveis={colunas}
          estado={estadoColunas}
          escolha={escolhaDeColunas}
          onAlternar={alternarColuna}
          onRestaurar={restaurarColunas}
          onMostrarTodas={mostrarTodasAsColunas}
          fixa={COLUNA_REGISTRO}
          filtradas={colunasFiltradas}
          cheiasOcultas={cheiasOcultas}
          revelarTudo={revelarTudo}
        />
      </div>

      {truncadas.length > 0 && (
        <p className="text-xs text-text-tertiary">
          As colunas {truncadas.join(", ")} têm mais de{" "}
          {LIMITES.OPCOES_POR_COLUNA.toLocaleString("pt-BR")} valores distintos; o menu lista apenas
          os primeiros. Use a busca dentro do menu para chegar a um valor específico.
        </p>
      )}

      <div
        className="relative flex flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-card shadow-(--shadow-card)"
        style={{ height: "clamp(420px, calc(100vh - 300px), 900px)" }}
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
              Uma coluna por campo do layout. Cada linha preenche apenas as colunas do seu registro.
              Use as setas para navegar entre as células e Enter para copiar a célula em foco.
            </caption>

            <thead className="sticky top-0 bg-surface-head" style={{ display: "grid", zIndex: 30 }}>
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
                  className="sticky left-0 z-50 shrink-0 border-r border-border-subtle bg-surface-head px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary"
                  style={{ width: LARGURA_DA_NUMERACAO }}
                >
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
                  linhaVirtual.index % 2 !== 0 ? "var(--surface-page)" : "var(--surface-card)";

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
                        foco={foco}
                        copiada={copiada}
                        larguraDa={larguraDa}
                        onFoco={setFoco}
                        onCopiar={copiar}
                      />
                    ) : (
                      <td
                        className="flex items-center px-3 py-2 text-xs text-text-tertiary"
                        style={{ width: LARGURA_DA_NUMERACAO }}
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
                    Object.keys(escolhaDeColunas).length > 0 ? ", o resto por sua escolha" : ""
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
  foco,
  copiada,
  larguraDa,
  onFoco,
  onCopiar,
}: CelulasProps) {
  const celulas = [
    <td
      key="numero"
      role="gridcell"
      aria-colindex={1}
      data-celula={`${indiceDaLinha}-0`}
      tabIndex={foco.linha === indiceDaLinha && foco.coluna === 0 ? 0 : -1}
      onFocus={() => onFoco({ linha: indiceDaLinha, coluna: 0 })}
      className="sticky left-0 z-20 flex shrink-0 items-center border-r border-border-subtle px-3 py-2 font-mono text-[11px] text-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
      style={{ width: LARGURA_DA_NUMERACAO, backgroundColor: fundo }}
    >
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

    celulas.push(
      <td
        key={coluna.nome}
        role="gridcell"
        aria-colindex={indice + 2}
        data-celula={id}
        tabIndex={ativa ? 0 : -1}
        aria-label={
          valor
            ? `${coluna.titulo}: ${valor}${significado ? `, ${significado}` : ""}`
            : `${coluna.titulo}: vazio`
        }
        onFocus={() => onFoco({ linha: indiceDaLinha, coluna: indice + 1 })}
        onClick={() => onFoco({ linha: indiceDaLinha, coluna: indice + 1 })}
        onKeyDown={(evento) => {
          if (evento.key !== "Enter" && evento.key !== " ") return;
          evento.preventDefault();
          onCopiar(valor, id, coluna.titulo);
        }}
        className={`group/celula relative flex shrink-0 items-center border-r border-border-subtle px-3 py-2 transition-colors hover:bg-accent-soft/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
          numerica ? "justify-end font-mono" : "justify-start"
        } ${fixa ? "sticky z-20 font-mono font-medium shadow-[2px_0_4px_-1px_rgb(0_0_0/0.08)]" : ""}`}
        style={{
          width: larguraDa(`col_${coluna.nome}`, larguraPadraoDe(coluna)),
          left: fixa ? LARGURA_DA_NUMERACAO : undefined,
          backgroundColor: fixa ? fundo : undefined,
        }}
      >
        {valor ? (
          <span className="truncate text-text-primary" title={significado ? `${valor} — ${significado}` : valor}>
            {valor}
          </span>
        ) : (
          <span
            aria-hidden={naoSeAplica}
            aria-label={naoSeAplica ? undefined : "campo em branco"}
            title={naoSeAplica ? undefined : "Campo em branco: o registro possui o campo e ele não foi preenchido"}
            className={naoSeAplica ? "text-text-tertiary/60" : "font-medium text-warning/80"}
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
      </td>
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
      <span aria-hidden className="h-full w-px bg-transparent transition-colors hover:bg-accent" />
    </div>
  );
}
