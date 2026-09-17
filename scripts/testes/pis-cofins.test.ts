/**
 * Testes da auditoria de PIS/COFINS — as duas pontas da operação.
 *
 * A mesma tabela do SPED governa a compra e a venda, e o código muda: o NCM de
 * alíquota zero SAI com CST 06 e ENTRA com 73. Auditar uma planilha de compras
 * contra a coluna de saída reprova todas as linhas e oferece, como correção,
 * trocar o código certo pelo da outra ponta — erro que chega pronto, com cara
 * de conserto, e vai para a planilha que volta ao ERP.
 *
 * Rode com `npm run teste`.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  auditarLinha,
  corrigirLinhas,
  cstTributadoDe,
  detectarSentido,
  indexarBase,
  indexarRegrasSemNcm,
  localizarCabecalho,
  type ContextoAuditoria,
  type LinhaPlanilha,
  type Sentido,
} from "../../src/pis-cofins/auditoria";
import type { RegraTabelaSped } from "../../src/tipos/tabelas-receita";

/* ─────────────────────────── base de regras ─────────────────────────────── */

/** Leite fluido pasteurizado: alíquota zero (4.3.13), natureza 110. */
const LEITE: RegraTabelaSped = {
  tabela: "4.3.13",
  ncm: "04012010",
  natureza_receita: "110",
  descricao: "Leite fluido pasteurizado destinado ao consumo humano",
  data_inicio: "2011-01-01",
  data_fim: "",
} as RegraTabelaSped;

/** Gasolina: monofásica por unidade (4.3.11), natureza 301. */
const GASOLINA: RegraTabelaSped = {
  tabela: "4.3.11",
  ncm: "27101259",
  natureza_receita: "301",
  descricao: "Gasolinas, exceto gasolina de aviação",
  data_inicio: "2011-01-01",
  data_fim: "",
} as RegraTabelaSped;

const BASE = [LEITE, GASOLINA];

function contexto(sentido: Sentido): ContextoAuditoria {
  return {
    base: indexarBase(BASE),
    semNcm: indexarRegrasSemNcm(BASE),
    ncm: null,
    hoje: new Date("2026-09-17T12:00:00Z"),
    sentido,
  };
}

function linha(dados: Partial<LinhaPlanilha> & { classificacao: string }): LinhaPlanilha {
  return {
    linha: 1,
    original: [],
    nome: "PRODUTO",
    natureza: "",
    cstPis: "",
    cstCofins: "",
    cfop: "",
    ...dados,
  };
}

/* ───────────────────────── detecção da ponta ────────────────────────────── */

test("o cabeçalho que declara a ponta vence qualquer inferência", () => {
  const achado = localizarCabecalho([
    ["Nome Produto", "Classificação", "CST PIS Entrada", "CST COFINS Entrada"],
  ]);
  assert.equal(achado?.colunas.sentidoDeclarado, "entrada");

  const saida = localizarCabecalho([["Nome Produto", "Classificação", "CST PIS Saida"]]);
  assert.equal(saida?.colunas.sentidoDeclarado, "saida");

  const mudo = localizarCabecalho([["Nome Produto", "Classificação", "CST PIS"]]);
  assert.equal(mudo?.colunas.sentidoDeclarado, undefined);
});

test("o CFOP decide a ponta quando o cabeçalho se cala", () => {
  const entrada = detectarSentido([
    linha({ classificacao: "04012010", cfop: "1102" }),
    linha({ classificacao: "04012010", cfop: "2102" }),
  ]);
  assert.equal(entrada.sentido, "entrada");
  assert.equal(entrada.confiante, true);

  const saida = detectarSentido([linha({ classificacao: "04012010", cfop: "5102" })]);
  assert.equal(saida.sentido, "saida");
});

test("sem CFOP, a faixa dos CSTs informados decide", () => {
  const entrada = detectarSentido([
    linha({ classificacao: "04012010", cstPis: "73", cstCofins: "73" }),
  ]);
  assert.equal(entrada.sentido, "entrada");

  const saida = detectarSentido([linha({ classificacao: "04012010", cstPis: "06" })]);
  assert.equal(saida.sentido, "saida");
});

test("sem nenhuma pista vale saída, e a ferramenta AVISA que chutou", () => {
  /*
   * A diferença entre decidir e assumir é o que permite à tela pedir
   * conferência. Sem o sinal, uma planilha de compras sem CFOP e sem CST seria
   * auditada como venda em silêncio.
   */
  const nenhuma = detectarSentido([linha({ classificacao: "04012010" })]);
  assert.equal(nenhuma.sentido, "saida");
  assert.equal(nenhuma.confiante, false);
});

/* ────────────────────── a mesma regra, duas pontas ──────────────────────── */

test("alíquota zero: CST 06 é o certo na saída e o ERRADO na entrada", () => {
  const item = linha({ classificacao: "04012010", cstPis: "06", cstCofins: "06", natureza: "110" });

  const naSaida = auditarLinha(item, contexto("saida"));
  assert.equal(naSaida.situacao, "beneficio");
  assert.deepEqual(naSaida.observacoes, [], "na venda, 06 é exatamente o esperado");

  const naEntrada = auditarLinha(item, contexto("entrada"));
  assert.ok(
    naEntrada.observacoes.some((o) => /CST PIS 06 informado; o SPED indica 73/.test(o)),
    "na compra, o mesmo NCM pede 73"
  );
});

test("alíquota zero: CST 73 é o certo na entrada e o ERRADO na saída", () => {
  const item = linha({ classificacao: "04012010", cstPis: "73", cstCofins: "73", natureza: "110" });

  const naEntrada = auditarLinha(item, contexto("entrada"));
  assert.deepEqual(naEntrada.observacoes, [], "na compra, 73 é exatamente o esperado");

  const naSaida = auditarLinha(item, contexto("saida"));
  assert.ok(naSaida.observacoes.some((o) => /o SPED indica 06/.test(o)));
});

test("monofásico na aquisição é 70 — e a regra diz por que não há crédito", () => {
  const item = linha({ classificacao: "27101259", cstPis: "73", cstCofins: "73", natureza: "301" });
  const auditada = auditarLinha(item, contexto("entrada"));

  assert.ok(auditada.observacoes.some((o) => /o SPED indica 70/.test(o)));
  assert.ok(
    auditada.observacoes.some((o) => /sem direito a crédito/.test(o)),
    "a nota explica a vedação ao crédito, que ninguém acerta de cabeça"
  );
});

test("a sugestão exibida na linha traz os CSTs da ponta auditada", () => {
  const item = linha({ classificacao: "04012010", natureza: "110" });

  assert.deepEqual(auditarLinha(item, contexto("saida")).regra?.cstsAceitos, ["06"]);
  assert.deepEqual(auditarLinha(item, contexto("entrada")).regra?.cstsAceitos, ["73"]);
});

/* ──────────────────────── critério de correção ──────────────────────────── */

test("o CST de 'sem benefício' depende da ponta e do regime", () => {
  assert.equal(cstTributadoDe("saida", "nao-cumulativo"), "01");
  assert.equal(cstTributadoDe("saida", "cumulativo"), "01", "na venda o regime não muda nada");
  assert.equal(cstTributadoDe("entrada", "nao-cumulativo"), "50");
  assert.equal(cstTributadoDe("entrada", "cumulativo"), "70");
});

test("na entrada, o critério grava o CST de aquisição — e não o de receita", () => {
  const linhas = [
    auditarLinha(linha({ classificacao: "04012010", natureza: "110" }), contexto("entrada")),
    auditarLinha(
      { ...linha({ classificacao: "99999999" }), linha: 2 },
      contexto("entrada")
    ),
  ];

  const corrigidas = corrigirLinhas(linhas, "73", "50", "entrada");

  assert.equal(corrigidas[0].cstCorrigido, "73", "o NCM com alíquota zero recebe 73");
  assert.equal(corrigidas[0].naturezaCorrigida, "110");
  assert.equal(corrigidas[1].cstCorrigido, "50", "o NCM sem benefício recebe o CST do regime");
});

test("no regime cumulativo a compra sem benefício não ganha crédito", () => {
  const linhas = [auditarLinha({ ...linha({ classificacao: "99999999" }) }, contexto("entrada"))];
  const corrigidas = corrigirLinhas(linhas, "73", "70", "entrada");

  assert.equal(corrigidas[0].cstCorrigido, "70");
  assert.ok(
    corrigidas[0].observacoes.some((o) => /sem direito a crédito \(CST 70\)/.test(o)),
    "a observação diz o que foi gravado, com o nome do código"
  );
});

test("o benefício próprio da outra tabela é mantido também na entrada", () => {
  /*
   * A gasolina é monofásica (CST 70 na compra). Com o critério de alíquota zero
   * ligado, rebaixá-la para 50 daria crédito onde a lei o veda — e isso iria
   * para a planilha que volta ao ERP.
   */
  const gasolina = auditarLinha(
    linha({ classificacao: "27101259", cstPis: "70", cstCofins: "70", natureza: "301" }),
    contexto("entrada")
  );

  const corrigidas = corrigirLinhas([gasolina], "73", "50", "entrada");

  assert.equal(corrigidas[0].cstCorrigido, undefined, "a linha não foi corrigida");
  assert.ok(corrigidas[0].observacoes.some((o) => /regime próprio vigente/.test(o)));
});

test("na saída, nada mudou: 06 continua sendo o alvo e 01 a sobra", () => {
  const linhas = [
    auditarLinha(linha({ classificacao: "04012010", natureza: "110" }), contexto("saida")),
    auditarLinha({ ...linha({ classificacao: "99999999" }), linha: 2 }, contexto("saida")),
  ];

  const corrigidas = corrigirLinhas(linhas, "06", "01", "saida");

  assert.equal(corrigidas[0].cstCorrigido, "06");
  assert.equal(corrigidas[1].cstCorrigido, "01");
});

test("na entrada, o critério nunca inventa crédito sobre NCM com regime vigente", () => {
  /*
   * A gasolina é monofásica: a lei veda o crédito na compra para revenda. Se o
   * cliente informou um código que não é o dela e o critério do dia é outro, a
   * linha NÃO pode cair no CST 50 por eliminação — isso é crédito tomado, e vai
   * para a planilha que volta ao ERP.
   */
  const gasolina = auditarLinha(
    linha({ classificacao: "27101259", cstPis: "73", cstCofins: "73", natureza: "301" }),
    contexto("entrada")
  );

  const corrigidas = corrigirLinhas([gasolina], "71", "50", "entrada");

  assert.equal(corrigidas[0].cstCorrigido, undefined, "a linha foi mantida, não rebaixada");
  assert.ok(
    corrigidas[0].observacoes.some((o) => /daria crédito sobre uma aquisição/.test(o)),
    "e a tela diz por que a ferramenta se recusou"
  );
});

test("no regime cumulativo a guarda não se aplica: 70 não dá crédito nenhum", () => {
  const gasolina = auditarLinha(
    linha({ classificacao: "27101259", cstPis: "73", cstCofins: "73", natureza: "301" }),
    contexto("entrada")
  );

  const corrigidas = corrigirLinhas([gasolina], "71", "70", "entrada");
  assert.equal(corrigidas[0].cstCorrigido, "70");
});

test("o NCM sem regime nenhum continua recebendo o CST do regime de apuração", () => {
  const parafuso = auditarLinha(linha({ classificacao: "73181500" }), contexto("entrada"));
  assert.equal(corrigirLinhas([parafuso], "73", "50", "entrada")[0].cstCorrigido, "50");
});
