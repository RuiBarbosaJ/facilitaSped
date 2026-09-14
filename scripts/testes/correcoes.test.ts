/**
 * Testes do canal de correção: da proposta ao byte no arquivo.
 *
 * O invariante que manda em todos os outros: com ZERO correções aprovadas, o
 * arquivo regravado é idêntico ao de antes desta funcionalidade existir. É o
 * que o teste de fidelidade já provava, e continua provando — só que agora
 * passando pelo canal novo.
 *
 * Rode com `npm run teste`.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { aplicarCorrecoes, idDaCorrecao, type Correcao } from "../../src/icms-ipi/regravacao/correcoes";
import { recalcularTotalizadores } from "../../src/icms-ipi/regravacao/totalizadores";
import { serializar } from "../../src/icms-ipi/regravacao/serializador";
import type { LinhaSped } from "../../src/icms-ipi/leitura/parser";

const linha = (nl: number, texto: string): LinhaSped => {
  const campos = texto.split("|");
  return { reg: campos[1] ?? "", nl, campos };
};

/** Escrituração mínima, com totalizadores corretos — o QTD_LIN conta o próprio X990. */
const ORIGINAL: LinhaSped[] = [
  linha(1, "|0000|017|0|01012024|31012024|EMPRESA|12345678000199||MA|1|2111300|||A|1|"),
  linha(2, "|0001|0|"),
  linha(3, "|0190|UN|UNIDADE|"),
  linha(4, "|0200|P001|PRODUTO||||UN|00|22011000||||||"),
  linha(5, "|0990|5|"),
  linha(6, "|C001|0|"),
  linha(7, "|C100|0|1|F001|55|00|1|123||01012024|01012024|100,00|0|0,00|0,00|100,00|9|0,00|0,00|0,00|100,00|18,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|"),
  linha(8, "|C170|1|P001||1,000|CX|100,00|0,00|0|000|1102||100,00|18,00|18,00|0,00|0,00|0,00|0|99|||0,00|0,00|01|0,00|0,0000|0,000|0,00|0,00|01|0,00|0,0000|0,000|0,00|0,00|||"),
  linha(9, "|C990|4|"),
  linha(10, "|9001|0|"),
  linha(11, "|9900|0000|1|"),
  linha(12, "|9990|4|"),
  linha(13, "|9999|13|"),
];

const texto = (linhas: readonly LinhaSped[]) => linhas.map(serializar).join("\n");

test("sem correção, a aplicação devolve as mesmas linhas — e o pipeline os mesmos bytes", () => {
  const { linhas, aplicadas, recusadas } = aplicarCorrecoes(ORIGINAL, []);
  assert.deepEqual(linhas, ORIGINAL);
  assert.equal(aplicadas.length, 0);
  assert.equal(recusadas.length, 0);
  // O mesmo caminho que gerarTxt percorre, dos dois lados.
  assert.equal(
    texto(recalcularTotalizadores(linhas)),
    texto(recalcularTotalizadores(ORIGINAL))
  );
});

test("correção de campo troca só o campo pedido, só na cópia", () => {
  const c: Correcao = {
    tipo: "campo", codigo: "T-001", classe: "automatica",
    nl: 8, reg: "C170", campo: "UNID", posicao: 6, de: "CX", para: "UN",
    motivo: "teste",
  };
  const { linhas, aplicadas } = aplicarCorrecoes(ORIGINAL, [c]);

  assert.equal(linhas[7].campos[6], "UN");
  assert.equal(aplicadas.length, 1);
  // O original não foi tocado: a grade continua mostrando o arquivo carregado.
  assert.equal(ORIGINAL[7].campos[6], "CX");
  // E as outras linhas são as MESMAS referências — sem cópia desnecessária.
  assert.equal(linhas[0], ORIGINAL[0]);
  assert.equal(linhas[6], ORIGINAL[6]);
});

test("correção cujo 'de' não confere é recusada, com motivo, e nada é alterado", () => {
  /*
   * A lista foi montada sobre um arquivo; o contador trocou de arquivo. Uma
   * correção velha cairia numa linha que não tem nada a ver com aquilo.
   */
  const c: Correcao = {
    tipo: "campo", codigo: "T-001", classe: "automatica",
    nl: 8, reg: "C170", campo: "UNID", posicao: 6, de: "KG", para: "UN",
    motivo: "teste",
  };
  const { linhas, aplicadas, recusadas } = aplicarCorrecoes(ORIGINAL, [c]);
  assert.equal(aplicadas.length, 0);
  assert.equal(recusadas.length, 1);
  assert.match(recusadas[0].motivo, /não contém/);
  assert.equal(linhas[7].campos[6], "CX");
});

test("correção que aponta para o registro errado é recusada", () => {
  const c: Correcao = {
    tipo: "campo", codigo: "T-001", classe: "automatica",
    nl: 8, reg: "C100", campo: "UNID", posicao: 6, de: "CX", para: "UN",
    motivo: "teste",
  };
  const { recusadas } = aplicarCorrecoes(ORIGINAL, [c]);
  assert.equal(recusadas.length, 1);
  assert.match(recusadas[0].motivo, /é C170, não C100/);
});

test("linha inserida entra depois da linha pedida e os totalizadores a contam", () => {
  /*
   * O caso concreto que este canal existe para resolver: o C170 usa a unidade
   * CX, que não está no 0190. O PVA recusa. Um 0190 novo entra antes do 0990 —
   * ou seja, depois da última linha do bloco 0 antes do fechamento.
   */
  const c: Correcao = {
    tipo: "linha", codigo: "T-002", classe: "sugerida",
    apos: 4, reg: "0190", campos: ["", "0190", "CX", "CAIXA", ""],
    motivo: "teste",
  };
  const { linhas, aplicadas } = aplicarCorrecoes(ORIGINAL, [c]);
  assert.equal(aplicadas.length, 1);
  assert.equal(linhas[4].reg, "0190");
  assert.equal(linhas[4].campos[2], "CX");
  assert.equal(linhas[5].reg, "0990");

  // A ordem do pipeline: totalizadores DEPOIS da inserção contam a linha nova.
  const final = recalcularTotalizadores(linhas);
  const c0990 = final.find((l) => l.reg === "0990")!;
  // 0000, 0001, 0190, 0200, 0190 novo e o próprio 0990: o QTD_LIN conta o fechamento.
  assert.equal(c0990.campos[2], "6", "o bloco 0 ganhou uma linha");
  const c9999 = final[final.length - 1];
  assert.equal(c9999.reg, "9999");
  // O 9999 declara o total de linhas do arquivo, ele incluído.
  assert.equal(Number(c9999.campos[2]), final.length);
});

test("inserção 'depois de' uma linha inexistente é recusada, não perdida em silêncio", () => {
  const c: Correcao = {
    tipo: "linha", codigo: "T-002", classe: "sugerida",
    apos: 999, reg: "0190", campos: ["", "0190", "CX", "CAIXA", ""],
    motivo: "teste",
  };
  const { linhas, recusadas } = aplicarCorrecoes(ORIGINAL, [c]);
  assert.equal(recusadas.length, 1);
  assert.equal(linhas.length, ORIGINAL.length);
});

test("duas correções na mesma linha se acumulam", () => {
  const a: Correcao = { tipo: "campo", codigo: "T-001", classe: "automatica", nl: 8, reg: "C170", campo: "UNID", posicao: 6, de: "CX", para: "UN", motivo: "" };
  const b: Correcao = { tipo: "campo", codigo: "T-003", classe: "automatica", nl: 8, reg: "C170", campo: "IND_MOV", posicao: 9, de: "0", para: "1", motivo: "" };
  const { linhas, aplicadas } = aplicarCorrecoes(ORIGINAL, [a, b]);
  assert.equal(aplicadas.length, 2);
  assert.equal(linhas[7].campos[6], "UN");
  assert.equal(linhas[7].campos[9], "1");
});

test("a identidade da correção é estável e distingue campo de linha", () => {
  const a: Correcao = { tipo: "campo", codigo: "X", classe: "automatica", nl: 8, reg: "C170", campo: "UNID", posicao: 6, de: "", para: "", motivo: "" };
  const b: Correcao = { tipo: "linha", codigo: "X", classe: "sugerida", apos: 8, reg: "0190", campos: [], motivo: "" };
  assert.notEqual(idDaCorrecao(a), idDaCorrecao(b));
  assert.equal(idDaCorrecao(a), idDaCorrecao({ ...a, para: "outro" }));
});
