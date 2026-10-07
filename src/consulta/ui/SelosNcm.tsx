"use client";

import { useState } from "react";

import { formatarNcm } from "@/comum/ncm";
import { CodigoCopiavel } from "./CodigoCopiavel";

interface SelosNcmProps {
  ncms: string[];
  /** Os NCMs que casaram com a busca. */
  destacados: Set<string>;
}

/** Acima disso a célula vira um muro de códigos; o resto fica atrás do "+N". */
const VISIVEIS = 6;

/**
 * Os NCMs de uma regra, como texto — não como pastilhas.
 *
 * Cada código num fundo cinza fazia de cada linha uma fileira de botões e
 * competia com a única cor que importa na coluna: a do código que casou com a
 * busca. Esse vem para a frente e acende; numa regra que cita 27 NCMs, ele
 * ficava escondido atrás do "+21", e a linha parecia estar ali por engano.
 */
export function SelosNcm({ ncms, destacados }: SelosNcmProps) {
  const [expandido, setExpandido] = useState(false);

  if (ncms.length === 0) {
    return <span className="text-text-tertiary">—</span>;
  }

  const ordenados =
    destacados.size > 0
      ? [...ncms.filter((ncm) => destacados.has(ncm)), ...ncms.filter((ncm) => !destacados.has(ncm))]
      : ncms;
  const mostrados = expandido ? ordenados : ordenados.slice(0, VISIVEIS);
  const ocultos = ordenados.length - mostrados.length;

  return (
    // -mx-1 devolve o recuo interno do botão: o texto do primeiro código
    // alinha com o título da coluna, não com a borda do botão.
    <div className="-mx-1 flex flex-wrap items-center gap-x-1">
      {mostrados.map((ncm) => (
        <CodigoCopiavel
          key={ncm}
          valor={ncm}
          texto={formatarNcm(ncm)}
          tipo="NCM"
          destaque={destacados.has(ncm)}
          className={destacados.has(ncm) ? "" : "text-text-primary"}
        />
      ))}

      {ocultos > 0 && (
        <button
          type="button"
          onClick={() => setExpandido(true)}
          title={`Mostrar os outros ${ocultos} NCMs desta regra`}
          className="rounded-sm px-1 text-xs leading-6 font-medium text-accent transition-colors hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          +{ocultos}
        </button>
      )}
    </div>
  );
}
