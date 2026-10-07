import { digitosDoNcm } from "./buscar";
import { parentesco } from "./ncm";

/**
 * Por que a linha apareceu.
 *
 * Numa descrição de seis linhas, achar "trigo" sem marca nenhuma é ler tudo de
 * novo; numa regra que cita vinte e sete NCMs, o que casou com a busca ficava
 * escondido atrás do "+21". Nada aqui decide o que entra no resultado — só
 * marca, no que já entrou, o pedaço que casou.
 */

/** As letras que a Receita acentua; cada uma casa com as suas variantes. */
const VARIANTES: Record<string, string> = {
  a: "aáàâãä",
  e: "eéèêë",
  i: "iíìîï",
  o: "oóòôõö",
  u: "uúùûü",
  c: "cç",
  n: "nñ",
};

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** "acucar" → `a[cç][uú…]car`, que casa com "Açúcar" no texto original. */
function padraoDaPalavra(palavra: string): string {
  return [...semAcento(palavra.toLowerCase())]
    .map((letra) =>
      VARIANTES[letra] ? `[${VARIANTES[letra]}]` : letra.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&"),
    )
    .join("");
}

export interface Trecho {
  texto: string;
  destaque: boolean;
}

/**
 * Parte a descrição nos pedaços que casam com a busca.
 *
 * A frase inteira vem antes das palavras soltas, e palavra de menos de três
 * letras não marca: "de" e "da" acenderiam a descrição inteira.
 */
export function dividirPorDestaque(texto: string, termo: string): Trecho[] {
  const limpo = termo.trim().replace(/\s+/g, " ");
  const palavras = limpo.split(" ").filter((palavra) => palavra.length >= 3);
  const alternativas = limpo.includes(" ") ? [limpo, ...palavras] : palavras;
  if (!texto || alternativas.length === 0) return [{ texto, destaque: false }];

  const padrao = new RegExp(
    `(${alternativas
      .sort((a, b) => b.length - a.length)
      .map((palavra) => padraoDaPalavra(palavra).replace(/ /g, "\\s+"))
      .join("|")})`,
    "giu",
  );

  // Com um único grupo de captura, o `split` intercala: índice ímpar é o que
  // casou, par é o texto entre um achado e outro.
  return texto
    .split(padrao)
    .map((parte, i) => ({ texto: parte, destaque: i % 2 === 1 }))
    .filter((trecho) => trecho.texto !== "");
}

/**
 * Quais NCMs de uma regra respondem à busca: o próprio código digitado, a
 * posição ou o capítulo que o abrangem e os códigos que o detalham.
 */
export function ncmsDestacados(ncms: string[], termo: string): Set<string> {
  const digitos = digitosDoNcm(termo);
  if (!digitos) return new Set();
  return new Set(ncms.filter((ncm) => parentesco(ncm, digitos) !== null));
}
