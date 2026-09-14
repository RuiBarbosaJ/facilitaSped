import { valorDaColuna } from "../leiaute/acesso";
import type { LinhaSped } from "./parser";
import type { FiltrosGrade } from "./protocolo";

/**
 * As colunas cujo filtro esta linha NÃO satisfaz.
 *
 * Os dois usos da grade precisam da mesma conta, mas em profundidades
 * diferentes: a janela só quer saber se sobrou alguma reprovação, e o menu de
 * opções precisa da lista — uma linha que reprova só na coluna X ainda
 * contribui com os valores possíveis DAQUELA coluna, que é o que faz o menu
 * nunca oferecer uma opção que zera a tabela. Antes eram dois laços copiados
 * que já divergiam no dia em que foram escritos: um abortava na primeira
 * reprovação, o outro seguia avaliando.
 */
export function colunasReprovadas(
  linha: LinhaSped,
  filtros: FiltrosGrade | undefined
): string[] {
  if (!filtros) return [];

  const falhas: string[] = [];
  for (const coluna of Object.keys(filtros)) {
    const aceitos = filtros[coluna];
    if (!aceitos || aceitos.length === 0) continue;

    // `null` = o registro desta linha nem possui a coluna; reprova.
    const valor = valorDaColuna(linha.campos, coluna);
    if (valor === null || !aceitos.includes(valor)) falhas.push(coluna);
  }
  return falhas;
}

/** Atalho para quem só precisa do sim ou não. */
export function aprovada(linha: LinhaSped, filtros: FiltrosGrade | undefined): boolean {
  if (!filtros) return true;
  for (const coluna of Object.keys(filtros)) {
    const aceitos = filtros[coluna];
    if (!aceitos || aceitos.length === 0) continue;
    const valor = valorDaColuna(linha.campos, coluna);
    if (valor === null || !aceitos.includes(valor)) return false;
  }
  return true;
}
