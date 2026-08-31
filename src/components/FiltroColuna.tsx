"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Filter, X } from "lucide-react";

import { SEM_VALOR } from "@/lib/filtrosColuna";

interface FiltroColunaProps {
  rotulo: string;
  /** Opções já cruzadas com os filtros das outras colunas. */
  opcoes: string[];
  /** Vazio ou ausente = coluna sem filtro, todas as linhas passam. */
  selecionados?: string[];
  onChange: (selecionados: string[] | null) => void;
  alinharDireita?: boolean;
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
 * Marcar um valor SELECIONA aquele valor — não desmarca um entre todos. A
 * versão anterior abria com tudo marcado, então clicar num valor o removia do
 * conjunto e a tabela mal mudava; quem queria ver só um CST tinha de desmarcar
 * dezenas de caixas ou descobrir que "(Selecionar Tudo)" servia para esvaziar.
 * Aqui nenhuma marcação significa "todos", a primeira marcação já restringe
 * àquele valor, e desmarcar a última volta para "todos" — nunca para uma
 * tabela vazia.
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
}: FiltroColunaProps) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [posicao, setPosicao] = useState<{ top: number; left: number } | null>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selecao = useMemo(() => selecionados ?? [], [selecionados]);
  const semFiltro = selecao.length === 0;
  const marcados = useMemo(() => new Set(selecao), [selecao]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return opcoes;
    return opcoes.filter((valor) => rotularValor(valor).toLowerCase().includes(termo));
  }, [opcoes, busca]);

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

  function alternar(valor: string) {
    const novo = marcados.has(valor)
      ? selecao.filter((v) => v !== valor)
      : [...selecao, valor];
    // Desmarcar a última volta a mostrar tudo, e não uma tabela em branco.
    onChange(novo.length === 0 ? null : novo);
  }

  function marcarVisiveis() {
    const novo = new Set(selecao);
    for (const valor of visiveis) novo.add(valor);
    onChange(novo.size === 0 ? null : Array.from(novo));
  }

  const titulo = semFiltro
    ? `Filtrar por ${rotulo}`
    : `${rotulo}: ${selecao.length} de ${opcoes.length} selecionados`;

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
          <span className="text-[10px] font-bold tabular-nums leading-none">{selecao.length}</span>
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

          <input
            type="text"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder={`Buscar em ${opcoes.length} valores...`}
            aria-label={`Buscar valores da coluna ${rotulo}`}
            className="mb-2 w-full rounded border border-border-strong bg-surface-page px-2 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
          />

          <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto text-xs">
            <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-surface-page">
              <input
                type="checkbox"
                checked={semFiltro}
                onChange={() => onChange(null)}
                className="rounded border-border-strong text-accent focus:ring-accent"
              />
              <span className="font-semibold">(Todos)</span>
            </label>

            {visiveis.length === 0 ? (
              <span className="p-1 text-text-tertiary">Nenhum valor encontrado.</span>
            ) : (
              visiveis.map((valor) => (
                <label
                  key={valor}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-surface-page"
                >
                  <input
                    type="checkbox"
                    checked={marcados.has(valor)}
                    onChange={() => alternar(valor)}
                    className="shrink-0 rounded border-border-strong text-accent focus:ring-accent"
                  />
                  <span
                    className={`truncate ${valor === SEM_VALOR ? "italic text-text-tertiary" : ""}`}
                    title={rotularValor(valor)}
                  >
                    {rotularValor(valor)}
                  </span>
                </label>
              ))
            )}
          </div>

          <p className="mt-2 border-t border-border-subtle pt-2 text-[11px] text-text-tertiary">
            {semFiltro ? (
              "Sem marcação, a coluna mostra todos os valores."
            ) : (
              <>
                {selecao.length} de {opcoes.length} marcados.
              </>
            )}
            {busca.trim() && visiveis.length > 0 && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={marcarVisiveis}
                  className="font-medium text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Marcar os {visiveis.length} visíveis
                </button>
              </>
            )}
          </p>
        </div>
      )}
    </>
  );
}
