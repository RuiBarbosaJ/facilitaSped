import type { ColunaFiltravel } from "@/comum/filtrosColuna";
import type { Achado, Severidade } from "@/regras/nucleo/contrato";

export type ColunaAchado = ColunaFiltravel<Achado>;

/** Rótulo de cada severidade. É por ele que o menu de filtro é lido e ordenado. */
export const ROTULO_SEVERIDADE: Record<Severidade, string> = {
  critico: "Crítico",
  erro: "Erro",
  alerta: "Alerta",
  info: "Informativo",
};

/** Da mais grave para a menos: é a ordem em que o contador quer resolver. */
export const ORDEM_SEVERIDADE: Record<Severidade, number> = {
  critico: 0,
  erro: 1,
  alerta: 2,
  info: 3,
};

/**
 * Colunas da lista de apontamentos e como filtrar cada uma.
 *
 * Coluna sem `valores` não ganha menu: o número da linha é único por definição
 * e a mensagem é texto livre que repete o valor da própria linha no meio da
 * frase — o menu viraria uma opção por apontamento. Para esses dois a busca
 * serve melhor, exatamente como na auditoria de planilhas.
 */
export const COLUNAS_ACHADOS: ColunaAchado[] = [
  {
    id: "severidade",
    rotulo: "Severidade",
    valores: (achado) => [ROTULO_SEVERIDADE[achado.severidade]],
  },
  { id: "linha", rotulo: "Linha" },
  {
    id: "registro",
    rotulo: "Registro",
    valores: (achado) => [achado.reg || "—"],
  },
  {
    id: "codigo",
    rotulo: "Código",
    valores: (achado) => [achado.codigo],
  },
  {
    id: "regra",
    rotulo: "Regra",
    valores: (achado) => [achado.regra],
  },
  {
    id: "correcao",
    rotulo: "Correção",
    valores: (achado) => [achado.corrigivel ? "Automática na regravação" : "Manual, na origem"],
  },
  { id: "mensagem", rotulo: "Mensagem" },
];

/** Texto sobre o qual a busca da lista de apontamentos trabalha. */
export function textoDoAchado(achado: Achado): string {
  return `${achado.codigo} ${achado.reg} ${achado.regra} ${achado.mensagem} ${achado.nl}`.toLowerCase();
}
