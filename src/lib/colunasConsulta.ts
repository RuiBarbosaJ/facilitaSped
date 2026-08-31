import type { RegraAgrupada } from "./agrupar";
import type { ColunaFiltravel } from "./filtrosColuna";

export interface ColunaConsulta extends ColunaFiltravel<RegraAgrupada> {
  alinhamento: "text-left" | "text-right";
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
 */
export const COLUNAS_CONSULTA: ColunaConsulta[] = [
  {
    id: "ncm",
    rotulo: "NCM",
    alinhamento: "text-left",
    // Cada NCM é uma opção sua. A célula lista vários e o menu antigo oferecia
    // a string truncada inteira ("0201, 0202, 0203..."), que só casava com uma
    // regra que tivesse exatamente aqueles NCMs na mesma ordem.
    valores: (regra) => regra.ncms,
  },
  { id: "descricao", rotulo: "Descrição", alinhamento: "text-left", valores: (regra) => [regra.descricao || ""] },
  { id: "cst", rotulo: "CST", alinhamento: "text-left", valores: (regra) => [regra.cst] },
  {
    id: "aliquota",
    rotulo: "Alíquota",
    alinhamento: "text-right",
    valores: (regra) => [regra.aliquota],
  },
  {
    id: "natureza",
    rotulo: "Nat. receita",
    alinhamento: "text-left",
    valores: (regra) => [regra.natureza_receita ?? ""],
  },
  {
    id: "vigencia",
    rotulo: "Vigência",
    alinhamento: "text-left",
    valores: (regra) => [rotuloVigencia(regra)],
  },
];
