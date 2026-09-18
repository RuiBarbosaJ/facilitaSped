"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { BotaoTema } from "./BotaoTema";

/*
 * UM PADRÃO DE NOME PARA AS TRÊS TELAS.
 *
 * O rótulo é sempre o ESCOPO — um substantivo: o material que se consulta ou a
 * obrigação que se audita. O verbo fica de fora. "Consulta" ao lado de
 * "PIS/COFINS" e "ICMS/IPI" misturava as duas gramáticas: um item dizia o que
 * você FAZ e os outros dois diziam sobre O QUÊ, e o olho não conseguia ler a
 * barra como um conjunto.
 *
 * O verbo passou para o bloco que aparece ao passar o mouse, que é onde ele
 * cabe por extenso. Esse mesmo rótulo abre o `<h1>` da tela correspondente, e o
 * selo ao lado do título sempre começa pela obrigação — de modo que a barra, o
 * título e o selo repitam a mesma palavra em vez de três sinônimos.
 */
const PAGINAS = [
  {
    href: "/",
    rotulo: "Tabelas oficiais",
    contexto: "EFD-Contribuições",
    descricao:
      "Pesquise NCM, CST, alíquota e natureza de receita nas tabelas da Receita. Não precisa enviar arquivo nenhum.",
  },
  {
    href: "/pis-cofins",
    rotulo: "PIS/COFINS",
    contexto: "EFD-Contribuições",
    descricao:
      "Confere a sua planilha contra a NCM vigente e as tabelas de benefício — a de entrada e a de saída.",
  },
  {
    href: "/icms-ipi",
    rotulo: "ICMS/IPI",
    contexto: "EFD ICMS/IPI",
    descricao:
      "Audita o arquivo da escrituração inteiro, mostra o que está errado e gera o TXT corrigido no mesmo leiaute.",
  },
  {
    href: "/criterios",
    rotulo: "Critérios",
    contexto: "Documentação",
    descricao:
      "O que cada tela confere, contra qual norma, e o que a ferramenta corrige sozinha. Feito para imprimir e anexar ao papel de trabalho.",
    /*
       Separada por um traço: as três primeiras são ONDE se trabalha, esta é
       SOBRE elas. Sem a divisão, a barra passa a oferecer quatro destinos
       equivalentes, e o trio que organiza a ferramenta se perde no meio.
    */
    meta: true,
  },
] as const;

interface CabecalhoProps {
  /** Linha de controles específica da página (busca, filtros), abaixo da marca. */
  children?: ReactNode;
}

/** Marca, navegação entre as páginas e o botão de tema. */
export function Cabecalho({ children }: CabecalhoProps) {
  const atual = usePathname();
  const barraRef = useRef<HTMLElement>(null);
  const prefixo = useId();

  /*
   * O cabeçalho PUBLICA a própria altura em `--altura-cabecalho`.
   *
   * Os cabeçalhos de tabela também são fixos, e precisam parar logo abaixo
   * deste — não em `top: 0`, onde os dois se sobrepõem e a tabela cobre a busca.
   * A altura não é constante: no celular a barra quebra em duas linhas, e um
   * valor chutado deixaria uma faixa morta no desktop ou a sobreposição de
   * volta no celular.
   *
   * Escreve no DOM em vez de guardar em estado: é um valor de layout que só a
   * folha de estilo consome, e `setState` aqui re-renderizaria o cabeçalho
   * inteiro a cada redimensionamento da janela.
   */
  useEffect(() => {
    const barra = barraRef.current;
    if (!barra) return;

    const publicar = () =>
      document.documentElement.style.setProperty(
        "--altura-cabecalho",
        `${Math.round(barra.getBoundingClientRect().height)}px`
      );

    publicar();
    const observador = new ResizeObserver(publicar);
    observador.observe(barra);
    return () => observador.disconnect();
  }, []);

  return (
    <header
      ref={barraRef}
      /*
       * z-40: acima dos cabeçalhos de tabela (z-10) e abaixo dos menus
       * flutuantes (z-50), que precisam poder cobrir o cabeçalho.
       */
      className="sticky top-0 z-40 border-b border-border-subtle bg-surface-card shadow-(--shadow-header)"
    >
      {/* Barra superior fina com as cores do Brasil (Gov.br / RFB style) */}
      <div className="h-1 w-full bg-linear-to-r from-[#00A859] via-[#FED000] to-[#1351B4]"></div>
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-y-4 gap-x-2 py-4 relative">
          {/* Botão de Tema (Esquerda no desktop, Segunda linha à esquerda no mobile) */}
          <div className="flex-1 basis-0 flex items-center justify-start order-2 sm:order-1">
            <BotaoTema />
          </div>

          {/* Logo e Título (Centro no desktop, Primeira linha centralizada no mobile) */}
          <div className="w-full sm:w-auto flex items-center justify-center gap-3 min-w-0 order-1 sm:order-2 shrink-0">
            <Link
              href="/"
              className="shrink-0 flex items-center justify-center size-12 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 transition-transform hover:scale-105"
              aria-label="Facilita Sped — início"
            >
              <Image 
                src="/logo-sped-v2.png" 
                alt="Logo SPED" 
                width={48} 
                height={48}
                className="w-full h-full object-contain"
              />
            </Link>
            <div className="min-w-0">
              <div className="flex items-start justify-center sm:justify-start">
                <p 
                  className="text-xl font-bold tracking-tight truncate leading-none py-1" 
                  style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                >
                  <span className="bg-linear-to-r from-accent to-accent-hover bg-clip-text text-transparent mr-1">Facilita</span>
                  <span className="text-text-primary">
                    Sped
                    <sup className="text-[0.6rem] font-black text-accent uppercase ml-[1px]" title="Rui">r</sup>
                  </span>
                </p>
              </div>
              <p className="text-xs text-text-tertiary truncate">
                EFD-Contribuições e ICMS/IPI
              </p>
            </div>
          </div>

          {/* Navegação (Direita no desktop, Segunda linha à direita no mobile) */}
          {/*
            No celular a navegação toma a linha inteira. Disputando a faixa com
            o botão de tema ela sobrava ~250px para quatro destinos, e cada um
            caía numa linha própria: o cabeçalho passava de 240px de altura e
            comia um terço da tela antes do primeiro dado.
          */}
          <div className="order-3 flex w-full basis-full items-center justify-center gap-3 sm:w-auto sm:flex-1 sm:basis-0 sm:justify-end sm:gap-5">
            <nav aria-label="Páginas">
              <ul className="flex flex-wrap items-center justify-center gap-0.5 sm:flex-nowrap sm:justify-end sm:gap-1">
                {PAGINAS.map((pagina, i) => {
                  const { href, rotulo, contexto, descricao } = pagina;
                  const ativa = atual === href;
                  const id = `${prefixo}-${i}`;
                  const meta = "meta" in pagina && pagina.meta;
                  return (
                    <li
                      key={href}
                      className={`group relative ${meta ? "ml-1 border-l border-border-subtle pl-2" : ""}`}
                    >
                      <Link
                        href={href}
                        aria-current={ativa ? "page" : undefined}
                        aria-describedby={id}
                        className={`peer block rounded-lg px-2 py-1.5 text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:px-3 sm:text-sm ${
                          ativa
                            ? "bg-accent-soft text-accent"
                            : "text-text-secondary hover:text-text-primary hover:bg-surface-page"
                        }`}
                      >
                        {rotulo}
                      </Link>

                      {/*
                        O que a página faz, em uma frase.
                        Os nomes são a obrigação que a tela atende — "PIS/COFINS",
                        "ICMS/IPI" — e dizem contra o QUÊ se audita, não o que a
                        tela faz com o arquivo. Quem chega pela primeira vez tem de
                        abrir as três para descobrir.

                        Sem estado em React: `group-hover` cobre o mouse e
                        `peer-focus-visible` cobre o teclado. `focus-visible`, e não
                        `focus`, é o que evita o bloco piscar no celular, onde tocar
                        no link dá foco e navega no mesmo gesto.
                      */}
                      <span
                        id={id}
                        role="tooltip"
                        /*
                          Ancorado à DIREITA do item, não centrado. A navegação
                          mora na ponta direita da barra: centrado, o bloco de
                          "ICMS/IPI" saía pela borda da janela, e no celular —
                          onde a barra desce e os itens se apertam — os três
                          saíam.
                        */
                        className="pointer-events-none absolute top-full right-0 z-50 mt-2 w-64 translate-y-1 rounded-md border border-border-subtle bg-surface-card p-3 text-left opacity-0 shadow-(--shadow-card) transition duration-150 group-hover:translate-y-0 group-hover:opacity-100 peer-focus-visible:translate-y-0 peer-focus-visible:opacity-100"
                      >
                        {/* A seta que amarra o bloco ao item; herda borda e fundo. */}
                        <span
                          aria-hidden
                          className="absolute -top-1 right-6 size-2 rotate-45 border-l border-t border-border-subtle bg-surface-card"
                        />
                        <span className="block font-mono text-[10px] uppercase tracking-wider text-text-tertiary">
                          {contexto}
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-text-secondary">
                          {descricao}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </div>

        {children && <div className="pb-4">{children}</div>}
      </div>
    </header>
  );
}
