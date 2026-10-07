"use client";

import { useDeferredValue, useMemo } from "react";
import Fuse from "fuse.js";
import type { RegraTabelaSped } from "@/tipos/tabelas-receita";
import { combinarBusca } from "@/consulta/buscar";

/**
 * A busca cobre só NCM e descrição — CST e natureza da receita são exibidos,
 * mas não pesquisáveis. Peso maior no NCM: quem digita "2710" quer o código,
 * não uma descrição que por acaso cite esse número.
 */
export const OPCOES: import("fuse.js").IFuseOptions<RegraTabelaSped> = {
  keys: [
    { name: "ncm", weight: 3 },
    { name: "descricao", weight: 1 },
  ],
  // 0.2 medido contra os dados reais: buscar "2710" devolve 47 resultados em vez
  // dos 401 de um threshold 0.3, sem perder nenhuma busca por texto
  // ("cerveja", "gasolina" e "farinha de trigo" retornam o mesmo conjunto).
  threshold: 0.2,
  // Sem isso o Fuse só pontua bem o que aparece no início do texto — ruim para
  // descrições longas, onde o termo buscado costuma estar no meio.
  ignoreLocation: true,
  // O contador digita "acucar"; a Receita escreve "açúcar". Sem isto, zero
  // resultados. Só afrouxa a comparação: tudo o que casava continua casando.
  ignoreDiacritics: true,
  minMatchCharLength: 2,
};

/**
 * Busca difusa sobre as tabelas do SPED.
 *
 * O índice do Fuse é construído uma única vez por conjunto de dados. A consulta
 * passa por `useDeferredValue` para que a digitação continue fluida mesmo com
 * mais de mil registros indexados.
 *
 * Quando o termo é um NCM, as regras que o citam — ele próprio, a posição ou o
 * capítulo que o abrangem — vêm na frente do resultado da busca por texto, que
 * continua inteiro logo atrás (ver `@/consulta/buscar`).
 */
export function useBuscaRegras(registros: RegraTabelaSped[], consulta: string): RegraTabelaSped[] {
  const consultaAdiada = useDeferredValue(consulta);

  const fuse = useMemo(() => new Fuse(registros, OPCOES), [registros]);

  return useMemo(() => {
    const termo = consultaAdiada.trim();
    if (!termo) return registros;
    const porTexto = fuse.search(termo).map((resultado) => resultado.item);
    return combinarBusca(registros, porTexto, termo);
  }, [fuse, registros, consultaAdiada]);
}
