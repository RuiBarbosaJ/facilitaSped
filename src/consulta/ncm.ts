/**
 * O NCM como o contador o lê e como a tabela da Receita o cita.
 *
 * As tabelas do SPED citam códigos de 2 a 8 dígitos — capítulo, posição,
 * subposição, item —, e o produto do cliente tem sempre o código completo. A
 * tela precisa ligar os dois: o arroz quebrado 1006.40.00 não aparece em
 * tabela nenhuma com esse número, mas a posição 1006 aparece.
 */

/**
 * Como o código citado pela regra se relaciona com o que foi buscado.
 *
 * - `exato`: a regra cita o próprio código.
 * - `abrange`: a regra cita um nível acima (posição, capítulo) que contém o
 *   código buscado. É a mesma leitura que a auditoria de PIS/COFINS já faz ao
 *   cruzar a planilha (`indexarBase`): o código da regra é prefixo do NCM.
 * - `detalha`: a regra cita um código mais específico dentro do que foi
 *   digitado — quem busca "1006" quer ver também o 1006.20 e o 1006.30.
 */
export type Parentesco = "exato" | "abrange" | "detalha";

export function parentesco(ncmDaRegra: string, buscado: string): Parentesco | null {
  if (!ncmDaRegra || !buscado) return null;
  if (ncmDaRegra === buscado) return "exato";
  if (buscado.startsWith(ncmDaRegra)) return "abrange";
  if (ncmDaRegra.startsWith(buscado)) return "detalha";
  return null;
}
