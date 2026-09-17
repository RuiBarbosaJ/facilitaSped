"use client";

import { useEffect, useRef, type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface NavegacaoLateralProps {
  /** A área que rola. Precisa estar dentro de um contêiner `relative`. */
  area: RefObject<HTMLElement | null>;
  /**
   * Largura das colunas fixas à esquerda, em pixels. A seta da esquerda recua
   * essa distância para não cobrir justamente a coluna que serve de referência
   * enquanto se rola (o número da linha, o registro).
   */
  recuoEsquerda?: number;
  /** O que está sendo navegado, para o leitor de tela: "colunas", "meses"… */
  substantivo?: string;
}

/** Sobra de uma página para a outra, para não se perder o fio da leitura. */
const SOBREPOSICAO = 80;
const PASSO_MINIMO = 240;

/** Folga para não acender a seta por um pixel de arredondamento. */
const MARGEM = 4;

/**
 * Acende ou apaga cada seta, escrevendo direto no DOM.
 *
 * A visibilidade da seta é estado do DOM, não do React: ela depende de
 * `scrollLeft` e `scrollWidth`, muda a cada quadro de rolagem e não entra em
 * nenhuma decisão de renderização. Guardá-la em `useState` obrigava a chamar
 * `setState` dentro de um efeito a cada render — que é o encadeamento de
 * renders que o compilador do React recusa, e com razão.
 */
function medir(
  area: HTMLElement | null,
  esquerda: HTMLButtonElement | null,
  direita: HTMLButtonElement | null
): void {
  if (!area) return;
  if (esquerda) esquerda.hidden = area.scrollLeft <= MARGEM;
  if (direita) {
    direita.hidden = area.scrollLeft + area.clientWidth >= area.scrollWidth - MARGEM;
  }
}

/**
 * Setas para percorrer uma tabela larga.
 *
 * Tabela de escrituração não cabe na tela: a do SPED passa de cem colunas e de
 * treze mil pixels. A barra de rolagem horizontal existe, mas fica no rodapé da
 * área — longe de onde o olho está e, num contêiner alto, fora da tela. As
 * setas trazem o controle para junto do conteúdo e avançam uma página inteira
 * de colunas por clique.
 *
 * Cada seta some quando não há mais para onde ir daquele lado. Some com
 * `hidden`, e não desmontando: um botão que aparece e desaparece a cada rolagem
 * é anunciado repetidamente pelo leitor de tela.
 */
export function NavegacaoLateral({
  area,
  recuoEsquerda = 0,
  substantivo = "colunas",
}: NavegacaoLateralProps) {
  const esquerdaRef = useRef<HTMLButtonElement>(null);
  const direitaRef = useRef<HTMLButtonElement>(null);

  /*
   * MEDE A CADA RENDER, e não só quando a área muda de tamanho.
   *
   * O ResizeObserver abaixo não enxerga o caso mais comum desta grade. A área
   * tem tamanho fixo e a tabela dentro dela é `width: 100%`: quando o conjunto
   * de colunas muda — esconder tudo e revelar de novo, ligar um recorte,
   * limpá-lo — quem cresce é o `scrollWidth` da ÁREA, enquanto a caixa dos dois
   * elementos observados continua exatamente do mesmo tamanho. O observador não
   * dispara, a medição não refaz, e a seta fica escondida para sempre: o
   * usuário volta às 111 colunas e perde o único controle de navegação
   * horizontal da tela.
   *
   * Três leituras de DOM por render é barato; o efeito não guarda estado, então
   * não encadeia render nenhum.
   */
  useEffect(() => {
    medir(area.current, esquerdaRef.current, direitaRef.current);
  });

  useEffect(() => {
    const elemento = area.current;
    if (!elemento) return;

    const aoMudar = () => medir(elemento, esquerdaRef.current, direitaRef.current);
    elemento.addEventListener("scroll", aoMudar, { passive: true });

    // O observador cobre o que o efeito acima não pega de graça: a área mudar
    // de tamanho sem que nada re-renderize — a janela redimensionada, o painel
    // lateral aberto, o zoom do navegador.
    const observador = new ResizeObserver(aoMudar);
    observador.observe(elemento);

    return () => {
      elemento.removeEventListener("scroll", aoMudar);
      observador.disconnect();
    };
  }, [area]);

  // Função simples, sem memoização: ela só é usada nos dois cliques, e envolvê-la
  // em useCallback faz o compilador do React desistir de otimizar o componente.
  function rolar(direcao: -1 | 1) {
    const elemento = area.current;
    if (!elemento) return;

    const passo = Math.max(PASSO_MINIMO, elemento.clientWidth - recuoEsquerda - SOBREPOSICAO);
    const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    elemento.scrollBy({ left: direcao * passo, behavior: suave ? "smooth" : "auto" });
  }

  return (
    <>
      <Seta
        ref={esquerdaRef}
        lado="esquerda"
        substantivo={substantivo}
        deslocamento={recuoEsquerda}
        onClick={() => rolar(-1)}
      />
      <Seta ref={direitaRef} lado="direita" substantivo={substantivo} onClick={() => rolar(1)} />
    </>
  );
}

interface SetaProps {
  ref: RefObject<HTMLButtonElement | null>;
  lado: "esquerda" | "direita";
  substantivo: string;
  deslocamento?: number;
  onClick: () => void;
}

function Seta({ ref, lado, substantivo, deslocamento = 0, onClick }: SetaProps) {
  const Icone = lado === "esquerda" ? ChevronLeft : ChevronRight;

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      /*
       * Nasce escondida e quem a acende é `medir`, no primeiro efeito.
       * O atributo NÃO é controlado pelo React de propósito: se ele fosse, cada
       * quadro de rolagem viraria um render da grade inteira.
       */
      hidden
      aria-label={`Ver ${substantivo} à ${lado}`}
      className="absolute top-1/2 z-20 grid size-9 -translate-y-1/2 place-items-center rounded-md border border-border-strong bg-surface-card text-text-secondary shadow-(--shadow-card) transition-colors hover:bg-accent-soft hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      style={lado === "esquerda" ? { left: deslocamento + 8 } : { right: 8 }}
    >
      <Icone size={18} aria-hidden />
    </button>
  );
}
