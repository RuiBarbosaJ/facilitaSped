import { ErroSped } from "./protocolo";

/**
 * Os 27 caracteres em que o Windows-1252 difere do Latin-1, na faixa 0x80–0x9F.
 * Fora deles, ASCII e Latin-1 mapeiam 1:1 e não precisam de tabela.
 *
 * A tabela é constante de módulo: estava sendo reconstruída a cada caractere
 * não-ASCII do arquivo, ou seja, milhões de vezes numa exportação.
 */
const ESPECIAIS_CP1252: ReadonlyMap<number, number> = new Map([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84],
  [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
  [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93],
  [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
  [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f],
]);

/** Formata o ponto de código para a mensagem de erro sem expor o texto ao redor. */
function comoUnicode(codigo: number): string {
  return `U+${codigo.toString(16).toUpperCase().padStart(4, "0")}`;
}

/**
 * Codifica em Windows-1252, que é o charset em que o SPED é entregue.
 *
 * A API nativa `TextEncoder` só sabe UTF-8, e gravar UTF-8 num arquivo que o
 * PVA espera em Windows-1252 corrompe todo acento.
 */
export function encodeCP1252(texto: string): Uint8Array {
  const saida = new Uint8Array(texto.length);

  for (let i = 0; i < texto.length; i++) {
    const codigo = texto.charCodeAt(i);

    if (codigo <= 0x7f || (codigo >= 0xa0 && codigo <= 0xff)) {
      saida[i] = codigo;
      continue;
    }

    const especial = ESPECIAIS_CP1252.get(codigo);
    if (especial !== undefined) {
      saida[i] = especial;
      continue;
    }

    if (codigo <= 0xff) {
      saida[i] = codigo; // Caracteres de controle C0/C1.
      continue;
    }

    // Inclui emoji e demais planos altos, que chegam aqui como metade de um par
    // substituto: não existem em Windows-1252 e não podem ir para o arquivo.
    throw new ErroSped(
      "ENCODING",
      `O arquivo contém um caractere que não existe em Windows-1252 (${comoUnicode(codigo)}) e por isso não pode ser regravado no charset do SPED.`
    );
  }

  return saida;
}
