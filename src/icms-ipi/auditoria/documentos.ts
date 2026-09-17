import { campoDe } from "../leiaute/acesso";

import type { EstruturaSped } from "../leitura/parser";

/**
 * De que documento cada linha do arquivo faz parte.
 *
 * O apontamento nasce sabendo a LINHA, que é o que o motor tem em mãos. Só que
 * o número da linha serve para abrir o .txt num editor e não serve para mais
 * nada: quem vai conferir precisa achar a nota no ERP, e para isso o que vale é
 * o NUM_DOC. Um item errado na linha 184.322 não diz nada; o mesmo item na nota
 * 12.345 é uma pergunta que o cliente responde.
 *
 * O índice é montado a partir das notas que o parser já agrupou — cabeçalho,
 * itens, analíticos e demais filhos —, então ele custa uma passagem sobre a
 * estrutura, e não uma segunda leitura do arquivo.
 */
export function indexarDocumentos(estrutura: EstruturaSped): Map<number, string> {
  const porLinha = new Map<number, string>();

  for (const nota of estrutura.notas) {
    const numero = (campoDe("C100", nota.campos, "NUM_DOC") ?? "").trim();
    if (numero === "") continue;

    porLinha.set(nota.nl, numero);
    for (const item of nota.itens) porLinha.set(item.nl, numero);
    for (const analitico of nota.analiticos) porLinha.set(analitico.nl, numero);
    for (const filho of nota.filhos) porLinha.set(filho.nl, numero);
  }

  return porLinha;
}

/**
 * Carimba o número do documento nos achados que têm um.
 *
 * Roda uma vez, no fim do processamento, e sobre a lista JÁ LIMITADA pelos
 * tetos — são no máximo alguns milhares de objetos. Carimbar durante a
 * auditoria obrigaria cada regra a conhecer o índice, e uma regra que
 * esquecesse deixaria o apontamento sem a identificação sem que nada quebrasse.
 *
 * Devolve uma lista nova: `Achado` é somente leitura, e é assim que ele
 * atravessa o `postMessage` sem que ninguém no caminho o altere por engano.
 */
export function identificarDocumentos(estrutura: EstruturaSped): void {
  if (estrutura.achados.length === 0 || estrutura.notas.length === 0) return;

  const porLinha = indexarDocumentos(estrutura);
  if (porLinha.size === 0) return;

  estrutura.achados = estrutura.achados.map((achado) => {
    const documento = porLinha.get(achado.nl);
    return documento === undefined ? achado : { ...achado, documento };
  });
}
