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
      {/* A faixa com as cores do Brasil: a assinatura institucional da marca. */}
      <div className="h-1 w-full bg-linear-to-r from-[#00A859] via-[#FED000] to-[#1351B4]"></div>
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        {/*
          MARCA À ESQUERDA, NAVEGAÇÃO À DIREITA, TEMA NO CANTO.

          O seletor de tema ocupava o canto superior esquerdo — o lugar onde o
          olho começa a ler a tela — e a marca ficava centrada entre ele e a
          navegação. Era o controle menos usado da ferramenta no ponto mais
          nobre dela. Agora a leitura vai da marca às páginas, e o tema fica
          onde as preferências costumam morar.

          No celular são duas linhas: marca e tema em cima, as quatro páginas
          embaixo. Antes eram três, e o cabeçalho comia um quarto da tela antes
          do primeiro dado.
        */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3 sm:flex-nowrap">
          <Link
            href="/"
            aria-label="Facilita Sped — início"
            className="group flex min-w-0 shrink-0 items-center gap-2.5 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            <Image
              src="/logo-sped-v2.png"
              alt=""
              width={36}
              height={36}
              className="size-9 shrink-0 object-contain"
            />
            <span className="flex min-w-0 flex-col">
              {/*
                Cor chapada no "Facilita". O degradê de dois azuis que ele
                usava era o único texto em degradê do sistema — e é o
                acabamento que mais denuncia tela feita no automático.
              */}
              <span
                className="text-lg leading-tight font-bold tracking-tight"
                style={{ fontFamily: "var(--font-outfit), sans-serif" }}
              >
                <span className="text-accent">Facilita</span>{" "}
                <span className="text-text-primary">
                  Sped
                  <sup className="ml-px text-[0.6rem] font-black text-accent uppercase" title="Rui">
                    r
                  </sup>
                </span>
              </span>
              <span className="truncate text-xs text-text-tertiary">EFD-Contribuições e ICMS/IPI</span>
            </span>
          </Link>

          <div className="order-last flex w-full items-center sm:order-0 sm:ml-auto sm:w-auto">
            {/*
              No celular a faixa pode rolar de lado, por segurança: quatro
              destinos cabem em 360px, mas uma fonte maior no aparelho não
              pode empurrar "Critérios" para fora sem caminho de volta.
            */}
            <nav aria-label="Páginas" className="-mx-1 min-w-0 flex-1 max-sm:overflow-x-auto sm:mx-0">
              <ul className="flex items-center gap-0.5 sm:gap-1">
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
                        className={`peer block rounded-md px-2 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:px-3 sm:text-sm ${
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
                          "ICMS/IPI" saía pela borda da janela. No celular a
                          barra começa na margem ESQUERDA, e os dois primeiros
                          itens ancoram por ela — pela direita, o bloco de
                          "Tabelas oficiais" nasceria fora da tela.
                        */
                        className={`pointer-events-none absolute top-full z-50 mt-2 w-64 translate-y-1 rounded-md border border-border-subtle bg-surface-card p-3 text-left opacity-0 shadow-(--shadow-card) transition duration-150 group-hover:translate-y-0 group-hover:opacity-100 peer-focus-visible:translate-y-0 peer-focus-visible:opacity-100 ${
                          i < 2 ? "left-0 sm:left-auto sm:right-0" : "right-0"
                        }`}
                      >
                        {/* A seta que amarra o bloco ao item; herda borda e fundo. */}
                        <span
                          aria-hidden
                          className={`absolute -top-1 size-2 rotate-45 border-l border-t border-border-subtle bg-surface-card ${
                            i < 2 ? "left-6 sm:left-auto sm:right-6" : "right-6"
                          }`}
                        />
                        <span className="block text-xs text-text-tertiary">{contexto}</span>
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

          <div className="ml-auto shrink-0 sm:ml-0">
            <BotaoTema />
          </div>
        </div>

        {children && <div className="pb-3">{children}</div>}
      </div>
    </header>
  );
}
