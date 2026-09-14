"use client";

import { useEffect, useState, type RefObject } from "react";
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
  const [rolagem, setRolagem] = useState({ esquerda: false, direita: false });

  useEffect(() => {
    const elemento = area.current;
    if (!elemento) return;

    const atualizar = () =>
      setRolagem({
        esquerda: elemento.scrollLeft > 4,
        direita: elemento.scrollLeft + elemento.clientWidth < elemento.scrollWidth - 4,
      });

    elemento.addEventListener("scroll", atualizar, { passive: true });

    /*
     * Observa a área E o conteúdo dentro dela: a área pode manter o tamanho
     * enquanto a tabela ganha ou perde colunas, e é a largura do conteúdo que
     * decide se ainda há para onde rolar. O próprio observador dispara a
     * primeira medição, então nada de setState síncrono no corpo do efeito.
     */
    const observador = new ResizeObserver(atualizar);
    observador.observe(elemento);
    if (elemento.firstElementChild) observador.observe(elemento.firstElementChild);

    return () => {
      elemento.removeEventListener("scroll", atualizar);
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
        lado="esquerda"
        visivel={rolagem.esquerda}
        substantivo={substantivo}
        deslocamento={recuoEsquerda}
        onClick={() => rolar(-1)}
      />
      <Seta
        lado="direita"
        visivel={rolagem.direita}
        substantivo={substantivo}
        onClick={() => rolar(1)}
      />
    </>
  );
}

interface SetaProps {
  lado: "esquerda" | "direita";
  visivel: boolean;
  substantivo: string;
  deslocamento?: number;
  onClick: () => void;
}

function Seta({ lado, visivel, substantivo, deslocamento = 0, onClick }: SetaProps) {
  const Icone = lado === "esquerda" ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={onClick}
      hidden={!visivel}
      aria-label={`Ver ${substantivo} à ${lado}`}
      className="absolute top-1/2 z-20 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-border-strong bg-surface-card text-text-secondary shadow-(--shadow-card) transition-colors hover:bg-accent-soft hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      style={lado === "esquerda" ? { left: deslocamento + 8 } : { right: 8 }}
    >
      <Icone size={18} aria-hidden />
    </button>
  );
}
