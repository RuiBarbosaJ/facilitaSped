"use client";

import { useMemo } from "react";
import type { RegistroSped } from "@/types/sped";
import { ordinalData } from "@/lib/datas";

export interface OpcaoCst {
  cst: string;
  rotulo: string;
}

/** Valor especial do seletor que desliga o filtro por CST. */
export const TODOS_CST = "todos";

/** A equipe trabalha quase só com alíquota zero; é o que a tela abre mostrando. */
export const CST_PADRAO = "06";

/**
 * Linha vinda da tabela 4.3.3: define o que cada CST significa. Serve de rótulo
 * para o seletor, mas não é uma regra consultável.
 */
const ehDefinicaoDeCst = (registro: RegistroSped): boolean =>
  !registro.ncm && !registro.natureza_receita && registro.cst !== "";

/** Identifica uma regra: o código de natureza da receita, dentro da sua tabela. */
const chaveRegra = (registro: RegistroSped): string =>
  `${registro.tabela ?? ""}|${registro.natureza_receita ?? ""}`;

/**
 * Mantém, para cada regra, apenas as linhas da vigência mais recente.
 *
 * Quando a Receita altera uma regra, o portal acrescenta uma linha nova com o
 * mesmo código e outro período, sem apagar a anterior. Para a consulta do dia a
 * dia interessa a última versão — mesmo que já encerrada, é a informação mais
 * atual sobre aquele código. Linhas com a mesma data de início (uma regra que
 * lista vários NCMs) são preservadas juntas.
 */
export function apenasVigenciaMaisRecente(registros: RegistroSped[]): RegistroSped[] {
  const maisRecente = new Map<string, number>();
  for (const registro of registros) {
    if (!registro.natureza_receita) continue;
    const chave = chaveRegra(registro);
    const inicio = ordinalData(registro.data_inicio);
    if (inicio > (maisRecente.get(chave) ?? -1)) maisRecente.set(chave, inicio);
  }

  return registros.filter(
    (registro) =>
      !registro.natureza_receita ||
      ordinalData(registro.data_inicio) === maisRecente.get(chaveRegra(registro))
  );
}

/**
 * Filtra as regras pelo CST escolhido e reduz cada uma à sua vigência mais
 * recente. Também monta as opções do seletor a partir dos dados, para que um
 * CST novo publicado pela Receita apareça sozinho.
 */
export function useFiltroCst(
  registros: RegistroSped[],
  cst: string
): { opcoes: OpcaoCst[]; regras: RegistroSped[] } {
  const opcoes = useMemo(() => {
    const rotulos = new Map<string, string>();
    const usados = new Set<string>();
    for (const registro of registros) {
      if (ehDefinicaoDeCst(registro)) rotulos.set(registro.cst, registro.descricao);
      else if (registro.cst) usados.add(registro.cst);
    }
    return Array.from(usados)
      .sort()
      .map((codigo) => ({
        cst: codigo,
        rotulo: rotulos.has(codigo) ? `${codigo} — ${rotulos.get(codigo)}` : `CST ${codigo}`,
      }));
  }, [registros]);

  const regras = useMemo(() => {
    const selecionadas = registros.filter(
      (registro) =>
        !ehDefinicaoDeCst(registro) && (cst === TODOS_CST || registro.cst === cst)
    );
    return apenasVigenciaMaisRecente(selecionadas);
  }, [registros, cst]);

  return { opcoes, regras };
}
