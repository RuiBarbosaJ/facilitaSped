"use client";

import { useEffect, useState } from "react";

interface CodigoCopiavelProps {
  /** O que vai para a área de transferência: o dado como o ERP o recebe. */
  valor: string;
  /** O que a tela mostra, quando difere do valor (o NCM com pontos). */
  texto?: string;
  /** O nome do código, para a dica e o leitor de tela: "NCM", "natureza". */
  tipo: string;
  /** O código casou com a busca. */
  destaque?: boolean;
  className?: string;
}

/**
 * Um código fiscal que se copia com um clique.
 *
 * Todo código da tabela funciona igual — NCM, CST e natureza da receita —,
 * porque o passo seguinte a toda consulta é colar algum deles no cadastro do
 * produto. Antes, o NCM copiava ao clicar, o CST tinha um ícone que só
 * aparecia sob o mouse e a natureza, que é justamente o código que o contador
 * mais procura aqui, não copiava de jeito nenhum.
 *
 * O retorno é a cor, e não um ícone que entra ao lado: o ícone alargava o
 * botão e empurrava os vizinhos de lugar no meio da leitura.
 */
export function CodigoCopiavel({
  valor,
  texto = valor,
  tipo,
  destaque = false,
  className = "",
}: CodigoCopiavelProps) {
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!copiado) return;
    const timer = setTimeout(() => setCopiado(false), 1600);
    return () => clearTimeout(timer);
  }, [copiado]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
    } catch {
      // Sem permissão de clipboard a consulta continua útil; só não há retorno.
    }
  }

  const rotulo = `Copiar ${tipo} ${valor}`;
  const estado = copiado
    ? "bg-success-soft text-success"
    : destaque
      ? "bg-accent-soft text-accent font-medium"
      : "hover:bg-surface-hover hover:text-accent";

  return (
    <button
      type="button"
      onClick={copiar}
      title={copiado ? "Copiado" : rotulo}
      aria-label={rotulo}
      className={`cursor-copy rounded-sm px-1 font-mono text-[13px] leading-6 whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${estado} ${className}`}
    >
      {texto}
      <span className="sr-only" aria-live="polite">
        {copiado ? " copiado" : ""}
      </span>
    </button>
  );
}
