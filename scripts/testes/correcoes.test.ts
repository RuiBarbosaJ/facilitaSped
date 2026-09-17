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
import {
  finalizarParse,
  novaEstrutura,
  processarLinha,
  type LinhaSped,
} from "../../src/icms-ipi/leitura/parser";
import { rodarMotor, rodarValidacoes } from "../../src/icms-ipi/auditoria/motor";
import { proporCorrecoes } from "../../src/icms-ipi/regravacao/propostas";
import { encodeCP1252 } from "../../src/icms-ipi/leitura/encoder";
import { detectarEncoding, lerLinhas } from "../../src/icms-ipi/leitura/leitor";

/** Lê linhas de texto como o worker leria o arquivo. */
async function ler(linhasDoArquivo: string[]) {
  const bytes = encodeCP1252(linhasDoArquivo.join("\r\n") + "\r\n");
  const estrutura = novaEstrutura();
  const encoding = await detectarEncoding(bytes.subarray(0, 64));
  let nl = 0;
  for await (const texto of lerLinhas(new Blob([bytes as BlobPart]), encoding)) {
    processarLinha(texto, ++nl, estrutura);
  }
  finalizarParse(estrutura);
  return estrutura;
}

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

/* ──────── o leiaute sobrevive às correções aprovadas (o PVA confere) ─────── */

/**
 * O arquivo gerado vai ao PVA, que REJEITA mudança de estrutura. Estes testes
 * travam os invariantes que o contador não tem como conferir a olho num arquivo
 * de meio milhão de linhas: mesma quantidade de linhas, mesma quantidade de
 * campos em cada uma, mesma ordem dos registros — e, fora o que ele aprovou,
 * nenhum campo tocado.
 *
 * Corre o pipeline INTEIRO do worker (aplicar → totalizadores → serializar),
 * com TODAS as propostas aprovadas, que é o caso de maior exposição.
 */
const SEM_DELIMITADOR = "|0190|UN|UNIDADE";

async function gerarComTudoAprovado(linhasDoArquivo: string[]) {
  const estrutura = await ler(linhasDoArquivo);
  rodarMotor(estrutura);
  rodarValidacoes(estrutura);
  const propostas = proporCorrecoes(estrutura);

  const antes = estrutura.linhas.map((l) => [...l.campos]);
  const aplicacao = aplicarCorrecoes(estrutura.linhas, propostas);
  const depois = recalcularTotalizadores(aplicacao.linhas);

  return { antes, depois, propostas, recusadas: aplicacao.recusadas };
}

/** Escrituração com um defeito de cada família que hoje rende proposta. */
const COM_DEFEITOS = [
  "|0000|017|0|01012024|31012024|EMPRESA|12345678000199||MA|1234567||2111300|||A|1|",
  "|0001|0|",
  SEM_DELIMITADOR, // EST-023: falta o "|" final
  "|0200|P001|PRODUTO|||UN|00|12345678||||0,00|",
  "|0990|9|", // EST-040: o total está errado de propósito
  "|C001|0|",
  "|C100|0|1|F001|55|00|1|123|35240112345678000199550010000001231000001231|01012024|01012024|100,00|0|0,00|0,00|100,00|9|0,00|0,00|0,00|100,00|18,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|",
  // FIS-C170-010: base e alíquota presentes, imposto zerado
  "|C170|1|P001||1,000|UN|100,00|0,00|0|000|1102||100,00|18,00|0,00|0,00|0,00|0,00|0|99|||0,00|0,00|0,00|01|0,00|0,0000|0,000|0,00|0,00|01|0,00|0,0000|0,000|0,00|0,00||",
  "|C190|000|1102|18,00|100,00|100,00|18,00|0,00|0,00|0,00|||",
  "|C990|4|",
  "|9001|0|",
  "|9900|0000|1|",
  "|9990|3|",
  "|9999|14|",
];

/**
 * O bloco 9 é REFEITO em toda exportação, com ou sem correção.
 *
 * Não é efeito das correções: o leiaute exige um 9900 por registro distinto
 * presente no arquivo, e `recalcularTotalizadores` reconstrói o bloco inteiro
 * para que a contagem feche. Um arquivo cujo bloco 9 chegou incompleto sai com
 * mais linhas do que entrou — e é assim que o PVA quer.
 *
 * Por isso os invariantes de estrutura valem sobre os blocos de DADOS, que são
 * os que a correção toca.
 */
const eBloco9 = (reg: string) => reg.startsWith("9");

test("os registros de dados continuam os mesmos, na mesma ordem", async () => {
  const { antes, depois, propostas } = await gerarComTudoAprovado(COM_DEFEITOS);

  assert.ok(propostas.length > 0, "o teste não vale nada sem correções para aplicar");

  const dadosAntes = antes.map((c) => c[1] ?? "").filter((reg) => !eBloco9(reg));
  const dadosDepois = depois.map((l) => l.reg).filter((reg) => !eBloco9(reg));

  assert.deepEqual(dadosDepois, dadosAntes, "nenhum registro de dados entrou, saiu ou trocou de lugar");
});

test("o bloco 9 é reconstruído — e isso não depende de haver correção", async () => {
  /*
   * Trava a fronteira: se um dia uma correção passar a inserir ou remover linha
   * de dados, o teste acima quebra; este aqui garante que o bloco 9 continua
   * sendo assunto do totalizador, e não da correção.
   */
  const semDefeito = COM_DEFEITOS.map((l) => (l === SEM_DELIMITADOR ? `${SEM_DELIMITADOR}|` : l));
  const { antes, depois } = await gerarComTudoAprovado(semDefeito);

  const noveAntes = antes.filter((c) => eBloco9(c[1] ?? "")).length;
  const noveDepois = depois.filter((l) => eBloco9(l.reg)).length;

  assert.ok(noveDepois >= noveAntes, "o bloco 9 é refeito para listar todos os registros");
});

test("a quantidade de campos de cada linha é preservada — salvo o delimitador que faltava", async () => {
  /*
   * É o invariante que o PVA confere primeiro: um "|" a mais ou a menos numa
   * linha e ele rejeita o arquivo inteiro. A ÚNICA exceção é deliberada — a
   * linha que chegou sem o delimitador final ganha o que lhe faltava, que é o
   * conserto pedido.
   */
  const { antes, depois } = await gerarComTudoAprovado(COM_DEFEITOS);

  const dadosAntes = antes.filter((c) => !eBloco9(c[1] ?? ""));
  const dadosDepois = depois.filter((l) => !eBloco9(l.reg));

  for (let i = 0; i < dadosAntes.length; i++) {
    const original = dadosAntes[i];
    const gerada = dadosDepois[i].campos;
    const consertouODelimitador = original.join("|") === SEM_DELIMITADOR;

    assert.equal(
      gerada.length,
      original.length + (consertouODelimitador ? 1 : 0),
      `linha ${i + 1} (${original[1]}) mudou de quantidade de campos`
    );
  }
});

test("nenhum campo muda além dos aprovados, dos totalizadores e do delimitador", async () => {
  const { antes, depois, propostas } = await gerarComTudoAprovado(COM_DEFEITOS);

  /** `nl|posicao` de tudo o que tinha licença para mudar. */
  const autorizados = new Set<string>();
  for (const c of propostas) {
    if (c.tipo === "campo") autorizados.add(`${c.nl}|${c.posicao}`);
  }

  const dadosAntes = antes.filter((c) => !eBloco9(c[1] ?? ""));
  const dadosDepois = depois.filter((l) => !eBloco9(l.reg));

  const alteradosSemLicenca: string[] = [];
  for (let i = 0; i < dadosAntes.length; i++) {
    const original = dadosAntes[i];
    const gerada = dadosDepois[i].campos;
    const reg = original[1] ?? "";
    // O QTD_LIN dos fechamentos e o bloco 9 são refeitos em toda exportação.
    const eTotalizador = /^(9999|[0-9A-K]990|9900|9001)$/.test(reg);

    for (let p = 0; p < Math.max(original.length, gerada.length); p++) {
      if ((original[p] ?? "") === (gerada[p] ?? "")) continue;
      if (eTotalizador) continue;
      if (autorizados.has(`${dadosDepois[i].nl}|${p}`)) continue;
      alteradosSemLicenca.push(`linha ${i + 1} (${reg}), campo ${p}: "${original[p]}" → "${gerada[p]}"`);
    }
  }

  assert.deepEqual(alteradosSemLicenca, [], "campo alterado sem correção aprovada que o autorize");
});

test("nenhuma correção aprovada é recusada na hora de gerar", async () => {
  /*
   * A recusa é a proteção contra correção velha, e ela é correta — mas se
   * dispara sobre uma proposta que a própria auditoria acabou de montar, o
   * contador aprova na tela e o conserto não entra no arquivo, em silêncio.
   */
  const { recusadas } = await gerarComTudoAprovado(COM_DEFEITOS);
  assert.deepEqual(
    recusadas.map((r) => `${r.correcao.codigo}: ${r.motivo}`),
    []
  );
});

test("o valor gravado é exatamente o que a proposta prometeu na tela", async () => {
  const { depois, propostas } = await gerarComTudoAprovado(COM_DEFEITOS);
  const porNl = new Map(depois.map((l) => [l.nl, l.campos]));

  for (const c of propostas) {
    if (c.tipo !== "campo") continue;
    assert.equal(
      porNl.get(c.nl)?.[c.posicao],
      c.para,
      `${c.codigo} prometeu "${c.para}" em ${c.reg}.${c.campo} e gravou outra coisa`
    );
  }
});

/* ─────────── linha truncada: o conserto não pode piorar o arquivo ────────── */

/**
 * Um C100 cortado pelo ERP logo depois do VL_DOC — bem formado (termina em
 * "|"), só curto. O EST-020 aponta a truncagem e promete "a linha foi
 * preservada como veio".
 */
const TRUNCADO = [
  "|0000|017|0|01012024|31012024|EMPRESA|12345678000199||MA|1234567||2111300|||A|1|",
  "|0001|0|",
  "|0190|UN|UNIDADE|",
  "|0200|P001|PRODUTO|||UN|00|12345678||||0,00|",
  "|0990|5|",
  "|C001|0|",
  "|C100|0|1|F001|55|00|1|123|35240112345678000199550010000001231000001231|01012024|01012024|100,00|",
  "|C190|000|1102|18,00|100,00|100,00|18,00|0,00|0,00|0,00|||",
  "|C990|3|",
  "|9001|0|",
  "|9900|0000|1|",
  "|9990|3|",
  "|9999|13|",
];

test("campo que a linha truncada NÃO tem não vira proposta", async () => {
  /*
   * Campo ausente não é campo vazio. Lido com `?? ""` ele se disfarça de branco,
   * e a correção resultante alonga o array deixando buracos — que o join("|")
   * transforma em "|" a mais. Medido antes da guarda: 14 campos viraram 23, e a
   * linha perdeu o delimitador final.
   */
  const estrutura = await ler(TRUNCADO);
  rodarMotor(estrutura);
  rodarValidacoes(estrutura);
  const propostas = proporCorrecoes(estrutura);

  const noC100 = propostas.filter((c) => c.tipo === "campo" && c.reg === "C100");
  assert.deepEqual(noC100, [], "nenhuma proposta para campo que a linha não possui");

  assert.ok(
    estrutura.achados.some((a) => a.codigo === "EST-020"),
    "a truncagem continua sendo apontada — o conserto dela é na origem"
  );
});

test("a linha truncada sai da regravação exatamente como entrou", async () => {
  const estrutura = await ler(TRUNCADO);
  rodarMotor(estrutura);
  rodarValidacoes(estrutura);
  const propostas = proporCorrecoes(estrutura);

  const antes = estrutura.linhas.find((l) => l.reg === "C100")!;
  const original = serializar(antes);

  const aplicacao = aplicarCorrecoes(estrutura.linhas, propostas);
  const depois = aplicacao.linhas.find((l) => l.reg === "C100")!;

  assert.equal(serializar(depois), original, "a promessa do EST-020 é cumprida");
  assert.ok(serializar(depois).endsWith("|"), "o delimitador final sobrevive");
});

test("escrita além do fim da linha é recusada, mesmo vinda de correção antiga", async () => {
  /*
   * Defesa em profundidade: a guarda do gerador impede a proposta de nascer,
   * mas uma correção guardada de outra sessão, ou de um arquivo diferente,
   * chega pronta a `aplicarCorrecoes`. Ela não pode confiar em quem a montou.
   */
  const estrutura = await ler(TRUNCADO);
  const c100 = estrutura.linhas.find((l) => l.reg === "C100")!;

  const forjada: Correcao = {
    tipo: "campo",
    codigo: "FIS-C100-012",
    classe: "sugerida",
    nl: c100.nl,
    reg: "C100",
    campo: "VL_ICMS",
    posicao: 22, // a linha truncada tem 14 posições
    de: "",
    para: "18,00",
  motivo: "correção montada sobre um arquivo que tinha o campo",
  };

  const aplicacao = aplicarCorrecoes(estrutura.linhas, [forjada]);

  assert.equal(aplicacao.aplicadas.length, 0);
  assert.equal(aplicacao.recusadas.length, 1);
  assert.match(aplicacao.recusadas[0].motivo, /truncada/);
  assert.equal(
    serializar(aplicacao.linhas.find((l) => l.reg === "C100")!),
    serializar(c100),
    "a linha não foi tocada"
  );
});

test("o acréscimo do delimitador final continua passando — é um campo vazio no fim", async () => {
  /*
   * A guarda nova recusa escrita além do fim, e o conserto do delimitador é
   * exatamente isso: acrescentar UM campo vazio na primeira posição livre. Ele
   * não pula posição nenhuma nem inventa conteúdo, então continua valendo.
   */
  const estrutura = await ler([
    "|0000|017|0|01012024|31012024|EMPRESA|12345678000199||MA|1234567||2111300|||A|1|",
    "|0001|0|",
    "|0190|UN|UNIDADE", // sem o "|" final, com a contagem certa
    "|0990|4|",
  ]);
  rodarMotor(estrutura);
  const propostas = proporCorrecoes(estrutura);

  const aplicacao = aplicarCorrecoes(estrutura.linhas, propostas);
  const linha0190 = aplicacao.linhas.find((l) => l.reg === "0190")!;

  assert.deepEqual(aplicacao.recusadas, []);
  assert.equal(serializar(linha0190), "|0190|UN|UNIDADE|");
});
