"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Filter, X } from "lucide-react";

import { alternarValor, estaMarcado, somenteValor, SEM_VALOR } from "@/comum/filtrosColuna";

interface FiltroColunaProps {
  rotulo: string;
  /** Opções já cruzadas com os filtros das outras colunas. */
  opcoes: string[];
  /** Vazio ou ausente = coluna sem filtro, todas as linhas passam. */
  selecionados?: string[];
  onChange: (selecionados: string[] | null) => void;
  alinharDireita?: boolean;
  /** Linha de ajuda no topo do menu: o que esta coluna é. */
  descricao?: string;
  /**
   * O que um valor significa, quando ele é um código de domínio fechado.
   *
   * Sem isto, filtrar uma escrituração é escolher entre "0" e "1" sem saber o
   * que cada um quer dizer — o menu mostra o código e a busca só encontra o
   * código. Com isto, o menu mostra "0 — Entrada ou aquisição" e procurar por
   * "entrada" acha.
   */
  descreverValor?: (valor: string) => string | undefined;
}

const LARGURA = 288;
const MARGEM = 8;

/** Célula vazia não tem texto para mostrar; o menu a chama pelo nome. */
function rotularValor(valor: string): string {
  return valor === SEM_VALOR ? "(Vazio)" : valor;
}

/**
 * Menu de filtro de uma coluna.
 *
 * O menu abre com TODAS as caixas marcadas, porque é isso que está
 * acontecendo: sem filtro, todo valor passa. Clicar numa caixa EXCLUI aquele
 * valor, como em qualquer planilha.
 *
 * As duas versões anteriores erraram lados opostos do mesmo problema. A
 * primeira abria com tudo marcado mas sem saída rápida para isolar um valor:
 * quem quisesse ver só um CST desmarcava dezenas de caixas. A segunda inverteu
 * — abria vazia, e o primeiro clique incluía —, o que resolveu isolar e
 * quebrou excluir: tirar um CFOP da vista, que é o gesto mais comum de quem
 * confere escrituração, passou a exigir marcar todos os outros um a um.
 *
 * Aqui os dois casos custam um clique: a caixa exclui, e o "só este" isola.
 * Desmarcar a última caixa ou remarcar a que faltava volta para "todos" — o
 * menu nunca leva a uma tabela em branco por acidente.
 *
 * O menu é posicionado em coordenadas de viewport porque o container da tabela
 * rola na horizontal e recorta o que passa das bordas.
 */
export function FiltroColuna({
  rotulo,
  opcoes,
  selecionados,
  onChange,
  alinharDireita = false,
  descricao,
  descreverValor,
}: FiltroColunaProps) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [posicao, setPosicao] = useState<{ top: number; left: number } | null>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selecao = useMemo(() => selecionados ?? [], [selecionados]);
  const semFiltro = selecao.length === 0;
  /** Quantos valores estão escondidos — é o que o selo da coluna comunica. */
  const excluidos = semFiltro ? 0 : opcoes.length - selecao.length;

  /** O texto completo da opção: o código e, quando existe, o seu significado. */
  const textoDaOpcao = useCallback(
    (valor: string) => {
      const rotulo = rotularValor(valor);
      const significado = descreverValor?.(valor);
      return significado ? `${rotulo} — ${significado}` : rotulo;
    },
    [descreverValor]
  );

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return opcoes;
    // A busca casa também com o significado: procurar "entrada" acha o "0".
    return opcoes.filter((valor) => textoDaOpcao(valor).toLowerCase().includes(termo));
  }, [opcoes, busca, textoDaOpcao]);

  // A busca é do momento em que o menu estava aberto; reabrir começa limpo.
  function fechar() {
    setAberto(false);
    setBusca("");
  }

  useLayoutEffect(() => {
    if (!aberto) return;

    function reposicionar() {
      const alvo = botaoRef.current?.getBoundingClientRect();
      if (!alvo) return;
      const bruto = alinharDireita ? alvo.right - LARGURA : alvo.left;
      const limite = window.innerWidth - LARGURA - MARGEM;
      setPosicao({ top: alvo.bottom + 4, left: Math.max(MARGEM, Math.min(bruto, limite)) });
    }

    reposicionar();
    // `capture` para acompanhar também a rolagem horizontal da própria tabela.
    window.addEventListener("scroll", reposicionar, true);
    window.addEventListener("resize", reposicionar);
    return () => {
      window.removeEventListener("scroll", reposicionar, true);
      window.removeEventListener("resize", reposicionar);
    };
  }, [aberto, alinharDireita]);

  useEffect(() => {
    if (!aberto) return;

    function aoClicarFora(evento: MouseEvent) {
      const alvo = evento.target as Node;
      if (menuRef.current?.contains(alvo) || botaoRef.current?.contains(alvo)) return;
      fechar();
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key !== "Escape") return;
      fechar();
      botaoRef.current?.focus();
    }

    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  /** Clique na caixa: tira o valor da vista (ou devolve, se já estava fora). */
  function alternar(valor: string) {
    onChange(alternarValor(opcoes, selecao, valor));
  }

  /** "Só este": o outro gesto do menu, isolar um valor. */
  function somente(valor: string) {
    onChange(somenteValor(opcoes, valor));
  }

  /** Com busca ativa: restringe ao que a busca encontrou. */
  function somenteVisiveis() {
    onChange(visiveis.length === opcoes.length ? null : [...visiveis]);
  }

  const titulo = semFiltro
    ? `Filtrar por ${rotulo}`
    : `${rotulo}: mostrando ${selecao.length} de ${opcoes.length} valores (${excluidos} ${
        excluidos === 1 ? "escondido" : "escondidos"
      })`;

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        onClick={() => {
          if (aberto) fechar();
          else setAberto(true);
        }}
        aria-expanded={aberto}
        aria-haspopup="true"
        aria-label={titulo}
        title={titulo}
        className={`inline-flex shrink-0 items-center gap-0.5 rounded p-1 transition-colors hover:bg-surface-page focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          semFiltro ? "text-text-tertiary" : "bg-accent-soft text-accent"
        }`}
      >
        <Filter size={14} aria-hidden />
        {!semFiltro && (
          /*
            O selo conta o gesto que o usuário fez, não o resto.
            Esconder um CFOP entre cinquenta mostrava "49" — um número grande
            para uma ação pequena, que parecia filtro demais. Quando o que ele
            fez foi excluir, o selo diz "−1"; quando foi isolar, diz quantos
            sobraram.
          */
          <span className="text-[10px] font-bold tabular-nums leading-none">
            {excluidos < selecao.length ? `−${excluidos}` : selecao.length}
          </span>
        )}
      </button>

      {aberto && posicao && (
        <div
          ref={menuRef}
          role="group"
          aria-label={`Filtro da coluna ${rotulo}`}
          style={{ top: posicao.top, left: posicao.left, width: LARGURA }}
          className="fixed z-50 rounded-xl border border-border-strong bg-surface-card p-3 text-left font-sans font-normal normal-case tracking-normal shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="truncate text-xs font-semibold text-text-primary">{rotulo}</span>
            {!semFiltro && (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-accent hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X size={12} aria-hidden />
                Limpar
              </button>
            )}
          </div>

          {descricao && (
            <p className="mb-2 text-[11px] leading-snug text-text-tertiary">{descricao}</p>
          )}

          <input
            type="text"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder={`Buscar em ${opcoes.length} valores...`}
            aria-label={`Buscar valores da coluna ${rotulo}`}
            className="mb-2 w-full rounded border border-border-strong bg-surface-page px-2 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
          />

          <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto text-xs">
            <label
              className={`flex items-center gap-2 rounded px-1 py-1 ${
                semFiltro ? "opacity-60" : "cursor-pointer hover:bg-surface-page"
              }`}
              title={semFiltro ? "Todos os valores já estão sendo mostrados" : "Voltar a mostrar todos"}
            >
              <input
                type="checkbox"
                checked={semFiltro}
                // Parcialmente marcado quando há valor escondido: é o estado
                // real da coluna, e o mesmo sinal que uma planilha usa.
                ref={(el) => {
                  if (el) el.indeterminate = !semFiltro;
                }}
                disabled={semFiltro}
                onChange={() => onChange(null)}
                className="rounded border-border-strong text-accent focus:ring-accent"
              />
              <span className="font-semibold">(Todos)</span>
            </label>

            {visiveis.length === 0 ? (
              <span className="p-1 text-text-tertiary">Nenhum valor encontrado.</span>
            ) : (
              visiveis.map((valor) => (
                <div
                  key={valor}
                  className="group flex items-center gap-2 rounded px-1 py-1 hover:bg-surface-page"
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={estaMarcado(selecao, valor)}
                      onChange={() => alternar(valor)}
                      aria-label={`Mostrar ${textoDaOpcao(valor)}`}
                      className="shrink-0 rounded border-border-strong text-accent focus:ring-accent"
                    />
                    <span
                      className={`min-w-0 flex-1 truncate ${valor === SEM_VALOR ? "italic text-text-tertiary" : ""}`}
                      title={textoDaOpcao(valor)}
                    >
                      {rotularValor(valor)}
                      {descreverValor?.(valor) && (
                        <span className="text-text-tertiary"> — {descreverValor(valor)}</span>
                      )}
                    </span>
                  </label>

                  {/*
                    Isolar um valor é o outro gesto do menu, e sem ele a caixa
                    que exclui obrigaria a desmarcar todo o resto um a um.
                    Aparece no hover e no foco do teclado — nunca some para quem
                    navega sem mouse.
                  */}
                  <button
                    type="button"
                    onClick={() => somente(valor)}
                    title={`Mostrar apenas ${textoDaOpcao(valor)}`}
                    className="shrink-0 rounded px-1 py-0.5 text-[10px] font-medium text-accent opacity-0 transition-opacity hover:bg-accent-soft focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent group-hover:opacity-100"
                  >
                    só este
                  </button>
                </div>
              ))
            )}
          </div>

          <p className="mt-2 border-t border-border-subtle pt-2 text-[11px] text-text-tertiary">
            {semFiltro ? (
              "Todos os valores aparecem. Desmarque um para escondê-lo."
            ) : (
              <>
                Mostrando {selecao.length} de {opcoes.length} —{" "}
                {excluidos === 1 ? "1 valor escondido" : `${excluidos} valores escondidos`}.
              </>
            )}
            {busca.trim() && visiveis.length > 0 && visiveis.length < opcoes.length && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={somenteVisiveis}
                  className="font-medium text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Mostrar só os {visiveis.length} encontrados
                </button>
              </>
            )}
          </p>
        </div>
      )}
    </>
  );
}
