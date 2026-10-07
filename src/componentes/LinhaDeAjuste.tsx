import type { ReactNode } from "react";

interface LinhaDeAjusteProps {
  /** O nome do ajuste, na coluna da esquerda. */
  rotulo: string;
  /** Quando o controle é um campo de formulário, o rótulo aponta para ele. */
  htmlFor?: string;
  /**
   * O ajuste está mudando o que a tela mostra — o critério de correção ligado,
   * por exemplo. A linha ganha o fundo de destaque para que ninguém confunda a
   * planilha corrigida com a que veio no arquivo.
   */
  ativo?: boolean;
  children: ReactNode;
}

/**
 * Uma linha do painel de ajustes de uma auditoria: rótulo à esquerda, controle
 * e explicação à direita.
 *
 * Os ajustes que decidem a leitura do arquivo — a ponta da operação, o regime,
 * o critério de correção, a finalidade da escrituração — viviam cada um num
 * cartão próprio, com ícone e título, empilhados até a tabela sumir da tela.
 * Lado a lado num painel só, com o rótulo sempre na mesma coluna, eles se
 * leem como o que são: as premissas da conferência.
 */
export function LinhaDeAjuste({ rotulo, htmlFor, ativo = false, children }: LinhaDeAjusteProps) {
  const Rotulo = htmlFor ? "label" : "p";
  return (
    <div
      className={`grid gap-x-6 gap-y-2 px-4 py-3 transition-colors sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-start ${
        ativo ? "bg-accent-soft" : ""
      }`}
    >
      <Rotulo htmlFor={htmlFor} className="text-sm font-medium text-text-primary sm:pt-1.5">
        {rotulo}
      </Rotulo>
      <div className="flex min-w-0 flex-col gap-2">{children}</div>
    </div>
  );
}
