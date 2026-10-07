import type { RegraAgrupada } from "./agrupar";
import type { ColunaFiltravel } from "@/comum/filtrosColuna";
import { formatarNcm } from "@/comum/ncm";

export interface ColunaConsulta extends ColunaFiltravel<RegraAgrupada> {
  alinhamento: "text-left" | "text-right";
  /** Largura fixa a partir do tablet; a descrição fica com o que sobrar. */
  largura?: string;
}

/** "2.65" → "2,65%". O contador lê vírgula; o portal publica ponto. */
export function formatarAliquota(aliquota: string): string {
  return aliquota ? `${aliquota.replace(".", ",")}%` : "";
}

/**
 * O mesmo texto que a célula de vigência mostra. O menu de filtro precisa
 * oferecer exatamente o que está na tela — quando as duas pontas montavam a
 * string cada uma do seu jeito, marcar a opção não casava com linha nenhuma.
 */
export function rotuloVigencia(regra: RegraAgrupada): string {
  if (!regra.data_inicio && !regra.data_fim) return "";
  const inicio = regra.data_inicio || "—";
  return regra.data_fim ? `${inicio} a ${regra.data_fim}` : `${inicio} — vigente`;
}

/**
 * As colunas da tela de consulta e como filtrar cada uma. Coluna sem `valores`
 * não ganha menu: é texto livre, teria uma opção por linha e a busca resolve
 * melhor esse caso.
 *
 * A ordem põe os códigos à esquerda e a prosa à direita. O NCM é a chave pela
 * qual a lista está ordenada e a natureza da receita é o que se copia para o
 * ERP; lado a lado, o olho vai de um ao outro sem atravessar a descrição.
 */
export const COLUNAS_CONSULTA: ColunaConsulta[] = [
  {
    id: "ncm",
    rotulo: "NCM",
    alinhamento: "text-left",
    largura: "md:w-[17rem]",
    // Cada NCM é uma opção sua, escrita como a célula a mostra. A célula lista
    // vários e o menu antigo oferecia a string truncada inteira ("0201, 0202,
    // 0203..."), que só casava com uma regra de exatamente aqueles NCMs.
    valores: (regra) => regra.ncms.map(formatarNcm),
  },
  { id: "cst", rotulo: "CST", alinhamento: "text-left", largura: "md:w-20", valores: (regra) => [regra.cst] },
  {
    id: "natureza",
    rotulo: "Natureza",
    alinhamento: "text-left",
    largura: "md:w-24",
    valores: (regra) => [regra.natureza_receita ?? ""],
  },
  {
    id: "aliquota",
    rotulo: "Alíquota",
    alinhamento: "text-right",
    largura: "md:w-24",
    valores: (regra) => [formatarAliquota(regra.aliquota)],
  },
  { id: "descricao", rotulo: "Descrição", alinhamento: "text-left", valores: (regra) => [regra.descricao || ""] },
  {
    id: "vigencia",
    rotulo: "Vigência",
    alinhamento: "text-left",
    largura: "md:w-40",
    valores: (regra) => [rotuloVigencia(regra)],
  },
];

/**
 * As colunas que a tela mostra agora.
 *
 * Coluna em que toda linha diz a mesma coisa não informa nada e empurra a
 * descrição para fora da tela. Com um CST escolhido, a coluna CST repetia
 * "06" cento e dezoito vezes; fora das tabelas que publicam alíquota, a
 * coluna de alíquota era um traço de cima a baixo.
 */
export function colunasVisiveis(todasAsTabelas: boolean, temAliquota: boolean): ColunaConsulta[] {
  return COLUNAS_CONSULTA.filter((coluna) => {
    if (coluna.id === "cst") return todasAsTabelas;
    if (coluna.id === "aliquota") return temAliquota;
    return true;
  });
}
