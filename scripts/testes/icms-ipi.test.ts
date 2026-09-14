/**
 * Testes do módulo SPED — seção 14 do plano de implementação.
 *
 * O primeiro deles é o que sustenta todos os outros: ler um arquivo e regravá-lo
 * sem correção tem de devolver os mesmos bytes. Se esse falha, nada mais no
 * módulo é confiável, porque significa que o parser perdeu campo, trocou
 * posição ou corrompeu acento.
 *
 * Rode com `npm run teste`.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { encodeCP1252 } from "../../src/icms-ipi/leitura/encoder";
import { detectarEncoding, detectarFimDeLinha, lerLinhas } from "../../src/icms-ipi/leitura/leitor";
import {
  achadosOmitidos,
  finalizarParse,
  novaEstrutura,
  processarLinha,
  registrarAchado,
  type EstruturaSped,
} from "../../src/icms-ipi/leitura/parser";
import { LEIAUTE_CONFERIDO } from "../../src/icms-ipi/leiaute/versao";
import { serializar } from "../../src/icms-ipi/regravacao/serializador";
import { recalcularTotalizadores } from "../../src/icms-ipi/regravacao/totalizadores";
import { rodarMotor } from "../../src/icms-ipi/auditoria/motor";
import { LIMITES } from "../../src/icms-ipi/limites";

const CRLF = "\r\n";

/**
 * Escrituração mínima, completa e com os totalizadores CORRETOS, com acentuação
 * para exercitar o Windows-1252. As contagens abaixo foram conferidas à mão
 * contra o Guia Prático — é justamente o que o teste de fidelidade verifica.
 *
 * Bloco 0: 6 linhas · Bloco C: 5 · Bloco E: 4
 * Registros distintos fora do bloco 9: 16 → 19 registros 9900
 * Bloco 9: 9001 + 19×9900 + 9990 + 9999 = 22 · Arquivo: 37 linhas
 */
/*
 * Escrituração 100% sintética — nenhum dado de contribuinte real.
 *
 * Os CNPJs têm dígito verificador PROPOSITALMENTE inválido (12345678/0001
 * fecha em 95, não em 99), então não existe empresa por trás deles. Se um dia
 * for preciso um caso novo, invente outro CNPJ inválido: NUNCA cole aqui um
 * trecho de arquivo de cliente, nem "só para reproduzir o bug". O fixture é
 * público, vai para o git e fica na história para sempre.
 */
const LINHAS_VALIDAS = [
  "|0000|017|0|01012024|31012024|COMÉRCIO DE ALIMENTAÇÃO LTDA|12345678000199||MA|123456789|2111300|||A|1|",
  "|0001|0|",
  "|0150|F001|FORNECEDOR SÃO JOÃO LTDA|1058|98765432000188||1234567|2111300||RUA DAS FLÔRES|10||CENTRO|",
  "|0190|UN|UNIDADE|",
  "|0200|P001|ÁGUA MINERAL 500ML|||UN|00|22011000||||||",
  "|0990|6|",
  "|C001|0|",
  "|C100|0|1|F001|55|00|1|123|35240112345678000199550010000001231000001231|01012024|01012024|100,00|0|0,00|0,00|100,00|9|0,00|0,00|0,00|100,00|18,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|",
  "|C170|1|P001||1,000|UN|100,00|0,00|0|000|1102||100,00|18,00|18,00|0,00|0,00|0,00|0|99|||0,00|0,00|0,00|01|0,00|0,0000|0,000|0,00|0,00|01|0,00|0,0000|0,000|0,00|0,00||",
  "|C190|000|1102|18,00|100,00|100,00|18,00|0,00|0,00|0,00|||",
  "|C990|5|",
  "|E001|0|",
  "|E100|01012024|31012024|",
  "|E110|18,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|18,00|0,00|18,00|0,00|0,00|",
  "|E990|4|",
  "|9001|0|",
  "|9900|0000|1|",
  "|9900|0001|1|",
  "|9900|0150|1|",
  "|9900|0190|1|",
  "|9900|0200|1|",
  "|9900|0990|1|",
  "|9900|C001|1|",
  "|9900|C100|1|",
  "|9900|C170|1|",
  "|9900|C190|1|",
  "|9900|C990|1|",
  "|9900|E001|1|",
  "|9900|E100|1|",
  "|9900|E110|1|",
  "|9900|E990|1|",
  "|9900|9001|1|",
  "|9900|9900|19|",
  "|9900|9990|1|",
  "|9900|9999|1|",
  "|9990|22|",
  "|9999|37|",
];

function conteudo(linhas: readonly string[]): string {
  return linhas.join(CRLF) + CRLF;
}

/** Lê o arquivo pelo mesmo caminho da produção: bytes → stream → linhas. */
async function lerTudo(bytes: Uint8Array) {
  const arquivo = new Blob([bytes as BlobPart]);
  const amostra = new Uint8Array(await arquivo.slice(0, 4096).arrayBuffer());
  const encoding = await detectarEncoding(amostra);

  const estrutura = novaEstrutura();
  estrutura.encoding = encoding;
  estrutura.fimDeLinha = detectarFimDeLinha(amostra);
  estrutura.temBom = amostra[0] === 0xef && amostra[1] === 0xbb && amostra[2] === 0xbf;
  estrutura.terminaComQuebra = bytes[bytes.length - 1] === 0x0a;

  const blocos: Uint8Array[] = [];
  let nl = 0;
  for await (const linha of lerLinhas(arquivo, encoding, {
    aoLerBytes: (bloco) => blocos.push(bloco.slice()),
  })) {
    processarLinha(linha, ++nl, estrutura);
  }
  finalizarParse(estrutura);

  const bytesLidos = new Uint8Array(blocos.reduce((soma, b) => soma + b.length, 0));
  let posicao = 0;
  for (const bloco of blocos) {
    bytesLidos.set(bloco, posicao);
    posicao += bloco.length;
  }

  return { estrutura, encoding, bytesLidos };
}

/** Espelha a conferência que o worker faz ao terminar o parse. */
function conferirVersao(estrutura: EstruturaSped): void {
  const declarada = estrutura.cabecalho?.campos[2] ?? "";
  if (!declarada || declarada === LEIAUTE_CONFERIDO) return;
  registrarAchado(estrutura, {
    id: `EST-002:0:${declarada}`,
    codigo: "EST-002",
    severidade: "alerta",
    nl: estrutura.cabecalho?.nl ?? 0,
    reg: "0000",
    campo: "COD_VER",
    mensagem: `Versão de leiaute ${declarada} diferente da conferida (${LEIAUTE_CONFERIDO}).`,
    corrigivel: false,
    regra: "Ato COTEPE/ICMS",
  });
}

function regravar(estrutura: EstruturaSped): Uint8Array {
  const corpo = recalcularTotalizadores(estrutura.linhas).map(serializar).join(estrutura.fimDeLinha);
  const texto =
    (estrutura.temBom ? "\uFEFF" : "") +
    corpo +
    (estrutura.terminaComQuebra ? estrutura.fimDeLinha : "");
  return estrutura.encoding === "utf-8" ? new TextEncoder().encode(texto) : encodeCP1252(texto);
}

test("o arquivo de referência está no formato do layout (sem campo faltando nem sobrando)", async () => {
  const { estrutura } = await lerTudo(encodeCP1252(conteudo(LINHAS_VALIDAS)));

  const estruturais = estrutura.achados.filter((a) =>
    ["EST-020", "EST-021", "EST-023"].includes(a.codigo)
  );
  assert.deepEqual(
    estruturais.map((a) => `${a.codigo} L${a.nl} ${a.reg}`),
    [],
    "o fixture precisa bater com o layout, senão o teste de fidelidade valida a si mesmo"
  );
});

test("fidelidade: ler e regravar sem correção devolve os mesmos bytes (§14.1)", async () => {
  const original = encodeCP1252(conteudo(LINHAS_VALIDAS));
  const { estrutura } = await lerTudo(original);

  assert.equal(estrutura.linhas.length, 37);
  assert.deepEqual(regravar(estrutura), original);
});

test("encoding: acentuação em Windows-1252 sobrevive à ida e à volta (§14.2)", async () => {
  const bytes = encodeCP1252(conteudo(LINHAS_VALIDAS));
  const { estrutura, encoding } = await lerTudo(bytes);

  assert.equal(encoding, "windows-1252");
  assert.equal(estrutura.cabecalho?.campos[6], "COMÉRCIO DE ALIMENTAÇÃO LTDA");
  assert.match(estrutura.participantes.get("F001")?.campos[3] ?? "", /SÃO JOÃO/);
});

test("o SHA-256 calculado é o do arquivo, não o do texto decodificado", async () => {
  const bytes = encodeCP1252(conteudo(LINHAS_VALIDAS));
  const { bytesLidos } = await lerTudo(bytes);

  // O leitor precisa entregar ao hasher exatamente os bytes do disco: hashear a
  // string decodificada dava um hash que nunca bate com `sha256sum`.
  assert.deepEqual(bytesLidos, bytes);
  assert.equal(
    createHash("sha256").update(bytesLidos).digest("hex"),
    createHash("sha256").update(bytes).digest("hex")
  );
});

test("totalizadores corrompidos de propósito são detectados e corrigidos (§14.2)", async () => {
  const corrompido = LINHAS_VALIDAS.map((l) =>
    l.startsWith("|0990|") ? "|0990|99|" : l.startsWith("|C990|") ? "|C990|1|" : l
  );

  const { estrutura } = await lerTudo(encodeCP1252(conteudo(corrompido)));
  rodarMotor(estrutura);

  const divergencias = estrutura.achados.filter((a) => a.codigo === "EST-040");
  assert.equal(divergencias.length, 2, "os dois fechamentos adulterados precisam ser apontados");
  assert.ok(divergencias.every((a) => a.corrigivel));

  // E a regravação devolve o arquivo já consertado, igual ao original íntegro.
  assert.deepEqual(regravar(estrutura), encodeCP1252(conteudo(LINHAS_VALIDAS)));
});

test("registro com nome herdado de Object não derruba o parse (§13.3)", async () => {
  for (const hostil of ["constructor", "__proto__", "toString", "valueOf"]) {
    const linhas = [...LINHAS_VALIDAS];
    linhas.splice(6, 0, `|${hostil}|x|`);

    const { estrutura } = await lerTudo(encodeCP1252(conteudo(linhas)));
    assert.equal(estrutura.linhas.length, 38, `a linha |${hostil}| deve ser lida como qualquer outra`);
    assert.equal(
      ({} as Record<string, unknown>).poluido,
      undefined,
      "nenhuma chave do arquivo pode alcançar o protótipo"
    );
  }
});

test("linha sem o delimitador final é apontada, mas volta idêntica na regravação", async () => {
  const linhas = LINHAS_VALIDAS.map((l) => (l.startsWith("|0190|") ? "|0190|UN|UNIDADE" : l));
  const original = encodeCP1252(conteudo(linhas));
  const { estrutura } = await lerTudo(original);

  const unidade = estrutura.unidades.get("UN");
  assert.equal(unidade?.campos[2], "UN");
  assert.equal(unidade?.campos[3], "UNIDADE", "o campo não pode escorregar de posição");
  assert.ok(estrutura.achados.some((a) => a.codigo === "EST-023"));

  // O apontamento não autoriza reescrever a linha do contribuinte.
  assert.deepEqual(regravar(estrutura), original);
});

test("registro com menos campos que o dicionário é apontado sem ser alterado", async () => {
  // Simula um arquivo de uma versão de leiaute que este dicionário não conhece.
  const linhas = LINHAS_VALIDAS.map((l) => (l.startsWith("|0200|") ? "|0200|P001|ÁGUA MINERAL 500ML|" : l));
  const original = encodeCP1252(conteudo(linhas));
  const { estrutura } = await lerTudo(original);

  assert.ok(estrutura.achados.some((a) => a.codigo === "EST-020" && a.reg === "0200"));
  assert.deepEqual(
    regravar(estrutura),
    original,
    "um dicionário defasado não pode reescrever linhas de um arquivo válido"
  );
});

test("C170 sem C100 pai é apontado como órfão", async () => {
  const linhas = LINHAS_VALIDAS.filter((l) => !l.startsWith("|C100|"));
  const { estrutura } = await lerTudo(encodeCP1252(conteudo(linhas)));

  assert.ok(estrutura.achados.some((a) => a.codigo === "EST-010" && a.reg === "C170"));
});

test("registro fora do dicionário vira UM apontamento de escopo, não um por linha nem por código", async () => {
  /*
   * São dois exageros a evitar, e o segundo só aparece em arquivo real. Um
   * apontamento por LINHA transforma 5.000 K200 em 5.000 avisos. Um por
   * CÓDIGO parece razoável até a escrituração de indústria chegar com os
   * blocos D, G, H, K e 1: passam de cento e quarenta registros fora do
   * dicionário, e o contador abre a aba com 144 "apontamentos" que não são
   * problema nenhum do arquivo dele — enterrando os poucos achados fiscais de
   * verdade. O escopo da ferramenta cabe em uma linha.
   */
  const extras = Array.from({ length: 5_000 }, () => "|K200|31012024|P001|1,000|||");
  const outros = ["|K001|0|", "|K100|01012024|31012024|", "|K990|3|"];
  const linhas = [...LINHAS_VALIDAS.slice(0, 15), ...extras, ...outros, ...LINHAS_VALIDAS.slice(15)];

  const { estrutura } = await lerTudo(encodeCP1252(conteudo(linhas)));

  const escopo = estrutura.achados.filter((a) => a.codigo === "EST-022");
  assert.equal(escopo.length, 1, "o escopo não coberto precisa caber em um único apontamento");
  // A contagem de linhas preservadas continua visível: é o dado que importa.
  assert.match(escopo[0].mensagem, /5\.\d{3} linhas/);
  // E os registros envolvidos também, para o contador saber o que não foi conferido.
  assert.match(escopo[0].mensagem, /K200/);
});

test("o teto por código impede que um arquivo hostil encha a memória de apontamentos", async () => {
  const orfaos = Array.from({ length: LIMITES.ACHADOS_POR_CODIGO + 250 }, () => "|C170|1|P001||1,000|UN|");
  const linhas = [...LINHAS_VALIDAS.slice(0, 6), ...orfaos, ...LINHAS_VALIDAS.slice(6)];

  const { estrutura } = await lerTudo(encodeCP1252(conteudo(linhas)));

  const emitidos = estrutura.achados.filter((a) => a.codigo === "EST-010").length;
  assert.equal(emitidos, LIMITES.ACHADOS_POR_CODIGO);
  assert.ok(achadosOmitidos(estrutura) >= 250);
});

test("caractere fora do Windows-1252 é recusado com erro próprio, não com corrupção silenciosa", () => {
  assert.throws(() => encodeCP1252("PRODUTO 😀"), /ENCODING|Windows-1252/);
});

test("todo achado tem identidade única (a lista usa o id como chave de render)", async () => {
  /*
   * Id repetido faz o React renderizar um apontamento no lugar de vários — o
   * contador simplesmente não vê parte do que a auditoria encontrou.
   *
   * O cenário mistura de propósito achados de origens diferentes: um bloco D
   * fora do dicionário (escopo, sem número de linha), itens órfãos (por linha)
   * e linha sem delimitador final (por linha, em registro desconhecido).
   */
  const linhas = [...LINHAS_VALIDAS];
  linhas.splice(6, 0, "|D001|0|", "|D100|0|1|T1|57|00|1|1|", "|D990|3|");
  // Sem o pipe final, e em registro que o dicionário não conhece: desde que a
  // conferência de delimitador passou a rodar antes do dicionário, isto aponta.
  linhas.splice(6, 0, "|D110|1|2");
  // Dois itens sem C100 pai, para garantir mais de um achado do mesmo código.
  linhas.splice(6, 0, "|C170|1|P001||1,000|UN|", "|C170|2|P002||1,000|UN|");

  const { estrutura } = await lerTudo(encodeCP1252(conteudo(linhas)));
  rodarMotor(estrutura);

  const ids = estrutura.achados.map((a) => a.id);
  assert.ok(estrutura.achados.length > 1, `esperava vários achados, veio ${estrutura.achados.length}`);
  assert.equal(new Set(ids).size, ids.length, `ids repetidos: ${ids.join(", ")}`);
});

test("linha sem delimitador final é apontada mesmo em registro fora do dicionário", async () => {
  /*
   * A checagem mais barata e mais objetiva da aba — "o PVA vai recusar esta
   * linha" — dependia do dicionário e por isso só valia para os 11 registros
   * conhecidos. Num arquivo de indústria, onde a maioria dos registros está
   * fora, o arquivo era aprovado na tela e reprovado no PVA.
   */
  const linhas = [...LINHAS_VALIDAS];
  linhas.splice(6, 0, "|D001|0|", "|D100|0|1|T1|57|00|1|1", "|D990|3|");

  const { estrutura } = await lerTudo(encodeCP1252(conteudo(linhas)));

  const semDelimitador = estrutura.achados.filter((a) => a.codigo === "EST-023");
  assert.equal(semDelimitador.length, 1);
  assert.equal(semDelimitador[0].reg, "D100");
});

test("arquivo sem quebra de linha final volta sem quebra de linha final", async () => {
  const original = encodeCP1252(LINHAS_VALIDAS.join(CRLF));
  const { estrutura } = await lerTudo(original);

  assert.equal(estrutura.terminaComQuebra, false);
  assert.deepEqual(regravar(estrutura), original);
});

test("arquivo em UTF-8 com BOM volta em UTF-8 com BOM", async () => {
  const original = new TextEncoder().encode("\uFEFF" + conteudo(LINHAS_VALIDAS));
  const { estrutura, encoding } = await lerTudo(original);

  assert.equal(encoding, "utf-8");
  assert.equal(estrutura.temBom, true);
  assert.equal(estrutura.cabecalho?.reg, "0000", "o BOM não pode virar parte do primeiro campo");
  assert.deepEqual(regravar(estrutura), original);
});

test("versão de leiaute diferente da conferida vira aviso, não erro de leitura", async () => {
  const linhas = LINHAS_VALIDAS.map((l) =>
    l.startsWith("|0000|") ? l.replace("|0000|017|", "|0000|020|") : l
  );
  const original = encodeCP1252(conteudo(linhas));
  const { estrutura } = await lerTudo(original);

  conferirVersao(estrutura);
  const aviso = estrutura.achados.find((a) => a.codigo === "EST-002");
  assert.ok(aviso, "o arquivo declara outra versão de leiaute e isso precisa aparecer");
  assert.equal(aviso?.severidade, "alerta");
  assert.deepEqual(regravar(estrutura), original, "o aviso não afeta a fidelidade");
});
