/**
 * Testes dos geradores de proposta de correção.
 *
 * Cada gerador tem uma guarda, e a guarda é o que se testa: o caso em que a
 * proposta NÃO deve sair é mais importante que o caso em que sai. Uma proposta
 * automática errada entra no arquivo sem ninguém olhar.
 *
 * Rode com `npm run teste`.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { encodeCP1252 } from "../../src/icms-ipi/leitura/encoder";
import { detectarEncoding, lerLinhas } from "../../src/icms-ipi/leitura/leitor";
import { finalizarParse, novaEstrutura, processarLinha } from "../../src/icms-ipi/leitura/parser";
import { aplicarCorrecoes } from "../../src/icms-ipi/regravacao/correcoes";
import { marcarConsertos, proporCorrecoes, temGeradorDeProposta } from "../../src/icms-ipi/regravacao/propostas";
import { serializar } from "../../src/icms-ipi/regravacao/serializador";
import { rodarMotor, rodarValidacoes } from "../../src/icms-ipi/auditoria/motor";

async function ler(linhas: string[]) {
  const bytes = encodeCP1252(linhas.join("\r\n") + "\r\n");
  const estrutura = novaEstrutura();
  const encoding = await detectarEncoding(bytes.subarray(0, 64));
  let nl = 0;
  for await (const linha of lerLinhas(new Blob([bytes as BlobPart]), encoding)) {
    processarLinha(linha, ++nl, estrutura);
  }
  finalizarParse(estrutura);
  return estrutura;
}

test("linha sem o delimitador final, com todos os campos, ganha proposta automática", async () => {
  // |0190|UN|UNIDADE  ← sem o "|" final, mas com os 2 campos de dados do leiaute
  const estrutura = await ler(["|0000|017|0|01012024|31012024|E|1||MA|1|2111300|||A|1|", "|0190|UN|UNIDADE"]);

  const propostas = proporCorrecoes(estrutura);
  assert.equal(propostas.length, 1);
  const p = propostas[0];
  assert.equal(p.tipo, "campo");
  assert.equal(p.classe, "automatica");
  assert.equal(p.codigo, "EST-023");
  if (p.tipo !== "campo") throw new Error("esperava correção de campo");
  assert.equal(p.nl, 2);

  // Aplicada, a linha volta a terminar em "|" — e só isso muda.
  const { linhas } = aplicarCorrecoes(estrutura.linhas, propostas);
  assert.equal(serializar(linhas[1]), "|0190|UN|UNIDADE|");
});

test("linha sem o delimitador final E com campo a menos NÃO ganha proposta: pode estar truncada", async () => {
  /*
   * |0190|UN  ← faltam o DESCR e o "|" final. Acrescentar o delimitador
   * esconderia a truncagem em vez de consertá-la. O EST-020 aponta; o conserto
   * é na origem.
   */
  const estrutura = await ler(["|0000|017|0|01012024|31012024|E|1||MA|1|2111300|||A|1|", "|0190|UN"]);

  assert.ok(estrutura.achados.some((a) => a.codigo === "EST-023"), "o achado existe");
  assert.ok(estrutura.achados.some((a) => a.codigo === "EST-020"), "e a truncagem também");
  assert.equal(proporCorrecoes(estrutura).length, 0, "mas nenhuma proposta sai");
});

test("registro fora do dicionário sem delimitador final: proposta sai, porque não há leiaute para contradizer", async () => {
  // K200 não está no dicionário — não dá para saber se está truncado; o
  // delimitador ausente é o único fato. Proposta sai, mas o contador vê.
  const estrutura = await ler(["|0000|017|0|01012024|31012024|E|1||MA|1|2111300|||A|1|", "|K200|31012024|P001|1,000"]);
  const propostas = proporCorrecoes(estrutura);
  assert.equal(propostas.length, 1);
});

test("arquivo bem formado não gera proposta nenhuma", async () => {
  const estrutura = await ler([
    "|0000|017|0|01012024|31012024|E|1||MA|1|2111300|||A|1|",
    "|0001|0|",
    "|0190|UN|UNIDADE|",
    "|0990|4|",
  ]);
  assert.equal(proporCorrecoes(estrutura).length, 0);
});

test("a UI sabe para quais códigos existe gerador", () => {
  assert.equal(temGeradorDeProposta("EST-023"), true);
  assert.equal(temGeradorDeProposta("FIS-014"), false);
  // chave herdada do protótipo não é gerador
  assert.equal(temGeradorDeProposta("constructor"), false);
});

test("totalizador de bloco divergente vira proposta automática", async () => {
  /*
   * A regravação já reescreve todo QTD_LIN, com ou sem apontamento. A proposta
   * não muda isso: ela faz o valor aparecer na grade e no relatório, em vez de
   * a tela mostrar um número que o arquivo gerado não vai ter.
   */
  const estrutura = await ler([
    "|0000|017|0|01012024|31012024|E|1||MA|1|2111300|||A|1|",
    "|0001|0|",
    "|0190|UN|UNIDADE|",
    "|0990|9|", // são 4 linhas no bloco 0, não 9
  ]);
  rodarMotor(estrutura);

  const propostas = proporCorrecoes(estrutura);
  const doBloco = propostas.find((p) => p.codigo === "EST-040");

  assert.ok(doBloco, "a proposta existe");
  assert.equal(doBloco.tipo, "campo");
  if (doBloco.tipo !== "campo") return;
  assert.equal(doBloco.campo, "QTD_LIN");
  assert.equal(doBloco.classe, "automatica");
  assert.equal(doBloco.de, "9");
  assert.equal(doBloco.para, "4");
});

test("totalizador correto não gera proposta nenhuma", async () => {
  const estrutura = await ler([
    "|0000|017|0|01012024|31012024|E|1||MA|1|2111300|||A|1|",
    "|0001|0|",
    "|0190|UN|UNIDADE|",
    "|0990|4|",
  ]);
  rodarMotor(estrutura);

  assert.equal(
    proporCorrecoes(estrutura).some((p) => p.codigo === "EST-040"),
    false
  );
});

/* ────────────── o canal de correção das regras fiscais ─────────────────── */

const C100_BASE =
  "|C100|1|1|F001|55|00|1|123|35240112345678000199550010000001231000001231|01012024|01012024|100,00|0|0,00|0,00|100,00|9|0,00|0,00|0,00|100,00|18,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|";

/** Um documento mínimo com UM item, cujos campos de valor o teste escolhe. */
function documento(item: { cst: string; cfop: string; bc: string; aliq: string; icms: string }) {
  return [
    "|0000|017|0|01012024|31012024|EMPRESA|12345678000199||MA|1234567||2111300|||A|1|",
    "|0001|0|",
    "|0190|UN|UNIDADE|",
    "|0200|P001|PRODUTO|||UN|00|12345678||||0,00|",
    "|0990|5|",
    "|C001|0|",
    C100_BASE,
    `|C170|1|P001||1,000|UN|100,00|0,00|0|${item.cst}|${item.cfop}||${item.bc}|${item.aliq}|${item.icms}|0,00|0,00|0,00|0|99|||0,00|0,00|0,00|01|0,00|0,0000|0,000|0,00|0,00|01|0,00|0,0000|0,000|0,00|0,00||`,
    `|C190|${item.cst}|${item.cfop}|${item.aliq}|100,00|${item.bc}|${item.icms}|0,00|0,00|0,00|||`,
    "|C990|4|",
    "|9001|0|",
    "|9900|0000|1|",
    "|9990|3|",
    "|9999|14|",
  ];
}

async function auditar(linhas: string[]) {
  const estrutura = await ler(linhas);
  rodarMotor(estrutura);
  rodarValidacoes(estrutura);
  const propostas = proporCorrecoes(estrutura);
  marcarConsertos(estrutura, propostas);
  return { estrutura, propostas };
}

test("o lado que falta do par base/imposto é calculado e vira proposta", async () => {
  /*
   * A relação é a que o dicionário declara em FIS-C170-013. Com dois dos três
   * termos no arquivo, o terceiro é aritmética — apontar sem oferecê-lo deixava
   * o contador recalculando à mão o que a regra tinha acabado de conferir.
   */
  const { propostas } = await auditar(
    documento({ cst: "000", cfop: "5102", bc: "100,00", aliq: "18,00", icms: "0,00" })
  );

  const doItem = propostas.filter((p) => p.tipo === "campo" && p.reg === "C170");
  assert.equal(doItem.length, 1, "uma proposta para a célula, não uma por regra que a aponta");

  const proposta = doItem[0];
  assert.equal(proposta.tipo, "campo");
  if (proposta.tipo !== "campo") return;
  assert.equal(proposta.campo, "VL_ICMS");
  assert.equal(proposta.para, "18,00");
  assert.equal(proposta.classe, "sugerida", "o valor é dedutível, mas a decisão é do contador");
});

test("com os dois lados zerados não há o que propor — e o achado diz isso", async () => {
  /*
   * A alíquota sozinha não diz o valor da operação, e deduzir a base do VL_ITEM
   * assumiria que não há frete, desconto nem redução. O silêncio precisa ser
   * uma afirmação, não uma omissão.
   */
  const { estrutura, propostas } = await auditar(
    documento({ cst: "000", cfop: "5102", bc: "0,00", aliq: "0,00", icms: "0,00" })
  );

  assert.equal(
    propostas.some((p) => p.tipo === "campo" && p.reg === "C170"),
    false
  );

  const achado = estrutura.achados.find((a) => a.codigo === "FIS-C170-010");
  assert.ok(achado, "o erro continua sendo apontado");
  assert.equal(achado.conserto, "manual");
  assert.match(achado.mensagem, /não tem valor a propor/);
});

test("entrada de uso e consumo recebe a reclassificação inteira do Guia", async () => {
  /*
   * § 5 do Guia: trocar a tributação para 90 preservando a origem E zerar os
   * campos de valor. Meio conserto deixaria a linha num estado que nem o
   * arquivo original tinha.
   */
  const { propostas } = await auditar(
    documento({ cst: "000", cfop: "1556", bc: "100,00", aliq: "18,00", icms: "18,00" })
  );

  const da019 = propostas
    .filter((p) => p.codigo === "FIS-C170-019")
    .filter((p): p is Extract<typeof p, { tipo: "campo" }> => p.tipo === "campo");
  const porCampo = new Map(da019.map((p) => [p.campo, p.para]));

  assert.equal(porCampo.get("CST_ICMS"), "090");
  assert.equal(porCampo.get("VL_BC_ICMS"), "0,00");
  assert.equal(porCampo.get("VL_ICMS"), "0,00");
  assert.ok(
    da019.every((p) => p.classe === "sugerida"),
    "reclassificar é decisão do contador, nunca automática"
  );
});

test("a origem da mercadoria é preservada na reclassificação", async () => {
  const { propostas } = await auditar(
    documento({ cst: "200", cfop: "1556", bc: "100,00", aliq: "18,00", icms: "18,00" })
  );

  const doCst = propostas.find((p) => p.tipo === "campo" && p.campo === "CST_ICMS");
  assert.ok(doCst && doCst.tipo === "campo");
  if (!doCst || doCst.tipo !== "campo") return;
  assert.equal(doCst.para, "290", "origem 2 continua sendo 2");
});

test("total do documento não é proposto quando um item do mesmo documento será mexido", async () => {
  /*
   * As regras de soma calculam o total sobre os itens COMO ESTÃO. Aprovar as
   * duas gravaria o item novo e o total velho, e a nota não fecharia em lugar
   * nenhum — pior do que chegou.
   */
  const { propostas } = await auditar(
    documento({ cst: "000", cfop: "5102", bc: "100,00", aliq: "18,00", icms: "0,00" })
  );

  assert.equal(
    propostas.some((p) => p.tipo === "campo" && (p.reg === "C190" || p.reg === "C100")),
    false,
    "o efeito dominó precisa ser recalculado depois, não proposto sobre dado velho"
  );
});

test("o valor de origem da proposta é o campo CRU, que é o que a aplicação compara", async () => {
  const { estrutura, propostas } = await auditar(
    documento({ cst: "000", cfop: "5102", bc: "100,00", aliq: "18,00", icms: "0,00" })
  );

  const aplicacao = aplicarCorrecoes(estrutura.linhas, propostas);
  assert.deepEqual(aplicacao.recusadas, [], "nenhuma correção pode ser recusada na aplicação");
});
