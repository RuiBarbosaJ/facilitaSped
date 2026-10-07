import type { RegraTabelaSped } from "@/tipos/tabelas-receita";
import { parentesco } from "./ncm";

/**
 * O que a busca por texto não alcança: o NCM do produto.
 *
 * A busca difusa compara o termo com o código citado pela regra como se fosse
 * texto. Para "2710" funciona; para o NCM que o contador tem na mão — os oito
 * dígitos da nota, com ou sem pontos — não: "10064000" e "1006.40.00" voltavam
 * vazios, embora a posição 1006 esteja na tabela. Aqui o código é lido como
 * hierarquia, e o resultado SOMA ao da busca por texto, nunca o substitui.
 */

/** Só dígitos e os separadores com que um NCM chega: ponto, espaço, hífen. */
const PARECE_NCM = /^[\d.\s-]+$/;

/**
 * Os dígitos do NCM digitado, ou `null` quando o termo não é um código.
 * NCM tem de 2 (capítulo) a 8 dígitos; mais que isso é outro número — CNPJ,
 * chave de nota — e fica só com a busca por texto.
 */
export function digitosDoNcm(termo: string): string | null {
  const limpo = termo.trim();
  if (!PARECE_NCM.test(limpo)) return null;
  const digitos = limpo.replace(/\D/g, "");
  return digitos.length >= 2 && digitos.length <= 8 ? digitos : null;
}

/**
 * As regras que citam o código buscado, um nível acima dele ou um abaixo.
 *
 * A ordem responde à pergunta de quem buscou: primeiro a regra do próprio
 * código, depois as que o abrangem da mais específica para a mais ampla (a
 * posição antes do capítulo) e por fim os códigos mais detalhados que cabem
 * dentro do que foi digitado.
 */
export function regrasDoNcm(registros: RegraTabelaSped[], digitos: string): RegraTabelaSped[] {
  const achados: { regra: RegraTabelaSped; peso: number; indice: number }[] = [];

  registros.forEach((regra, indice) => {
    const relacao = parentesco(regra.ncm, digitos);
    if (!relacao) return;
    const peso =
      relacao === "exato"
        ? 0
        : relacao === "abrange"
          ? digitos.length - regra.ncm.length
          : 100 + regra.ncm.length - digitos.length;
    achados.push({ regra, peso, indice });
  });

  return achados
    .sort(
      (a, b) =>
        a.peso - b.peso || a.regra.ncm.localeCompare(b.regra.ncm) || a.indice - b.indice,
    )
    .map((achado) => achado.regra);
}

/**
 * Os achados por código na frente, depois os da busca por texto que ainda não
 * apareceram. Nada do que a busca por texto encontrava deixa de aparecer.
 */
export function unirSemRepetir(
  primeiros: RegraTabelaSped[],
  depois: RegraTabelaSped[],
): RegraTabelaSped[] {
  if (primeiros.length === 0) return depois;
  const vistos = new Set(primeiros);
  return [...primeiros, ...depois.filter((regra) => !vistos.has(regra))];
}

/**
 * O resultado final da busca: o da busca por texto, inteiro, precedido das
 * regras que citam o NCM digitado quando o termo é um código.
 */
export function combinarBusca(
  registros: RegraTabelaSped[],
  porTexto: RegraTabelaSped[],
  termo: string,
): RegraTabelaSped[] {
  const digitos = digitosDoNcm(termo);
  return digitos ? unirSemRepetir(regrasDoNcm(registros, digitos), porTexto) : porTexto;
}
