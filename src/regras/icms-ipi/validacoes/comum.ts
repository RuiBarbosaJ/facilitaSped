import { codigoNormalizado, numeroDe, valorDe } from "../../nucleo/acesso";
import type { Documento, LinhaSped } from "../../nucleo/contrato";
import { DICIONARIO_SPED_ICMS_IPI } from "../dicionario-sped-icms-ipi";

/**
 * O vocabulário que toda regra desta pasta usa.
 *
 * Existe para que nenhuma regra repita as três armadilhas do README — o CST de
 * três dígitos, o campo de valor vazio que vale zero e o documento cancelado
 * que não entra em confronto nenhum. Cada uma delas produz falha SILENCIOSA:
 * nada quebra, nenhum teste fica vermelho, e a auditoria passa a mentir em
 * massa sobre arquivo correto.
 */

export const DIC = DICIONARIO_SPED_ICMS_IPI;

/** Valor bruto de um campo desta linha, já sem espaço nas pontas. */
export function texto(campos: readonly string[], nome: string): string {
  return valorDe(DIC, campos, nome) ?? "";
}

/**
 * Valor numérico de um campo, com vazio valendo zero.
 *
 * Devolve `null` só quando o conteúdo não é um número — que é achado de tipo, e
 * não de valor. Quem precisa distinguir campo omitido de campo zerado usa
 * `numeroOuNulo` de `nucleo/acesso`; aqui, num campo de valor, vazio É zero.
 */
export function numero(campos: readonly string[], nome: string): number | null {
  return numeroDe(valorDe(DIC, campos, nome));
}

/** Como `numero`, mas trata conteúdo inválido como zero. Para somatórios. */
export function numeroOuZero(campos: readonly string[], nome: string): number {
  return numero(campos, nome) ?? 0;
}

/**
 * Situações que tiram o documento de todo confronto de valor e de filhos.
 *
 * Cancelado (02 e 03), inutilizado (04) e denegado (05) são registrados para
 * fechar a numeração, não para escriturar operação: vêm sem itens, sem
 * analítico e frequentemente sem valores. Uma regra de totalizador que não os
 * exclua acusa erro em cada NF-e cancelada e em cada faixa inutilizada — o que,
 * num arquivo de varejo, é uma enxurrada de achado falso.
 */
export const SITUACOES_SEM_MOVIMENTO: ReadonlySet<string> = new Set(["02", "03", "04", "05"]);

/** O documento escritura operação, e por isso entra nos confrontos. */
export function temMovimento(documento: Documento): boolean {
  const codSit = valorDe(DIC, documento.campos, "COD_SIT");
  if (codSit === null || codSit === "") return true; // campo ausente não exclui
  return !SITUACOES_SEM_MOVIMENTO.has(codigoNormalizado(codSit, 2));
}

/**
 * Comparação de valores com tolerância.
 *
 * Comparar somatório de centavos com `===` é o erro mais caro que este motor
 * pode cometer: uma nota com cem itens acumula diferença de arredondamento
 * legítima, e a auditoria passaria a acusar divergência de totalizador em
 * praticamente todo documento grande de toda escrituração.
 */
export function proximo(a: number, b: number, tolerancia: number): boolean {
  return Math.abs(a - b) <= tolerancia;
}

/**
 * Tolerância que acompanha a quantidade de parcelas somadas.
 *
 * Um centavo de folga basta para confrontar dois campos; não basta para somar
 * duzentos itens, em que o arredondamento de cada um pode empurrar o total em
 * até meio centavo. Fixar a tolerância no valor de duas parcelas faria a regra
 * disparar em documento grande e perfeitamente calculado.
 */
export function toleranciaDeSoma(parcelas: number, base = 0.02): number {
  return base + 0.01 * Math.max(0, parcelas - 1);
}

/**
 * A chave de agrupamento do registro analítico: CST + CFOP + alíquota.
 *
 * A alíquota entra NORMALIZADA COMO NÚMERO, e essa é a sutileza que decide a
 * regra: "18,00", "18,0" e "18" são a mesma alíquota, e comparar as strings as
 * separaria em três grupos distintos. O resultado seria um achado de "item sem
 * correspondência no analítico" em documento perfeitamente consolidado —
 * exatamente sobre o arquivo de quem trocou de ERP no meio do período.
 */
export function chaveAnalitica(campos: readonly string[]): string {
  const cst = texto(campos, "CST_ICMS");
  const cfop = texto(campos, "CFOP");
  const aliquota = numero(campos, "ALIQ_ICMS");
  return `${cst}|${cfop}|${aliquota === null ? "?" : aliquota.toFixed(2)}`;
}

/** A chave de volta em texto legível, para a mensagem do achado. */
export function descreverChave(campos: readonly string[]): string {
  const cst = texto(campos, "CST_ICMS") || "(vazio)";
  const cfop = texto(campos, "CFOP") || "(vazio)";
  const aliquota = texto(campos, "ALIQ_ICMS") || "0,00";
  return `CST ${cst}, CFOP ${cfop}, alíquota ${aliquota}`;
}

/**
 * Formata um valor no padrão do arquivo — vírgula decimal, sem milhar.
 *
 * É o formato do campo `esperado` do achado, que a UI mostra como valor
 * sugerido e a regravação, quando a correção for automatizável, escreve de
 * volta na linha. Devolver "1.234,56" produziria um campo que o PVA recusa.
 */
export function comoValorSped(numero: number, decimais = 2): string {
  return numero.toFixed(decimais).replace(".", ",");
}

/** Itens (C170) de um documento genérico, para regra que não usa o atalho. */
export function itensDe(documento: Documento): readonly LinhaSped[] {
  return documento.filhos.get("C170") ?? [];
}
