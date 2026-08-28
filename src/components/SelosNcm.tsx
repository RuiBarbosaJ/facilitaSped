"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

interface SelosNcmProps {
  ncms: string[];
}

/** Acima disso a célula vira um muro de códigos; o resto fica atrás do "+N". */
const VISIVEIS = 6;

/**
 * Os NCMs de uma regra. Cada selo é ele próprio o botão de copiar — clicar copia
 * aquele código. Com regras que abrangem até 27 NCMs, um ícone de cópia ao lado
 * de cada um encheria a linha de ruído.
 */
export function SelosNcm({ ncms }: SelosNcmProps) {
  const [expandido, setExpandido] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);

  useEffect(() => {
    if (!copiado) return;
    const timer = setTimeout(() => setCopiado(null), 2000);
    return () => clearTimeout(timer);
  }, [copiado]);

  if (ncms.length === 0) {
    return <span className="text-text-tertiary">—</span>;
  }

  async function copiar(ncm: string) {
    try {
      await navigator.clipboard.writeText(ncm);
      setCopiado(ncm);
    } catch {
      // Sem permissão de clipboard a consulta continua útil; só não há retorno.
    }
  }

  const mostrados = expandido ? ncms : ncms.slice(0, VISIVEIS);
  const ocultos = ncms.length - mostrados.length;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {mostrados.map((ncm) => (
        <button
          key={ncm}
          type="button"
          onClick={() => copiar(ncm)}
          title={`Copiar NCM ${ncm}`}
          aria-label={`Copiar NCM ${ncm}`}
          className="inline-flex items-center gap-1 font-mono text-sm rounded bg-badge-ncm-bg px-1.5 py-0.5 text-badge-ncm-text hover:bg-accent-soft hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
        >
          {ncm}
          {copiado === ncm && <Check size={12} className="text-success" aria-hidden />}
        </button>
      ))}

      {ocultos > 0 && (
        <button
          type="button"
          onClick={() => setExpandido(true)}
          className="text-xs font-medium text-accent hover:text-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded px-1 transition-colors"
        >
          +{ocultos}
        </button>
      )}
    </div>
  );
}
