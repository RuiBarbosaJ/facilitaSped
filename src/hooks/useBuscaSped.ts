"use client";

import { useDeferredValue, useMemo } from "react";
import Fuse from "fuse.js";
import type { RegistroSped } from "@/types/sped";

/**
 * Pesos maiores nos códigos: quem digita "2710" quer o NCM, não uma descrição
 * que por acaso cite esse número.
 */
const OPCOES: import("fuse.js").IFuseOptions<RegistroSped> = {
  keys: [
    { name: "ncm", weight: 3 },
    { name: "cst", weight: 2 },
    { name: "natureza_receita", weight: 2 },
    { name: "descricao", weight: 1 },
  ],
  // 0.2 medido contra os dados reais: buscar "2710" devolve 47 resultados em vez
  // dos 405 de um threshold 0.3, sem perder nenhuma busca por texto
  // ("cerveja", "gasolina" e "farinha de trigo" retornam o mesmo conjunto).
  threshold: 0.2,
  // Sem isso o Fuse só pontua bem o que aparece no início do texto — ruim para
  // descrições longas, onde o termo buscado costuma estar no meio.
  ignoreLocation: true,
  minMatchCharLength: 2,
};

/**
 * Busca difusa sobre as tabelas do SPED.
 *
 * O índice do Fuse é construído uma única vez por conjunto de dados. A consulta
 * passa por `useDeferredValue` para que a digitação continue fluida mesmo com
 * mais de mil registros indexados.
 */
export function useBuscaSped(registros: RegistroSped[], consulta: string): RegistroSped[] {
  const consultaAdiada = useDeferredValue(consulta);

  const fuse = useMemo(() => new Fuse(registros, OPCOES), [registros]);

  return useMemo(() => {
    const termo = consultaAdiada.trim();
    if (!termo) return registros;
    return fuse.search(termo).map((resultado) => resultado.item);
  }, [fuse, registros, consultaAdiada]);
}
