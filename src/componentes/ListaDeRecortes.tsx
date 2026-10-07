"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";

export interface Recorte {
  valor: string;
  nome: string;
  /** Quantas linhas o recorte tem agora. */
  total: number;
  /** Código curto à esquerda do nome, em mono: "06". */
  codigo?: string;
  /** O nome por extenso, para a dica. */
  dica?: string;
  /**
   * A cor da contagem, quando ela pede atenção: perigo (vermelho), atenção
   * (âmbar), destaque (azul). Só vale com contagem acima de zero — "0 NCMs
   * inválidos" em vermelho seria alarme sobre o que está certo.
   */
  tom?: "perigo" | "atencao" | "destaque";
  /** Abre um grupo: um fio acima e, no desktop, o nome do grupo. */
  grupo?: string;
  /** Só o fio acima, sem nome. */
  separado?: boolean;
}

interface ListaDeRecortesProps {
  /** O nome do grupo de opções, para o leitor de tela e o título da coluna. */
  rotulo: string;
  itens: Recorte[];
  valor: string;
  onChange: (valor: string) => void;
  /** O que a contagem conta, para o leitor de tela: ["regra", "regras"]. */
  unidade?: readonly [string, string];
  /**
   * `coluna`: faixa no celular, coluna fixa ao lado da tabela no desktop — para
   * tabela estreita, como a da consulta. `faixa`: faixa em qualquer largura —
   * para tabela larga, como a da auditoria, que precisa da largura inteira da
   * tela para não esconder a última coluna atrás da rolagem lateral.
   */
  disposicao?: "coluna" | "faixa";
}

const COR_DO_TOM: Record<NonNullable<Recorte["tom"]>, string> = {
  perigo: "text-danger",
  atencao: "text-warning",
  destaque: "text-accent",
};

/**
 * Os recortes de uma tabela, com quantas linhas cada um tem.
 *
 * É o mesmo controle nas três telas — o CST na consulta, a situação da linha no
 * PIS/COFINS, a severidade no ICMS/IPI — porque é a mesma pergunta: "de tudo
 * isto, o que eu quero ver agora, e quanto tem de cada?". Antes cada tela
 * respondia de um jeito: uma lista suspensa que escondia as opções, sete
 * cartões com número grande, uma fileira de pastilhas.
 *
 * No desktop é uma coluna fixa ao lado da tabela; abaixo disso, uma faixa que
 * rola de lado acima dela. Semântica de grupo de rádio: um ponto de parada no
 * Tab, setas para andar entre as opções.
 */
export function ListaDeRecortes({
  rotulo,
  itens,
  valor,
  onChange,
  unidade = ["linha", "linhas"],
  disposicao = "coluna",
}: ListaDeRecortesProps) {
  /*
   * As classes de coluna só valem no desktop e só na disposição em coluna.
   * Na faixa, a lista é sempre a versão de celular — o mesmo desenho, deitado.
   */
  const coluna = disposicao === "coluna";
  const faixa = useRef<HTMLDivElement>(null);
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);
  const indiceAtivo = itens.findIndex((item) => item.valor === valor);
  const comCodigo = itens.some((item) => item.codigo);

  /*
   * Na faixa que rola de lado, o recorte escolhido fica no meio dela.
   *
   * A faixa abre no começo, e o padrão da consulta — alíquota zero, o 06 — é o
   * quarto item: no celular ele nascia fora da tela, e a pessoa via uma lista
   * sem nenhum marcado. Na coluna do desktop tudo já está à vista e nada se
   * mexe. Rola só a faixa, nunca a página.
   */
  useEffect(() => {
    const elemento = faixa.current;
    const ativo = botoes.current[indiceAtivo];
    if (!elemento || !ativo || elemento.scrollWidth <= elemento.clientWidth) return;
    elemento.scrollLeft = ativo.offsetLeft - (elemento.clientWidth - ativo.offsetWidth) / 2;
  }, [indiceAtivo]);

  /** Setas, Home e End movem a escolha, como em todo grupo de opções. */
  function aoTeclar(evento: KeyboardEvent<HTMLButtonElement>, indice: number) {
    const ultimo = itens.length - 1;
    let destino: number | null = null;
    if (evento.key === "ArrowDown" || evento.key === "ArrowRight") destino = indice === ultimo ? 0 : indice + 1;
    if (evento.key === "ArrowUp" || evento.key === "ArrowLeft") destino = indice === 0 ? ultimo : indice - 1;
    if (evento.key === "Home") destino = 0;
    if (evento.key === "End") destino = ultimo;
    if (destino === null) return;

    evento.preventDefault();
    onChange(itens[destino].valor);
    botoes.current[destino]?.focus();
  }

  return (
    <div>
      {coluna && <p className="mb-2 hidden px-2.5 text-xs font-medium text-text-tertiary lg:block">{rotulo}</p>}
      <div
        ref={faixa}
        role="radiogroup"
        aria-label={rotulo}
        className={`custom-scrollbar relative -mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 ${
          coluna ? "lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:p-0" : "lg:-mx-8 lg:px-8"
        }`}
      >
        {itens.map((item, i) => {
          const ativo = i === indiceAtivo;
          const vazio = item.total === 0;
          const abreGrupo = Boolean(item.grupo || item.separado) && i > 0;

          return (
            <div
              key={item.valor}
              className={`flex shrink-0 ${
                coluna ? `lg:block ${abreGrupo ? "lg:mt-2 lg:border-t lg:border-border-subtle lg:pt-2" : ""}` : ""
              }`}
            >
              {/* Na faixa, o grupo novo é separado por um fio vertical. */}
              {abreGrupo && (
                <span aria-hidden className={`mx-1 w-px self-stretch bg-border-subtle ${coluna ? "lg:hidden" : ""}`} />
              )}
              {item.grupo && coluna && (
                <p aria-hidden className="mb-1 hidden px-2.5 text-xs text-text-tertiary lg:block">
                  {item.grupo}
                </p>
              )}
              <button
                ref={(elemento) => {
                  botoes.current[i] = elemento;
                }}
                type="button"
                role="radio"
                aria-checked={ativo}
                // Um só ponto de parada no Tab; dentro do grupo, as setas.
                tabIndex={ativo || (indiceAtivo === -1 && i === 0) ? 0 : -1}
                onClick={() => onChange(item.valor)}
                onKeyDown={(evento) => aoTeclar(evento, i)}
                title={item.dica}
                className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  ativo
                    ? "bg-accent-soft font-medium text-accent"
                    : vazio
                      ? "text-text-tertiary hover:bg-surface-hover"
                      : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                }`}
              >
                {comCodigo && (
                  <span
                    className={`w-5 shrink-0 font-mono text-xs ${item.codigo ? "" : coluna ? "max-lg:hidden" : "hidden"} ${
                      ativo ? "" : "text-text-tertiary"
                    }`}
                  >
                    {item.codigo}
                  </span>
                )}
                <span className="flex-1">{item.nome}</span>
                <span
                  className={`font-mono text-xs tabular-nums ${
                    ativo ? "" : !vazio && item.tom ? COR_DO_TOM[item.tom] : "text-text-tertiary"
                  }`}
                >
                  {item.total.toLocaleString("pt-BR")}
                  <span className="sr-only"> {item.total === 1 ? unidade[0] : unidade[1]}</span>
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
