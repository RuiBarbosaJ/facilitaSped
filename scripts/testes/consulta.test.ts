/**
 * Teste da busca e da apresentação da tela de consulta.
 *
 * A busca ganhou a leitura do NCM por hierarquia e a tolerância a acento. O
 * que não pode acontecer em silêncio é ela PERDER resultado: o contador que
 * achava uma regra ontem tem de continuar achando hoje. O primeiro bloco
 * confere isso contra os dados reais, comparando com a busca antiga.
 *
 * Rode com `npm run teste`.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Fuse from "fuse.js";

import type { RegraTabelaSped } from "../../src/tipos/tabelas-receita";
import { combinarBusca, digitosDoNcm, regrasDoNcm } from "../../src/consulta/buscar";
import { OPCOES } from "../../src/consulta/ui/useBuscaRegras";
import { dividirPorDestaque, ncmsDestacados } from "../../src/consulta/destaque";
import { formatarNcm } from "../../src/comum/ncm";
import { colunasVisiveis, formatarAliquota } from "../../src/consulta/colunas";

const dados: RegraTabelaSped[] = JSON.parse(
  readFileSync(new URL("../../public/data/tabelas-sped.json", import.meta.url), "utf8"),
);

function regra(ncm: string, descricao = ""): RegraTabelaSped {
  return { ncm, descricao, cst: "06", aliquota: "", natureza_receita: "100", tabela: "4.3.13" };
}

/** A busca como a tela faz agora. */
function buscarAgora(termo: string): RegraTabelaSped[] {
  const porTexto = new Fuse(dados, OPCOES).search(termo).map((r) => r.item);
  return combinarBusca(dados, porTexto, termo);
}

test("nada do que a busca antiga achava deixa de aparecer", () => {
  // A busca de antes: as mesmas opções, sem a tolerância a acento.
  const antiga = new Fuse(dados, { ...OPCOES, ignoreDiacritics: false });
  const termos = [
    "arroz", "2710", "0405.10.00", "04051000", "cerveja", "açúcar", "leite",
    "1006", "farinha de trigo", "café", "gasolina", "27101259", "Lei", "02",
  ];
  for (const termo of termos) {
    const antes = antiga.search(termo).map((r) => r.item);
    const agora = new Set(buscarAgora(termo));
    const perdidas = antes.filter((r) => !agora.has(r));
    assert.equal(perdidas.length, 0, `"${termo}" perdeu ${perdidas.length} regra(s)`);
  }
});

test("o NCM completo, com ou sem pontos, acha a regra da posição", () => {
  for (const termo of ["10064000", "1006.40.00"]) {
    const achadas = buscarAgora(termo);
    assert.ok(achadas.length > 0, `"${termo}" não achou nada`);
    assert.ok(achadas.some((r) => r.ncm === "1006"), `"${termo}" não achou a posição 1006`);
  }
});

test("a busca por texto ignora acento", () => {
  const achadas = buscarAgora("acucar");
  assert.ok(achadas.some((r) => /açúcar/i.test(r.descricao)));
});

test("o termo só vira código quando parece NCM", () => {
  assert.equal(digitosDoNcm("1006.40.00"), "10064000");
  assert.equal(digitosDoNcm(" 0405.10.00 "), "04051000");
  assert.equal(digitosDoNcm("27-10"), "2710");
  assert.equal(digitosDoNcm("1006"), "1006");
  assert.equal(digitosDoNcm("arroz"), null);
  assert.equal(digitosDoNcm("2710 gasolina"), null);
  assert.equal(digitosDoNcm("1"), null, "um dígito não é capítulo");
  assert.equal(digitosDoNcm("123456789"), null, "nove dígitos não é NCM");
});

test("a regra do próprio código vem antes da posição, e a posição antes do capítulo", () => {
  const posicao = regra("1006");
  const capitulo = regra("10");
  const detalhe = regra("100620");
  const outra = regra("1007");
  const semNcm = regra("");
  const base = [capitulo, detalhe, outra, semNcm, posicao];

  assert.deepEqual(regrasDoNcm(base, "10064000"), [posicao, capitulo]);
  assert.deepEqual(regrasDoNcm(base, "1006"), [posicao, capitulo, detalhe]);
  assert.deepEqual(regrasDoNcm(base, "100620"), [detalhe, posicao, capitulo]);
});

test("o destaque marca o termo sem depender de acento nem de caixa", () => {
  assert.deepEqual(dividirPorDestaque("Açúcar classificado no código", "acucar"), [
    { texto: "Açúcar", destaque: true },
    { texto: " classificado no código", destaque: false },
  ]);
  // A frase inteira, não "de" solto pela descrição.
  const trechos = dividirPorDestaque("Farinha de trigo e de milho", "farinha de trigo");
  assert.deepEqual(trechos.filter((t) => t.destaque).map((t) => t.texto), ["Farinha de trigo"]);
  assert.deepEqual(dividirPorDestaque("Pintos de 1 dia", "de"), [{ texto: "Pintos de 1 dia", destaque: false }]);
  // Caractere especial de expressão regular no termo não quebra nada.
  assert.ok(dividirPorDestaque("Código 0405.10.00 da TIPI", "0405.10.00").some((t) => t.destaque));
  assert.doesNotThrow(() => dividirPorDestaque("texto", "(a+[b"));
});

test("o NCM que casou com a busca é o que acende", () => {
  assert.deepEqual([...ncmsDestacados(["1006", "100620", "0713"], "1006.40.00")], ["1006"]);
  assert.deepEqual([...ncmsDestacados(["1006", "100620", "0713"], "arroz")], []);
});

test("o NCM aparece como na TIPI", () => {
  assert.equal(formatarNcm("10064000"), "1006.40.00");
  assert.equal(formatarNcm("010511"), "0105.11");
  assert.equal(formatarNcm("02062"), "0206.2");
  assert.equal(formatarNcm("0407"), "0407");
  assert.equal(formatarNcm("07"), "Cap. 07");
});

test("a alíquota sai com vírgula, e coluna repetida ou vazia some", () => {
  assert.equal(formatarAliquota("2.65"), "2,65%");
  assert.equal(formatarAliquota("0.8250"), "0,8250%");
  assert.equal(formatarAliquota(""), "");

  const ids = (todas: boolean, aliquota: boolean) => colunasVisiveis(todas, aliquota).map((c) => c.id);
  assert.deepEqual(ids(false, false), ["ncm", "natureza", "descricao", "vigencia"]);
  assert.deepEqual(ids(true, true), ["ncm", "cst", "natureza", "aliquota", "descricao", "vigencia"]);
});
