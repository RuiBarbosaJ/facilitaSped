/**
 * Teste da exportação da consulta.
 *
 * O arquivo exportado vai para a planilha de conferência do analista e é
 * cruzado com os produtos do cliente. Duas coisas não podem falhar em silêncio:
 * a ordem das colunas (que ele vai casar com a planilha dele) e o escape de
 * valor que o Excel interpretaria como fórmula.
 *
 * Rode com `npm run teste`.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { linhasParaExportacao } from "../../src/consulta/exportar";
import { sanitizarCelula } from "../../src/pis-cofins/planilha";
import type { RegraAgrupada } from "../../src/consulta/agrupar";

function regra(dados: Partial<RegraAgrupada>): RegraAgrupada {
  return {
    chave: "x",
    ncms: [],
    descricao: "",
    cst: "",
    aliquota: "",
    natureza_receita: "",
    data_inicio: "",
    data_fim: "",
    tabela: "",
    ...dados,
  } as RegraAgrupada;
}

test("a exportação abre com o cabeçalho e uma linha por regra", () => {
  const linhas = linhasParaExportacao([
    regra({ ncms: ["04012010"], descricao: "Leite", cst: "06", natureza_receita: "110" }),
    regra({ ncms: ["27101259"], descricao: "Gasolina", cst: "04" }),
  ]);

  assert.equal(linhas.length, 3, "cabeçalho mais duas regras");
  assert.deepEqual(linhas[0], [
    "NCM",
    "Descrição",
    "CST",
    "Alíquota",
    "Natureza da receita",
    "Início da vigência",
    "Fim da vigência",
    "Tabela",
  ]);
  assert.deepEqual(linhas[1], ["04012010", "Leite", "06", "", "110", "", "", ""]);
});

test("os NCMs de uma regra vão numa célula só", () => {
  /*
   * Uma linha por NCM desfaria o agrupamento que a tela mostra e inflaria o
   * arquivo — a regra do capítulo 02 tem dezenas de posições.
   */
  const [, linha] = linhasParaExportacao([regra({ ncms: ["0201", "0202", "0203"] })]);
  assert.equal(linha[0], "0201 0202 0203");
});

test("texto que começa com sinal de igual é neutralizado antes do Excel", () => {
  /*
   * A descrição vem da Receita e não é confiável como conteúdo de célula: um
   * valor iniciado por = , + ou - é FÓRMULA para o Excel, e abrir a planilha
   * executaria o que estivesse ali.
   */
  const [, linha] = linhasParaExportacao([regra({ descricao: "=SOMA(A1:A9)" })]);
  assert.equal(sanitizarCelula(linha[1]), "'=SOMA(A1:A9)");
});

test("campo ausente vira célula vazia, nunca 'undefined'", () => {
  const [, linha] = linhasParaExportacao([regra({ cst: undefined, aliquota: undefined })]);
  assert.equal(linha[2], "");
  assert.equal(linha[3], "");
});
