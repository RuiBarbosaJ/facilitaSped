import type { ReactNode } from "react";

interface TituloDaTelaProps {
  /** O nome da tela, curto. É um título de ferramenta, não uma chamada. */
  titulo: string;
  /**
   * A versão do que está na tela: leiaute, tabela, nomenclatura.
   *
   * Vem em fonte monoespaçada e discreta, ao lado do título. Quem audita
   * escrituração precisa saber CONTRA O QUÊ está conferindo antes de olhar o
   * primeiro dado — e essa informação normalmente fica num rodapé que ninguém
   * lê, ou em lugar nenhum.
   */
  versao?: ReactNode;
  /** Uma linha, quando a tela precisa de contexto. Nunca um parágrafo. */
  descricao?: string;
}

/**
 * O cabeçalho de uma tela, no registro de console de dados.
 *
 * Substitui o par "título grande + parágrafo explicativo" que toda landing page
 * usa. Quem abre esta ferramenta já sabe o que ela faz: o que ele precisa ver
 * primeiro é o nome da tela, a versão da norma e os dados. O texto que explicava
 * o óbvio ocupava a primeira dobra inteira e empurrava a tabela para baixo.
 */
export function TituloDaTela({ titulo, versao, descricao }: TituloDaTelaProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h1 className="text-lg font-semibold tracking-tight text-text-primary">{titulo}</h1>
        {versao && (
          <span className="inline-flex items-center gap-1.5 rounded border border-border-subtle bg-surface-head px-2 py-0.5 font-mono text-[11px] text-text-secondary">
            {versao}
          </span>
        )}
      </div>
      {descricao && <p className="max-w-3xl text-xs text-text-tertiary">{descricao}</p>}
    </div>
  );
}
