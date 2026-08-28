"use client";

import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";

interface BotaoCopiarProps {
  valor: string;
  rotulo: string;
}

/**
 * Copia um valor para a área de transferência e dá retorno visual por 2s.
 * O estado vive aqui dentro para que cada botão se controle sozinho, sem que a
 * página precise rastrear qual linha foi copiada.
 */
export function BotaoCopiar({ valor, rotulo }: BotaoCopiarProps) {
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!copiado) return;
    const timer = setTimeout(() => setCopiado(false), 2000);
    return () => clearTimeout(timer);
  }, [copiado]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
    } catch {
      // Contextos sem permissão de clipboard (http, permissão negada) apenas
      // não dão retorno — não faz sentido interromper a consulta por isso.
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      title={rotulo}
      aria-label={rotulo}
      className="p-1 rounded text-text-tertiary opacity-0 group-hover/linha:opacity-100 focus:opacity-100 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all"
    >
      {copiado ? (
        <Check size={14} className="text-success" aria-hidden />
      ) : (
        <Copy size={14} aria-hidden />
      )}
    </button>
  );
}
