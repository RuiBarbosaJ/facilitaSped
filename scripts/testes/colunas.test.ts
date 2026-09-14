/**
 * Testes da visibilidade de colunas da grade do SPED.
 *
 * Um arquivo SPED vira um planilhão de cem colunas em que cada linha preenche
 * um punhado: o C170 tem 38 campos, o 0000 tem 14, e na grade unificada todo o
 * resto fica vazio. Esconder o que está vazio é o que torna a grade legível —
 * e é também o que pode esconder algo que o usuário precisa ver. Estes testes
 * travam os dois lados.
 *
 * Rode com `npm run teste`.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { COLUNA_REGISTRO } from "../../src/icms-ipi/leiaute/acesso";
import {
  colunasVisiveisDe,
  estadoDasColunas,
  type ColunaGrade,
  type EstadoDasColunas,
} from "../../src/icms-ipi/leiaute/colunas";

const COLUNAS: ColunaGrade[] = [
  { nome: COLUNA_REGISTRO, titulo: "Registro", tipo: "codigo", registros: [] },
  { nome: "CFOP", titulo: "CFOP", tipo: "codigo", registros: ["C170"] },
  { nome: "CST_ICMS", titulo: "CST ICMS", tipo: "codigo", registros: ["C170"] },
  { nome: "SUFRAMA", titulo: "SUFRAMA", tipo: "codigo", registros: ["0150"] },
  { nome: "COD_LST", titulo: "Cód. Serviço", tipo: "codigo", registros: ["0200"] },
];

const nomes = (cols: ColunaGrade[]) => cols.map((c) => c.nome);
const estado = (ausentes: string[] = [], emBranco: string[] = []): EstadoDasColunas => ({
  ausentes: new Set(ausentes),
  emBranco: new Set(emBranco),
});

test("coluna que nenhuma linha possui é AUSENTE — não se aplica ao recorte", () => {
  const { ausentes, emBranco } = estadoDasColunas(COLUNAS, {
    CFOP: ["1102", "5102"],
    CST_ICMS: ["000"],
    SUFRAMA: [],
    COD_LST: [],
  });
  assert.deepEqual([...ausentes].sort(), ["COD_LST", "SUFRAMA"]);
  assert.equal(emBranco.size, 0);
});

test("coluna que as linhas possuem mas está vazia é EM BRANCO — o achado, não o ruído", () => {
  /*
   * O caso que decide o desenho inteiro: o 0150 existe no arquivo, a coluna
   * SUFRAMA é montada, e toda célula traz "". Isso NÃO é "não se aplica" — é
   * campo existente que ninguém preencheu. Se o campo fosse obrigatório, este
   * seria exatamente o erro que o contador precisa ver, e escondê-lo por
   * "estar vazio" transformaria a omissão em invisibilidade.
   */
  const { ausentes, emBranco } = estadoDasColunas(COLUNAS, {
    CFOP: ["1102"],
    CST_ICMS: ["000"],
    SUFRAMA: [""],
    COD_LST: [""],
  });
  assert.deepEqual([...emBranco].sort(), ["COD_LST", "SUFRAMA"]);
  assert.equal(ausentes.size, 0);
});

test("ausente e em branco nunca se misturam", () => {
  const { ausentes, emBranco } = estadoDasColunas(COLUNAS, {
    CFOP: ["1102"],
    CST_ICMS: ["000"],
    SUFRAMA: [""],
    COD_LST: [],
  });
  assert.equal(ausentes.has("COD_LST"), true);
  assert.equal(emBranco.has("SUFRAMA"), true);
  assert.equal(ausentes.has("SUFRAMA"), false);
  assert.equal(emBranco.has("COD_LST"), false);
});

test("antes da primeira resposta do worker, nada é classificado", () => {
  /*
   * Entre abrir o arquivo e as opções chegarem, `opcoes` está vazio. Tratar
   * isso como "tudo ausente" faria a grade abrir com uma coluna só e piscar
   * inteira quando os valores chegassem.
   */
  const { ausentes, emBranco } = estadoDasColunas(COLUNAS, {});
  assert.equal(ausentes.size, 0);
  assert.equal(emBranco.size, 0);
});

test("a coluna do registro nunca entra na classificação", () => {
  // Ela identifica a linha; escondê-la deixaria a grade ilegível.
  const { ausentes } = estadoDasColunas(COLUNAS, { [COLUNA_REGISTRO]: [] });
  assert.equal(ausentes.has(COLUNA_REGISTRO), false);
});

test("por padrão, coluna ausente some e coluna preenchida fica", () => {
  const visiveis = colunasVisiveisDe(COLUNAS, estado(["SUFRAMA", "COD_LST"]), {}, new Set());
  assert.deepEqual(nomes(visiveis), [COLUNA_REGISTRO, "CFOP", "CST_ICMS"]);
});

test("coluna EM BRANCO nunca some sozinha", () => {
  /*
   * É o bloqueante que a revisão adversarial apontou: a versão anterior jogava
   * "não se aplica" e "em branco" no mesmo conjunto e escondia os dois. O campo
   * obrigatório vazio — o achado que o contador precisa ver — sumia da grade
   * justamente por estar vazio.
   */
  const visiveis = colunasVisiveisDe(COLUNAS, estado([], ["SUFRAMA"]), {}, new Set());
  assert.ok(nomes(visiveis).includes("SUFRAMA"));
});

test("a escolha do usuário vence o automático, nos dois sentidos", () => {
  const e = estado(["SUFRAMA"]);

  // Revelar uma ausente: ver a coluna mesmo sem linha que a possua.
  const comSuframa = colunasVisiveisDe(COLUNAS, e, { SUFRAMA: true }, new Set());
  assert.ok(nomes(comSuframa).includes("SUFRAMA"));

  // Esconder uma cheia: tirar da frente o que não interessa agora.
  const semCfop = colunasVisiveisDe(COLUNAS, e, { CFOP: false }, new Set());
  assert.ok(!nomes(semCfop).includes("CFOP"));
});

test("a coluna do registro fica visível mesmo se o usuário tentar escondê-la", () => {
  const visiveis = colunasVisiveisDe(COLUNAS, estado(), { [COLUNA_REGISTRO]: false }, new Set());
  assert.ok(nomes(visiveis).includes(COLUNA_REGISTRO));
});

test("coluna com filtro ativo não some, mesmo que o filtro a tenha esvaziado", () => {
  /*
   * O caso que morde: filtrar CST_ICMS por um valor que some depois de outro
   * filtro. A coluna fica vazia, o automático a esconderia — e com ela sumiria
   * o único controle para desfazer o filtro que causou o problema.
   */
  const visiveis = colunasVisiveisDe(COLUNAS, estado(["CST_ICMS"]), {}, new Set(["CST_ICMS"]));
  assert.ok(nomes(visiveis).includes("CST_ICMS"));
});

test("filtro ativo vence até uma ocultação explícita do usuário", () => {
  const visiveis = colunasVisiveisDe(COLUNAS, estado(), { CFOP: false }, new Set(["CFOP"]));
  assert.ok(nomes(visiveis).includes("CFOP"));
});

test("a ordem das colunas é preservada", () => {
  // A grade lê da esquerda para a direita na ordem do leiaute; embaralhar as
  // colunas a cada filtro tornaria a leitura impossível.
  const visiveis = colunasVisiveisDe(COLUNAS, estado(), {}, new Set());
  assert.deepEqual(nomes(visiveis), nomes(COLUNAS));
});
