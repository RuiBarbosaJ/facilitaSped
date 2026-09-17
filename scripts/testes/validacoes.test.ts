/**
 * Testes das regras de validação do bloco C.
 *
 * Cada regra é conferida por um documento montado à mão, e não por um arquivo
 * SPED de verdade: é o que `ContextoValidacao` ser uma INTERFACE compra. O teste
 * diz exatamente qual campo faz a regra disparar, e o caso legítimo vizinho —
 * que é onde mora o risco real desta pasta. Regra fiscal errada não quebra
 * nada: ela enche a tela do contador de achado falso, ou cala sobre o erro.
 *
 * Rode com `npm run teste`.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { registroDe } from "../../src/regras/nucleo/acesso";
import type {
  Achado,
  ContextoValidacao,
  DocumentoFiscal,
  LinhaSped,
  RegraSped,
} from "../../src/regras/nucleo/contrato";
import { MotorSped } from "../../src/regras/nucleo/motor";
import { DICIONARIO_SPED_ICMS_IPI as DIC } from "../../src/regras/icms-ipi/dicionario-sped-icms-ipi";
import { REGRAS_ICMS_IPI } from "../../src/regras/icms-ipi/validacoes";
import {
  FIS_C100_TOTAIS,
  FIS_C170_ANALITICO,
  FIS_C190_COERENCIA,
} from "../../src/regras/icms-ipi/validacoes/analitico";
import { FIS_C170_019, FIS_C170_020 } from "../../src/regras/icms-ipi/validacoes/cfop";
import {
  FIS_C170_001,
  FIS_C170_012,
  FIS_C170_013,
  MATRIZ_CST_ICMS,
} from "../../src/regras/icms-ipi/validacoes/cst";

/* ─────────────────────────── montagem de contexto ───────────────────────── */

let proximaLinha = 1;

/** Uma linha do registro, com os campos nomeados nas posições do dicionário. */
function linha(reg: string, valores: Record<string, string>): LinhaSped {
  const definicao = registroDe(DIC, reg);
  assert.ok(definicao, `registro ${reg} não está no dicionário`);

  const ultima = Math.max(...definicao.campos.map((c) => c.posicao));
  const campos = new Array<string>(ultima + 2).fill("");
  campos[1] = reg;

  for (const [nome, valor] of Object.entries(valores)) {
    const campo = definicao.campos.find((c) => c.nome === nome);
    assert.ok(campo, `${reg} não tem o campo ${nome}`);
    campos[campo.posicao] = valor;
  }

  return { reg, nl: proximaLinha++, campos };
}

interface Nota {
  readonly c100?: Record<string, string>;
  readonly itens?: readonly Record<string, string>[];
  readonly analiticos?: readonly Record<string, string>[];
}

function documento(nota: Nota): DocumentoFiscal {
  const cabecalho = linha("C100", { IND_OPER: "1", COD_SIT: "00", ...nota.c100 });
  const itens = (nota.itens ?? []).map((campos) => linha("C170", campos));
  const analiticos = (nota.analiticos ?? []).map((campos) => linha("C190", campos));

  const filhos = new Map<string, readonly LinhaSped[]>();
  if (itens.length > 0) filhos.set("C170", itens);
  if (analiticos.length > 0) filhos.set("C190", analiticos);

  return { reg: "C100", nl: cabecalho.nl, campos: cabecalho.campos, itens, analiticos, filhos };
}

function contexto(
  documentos: readonly DocumentoFiscal[],
  produtos: ReadonlyMap<string, LinhaSped> = new Map()
): ContextoValidacao {
  return {
    dicionario: DIC,
    cabecalho: null,
    participantes: new Map(),
    produtos,
    unidades: new Map(),
    naturezas: new Map(),
    grupos: new Map([["C100", documentos]]),
    documentos,
    apuracao: [],
    linhas: [],
    contagemPorRegistro: new Map(),
    uf: "MA",
  };
}

/** Roda uma regra isolada e devolve os achados. */
function rodar(regra: RegraSped, documentos: readonly DocumentoFiscal[], produtos?: ReadonlyMap<string, LinhaSped>): readonly Achado[] {
  const motor = new MotorSped(DIC, [regra]);
  const resultado = motor.executar(contexto(documentos, produtos));
  assert.deepEqual(resultado.regrasQueFalharam, [], "a regra lançou exceção");
  return resultado.achados;
}

function codigos(achados: readonly Achado[]): string[] {
  return achados.map((a) => a.codigo).sort();
}

/* ──────────────────────────── FIS-C170-001 ──────────────────────────────── */

test("CST fora das tabelas A e B vira achado, e o CST válido não", () => {
  const achados = rodar(MATRIZ_CST_ICMS === FIS_C170_001 ? FIS_C170_001 : FIS_C170_001, [
    documento({
      itens: [
        { CST_ICMS: "000", CFOP: "5102", VL_ITEM: "100,00", VL_BC_ICMS: "100,00", VL_ICMS: "18,00" },
        { CST_ICMS: "940", CFOP: "5102" }, // origem 9 não existe na Tabela A
        { CST_ICMS: "007", CFOP: "5102" }, // tributação 07 não existe na Tabela B
      ],
    }),
  ]);

  assert.deepEqual(codigos(achados), ["FIS-C170-001", "FIS-C170-001"]);
});

test("CSOSN copiado da NF-e é reconhecido pelo nome, e não some por ser um CST possível", () => {
  const achados = rodar(FIS_C170_001, [
    documento({ itens: [{ CST_ICMS: "101", CFOP: "1102" }] }),
  ]);

  assert.equal(achados.length, 1);
  assert.match(achados[0].mensagem, /Simples Nacional/);
});

test("CST ausente não é achado de domínio — é de campo obrigatório, de outra regra", () => {
  const achados = rodar(FIS_C170_001, [documento({ itens: [{ CFOP: "5102" }] })]);
  assert.deepEqual(achados, []);
});

/* ─────────────────────── a matriz da Tabela B (C170) ────────────────────── */

test("tributação 00 sem base e sem imposto é erro", () => {
  const achados = rodar(MATRIZ_CST_ICMS, [
    documento({ itens: [{ CST_ICMS: "000", CFOP: "5102", VL_ITEM: "100,00" }] }),
  ]);

  assert.deepEqual(codigos(achados), ["FIS-C170-010"]);
  assert.equal(achados[0].severidade, "erro");
  assert.equal(achados[0].campo, "VL_BC_ICMS");
});

test("item de valor zero fica fora da exigência de destaque (brinde e bonificação)", () => {
  const achados = rodar(MATRIZ_CST_ICMS, [
    documento({ itens: [{ CST_ICMS: "000", CFOP: "5910", VL_ITEM: "0,00" }] }),
  ]);
  assert.deepEqual(achados, []);
});

test("redução de base também exige imposto destacado: a base guardada já é a reduzida", () => {
  const achados = rodar(MATRIZ_CST_ICMS, [
    documento({ itens: [{ CST_ICMS: "020", CFOP: "5102", VL_ITEM: "100,00" }] }),
  ]);
  assert.deepEqual(codigos(achados), ["FIS-C170-010"]);
});

test("operação isenta com imposto destacado é erro", () => {
  const achados = rodar(MATRIZ_CST_ICMS, [
    documento({
      itens: [{ CST_ICMS: "040", CFOP: "5102", VL_ITEM: "100,00", VL_ICMS: "18,00" }],
    }),
  ]);

  assert.deepEqual(codigos(achados), ["FIS-C170-011"]);
  assert.equal(achados[0].esperado, "0,00");
  assert.equal(achados[0].atual, "18,00");
});

test("campo de valor vazio vale zero e não gera achado de proibição", () => {
  const achados = rodar(MATRIZ_CST_ICMS, [
    documento({ itens: [{ CST_ICMS: "040", CFOP: "5102", VL_ITEM: "100,00" }] }),
  ]);
  assert.deepEqual(achados, []);
});

test("ST destacada onde a tributação não a comporta", () => {
  const achados = rodar(MATRIZ_CST_ICMS, [
    documento({
      itens: [
        {
          CST_ICMS: "000",
          CFOP: "5102",
          VL_ITEM: "100,00",
          VL_BC_ICMS: "100,00",
          VL_ICMS: "18,00",
          VL_ICMS_ST: "5,00",
        },
      ],
    }),
  ]);

  assert.deepEqual(codigos(achados), ["FIS-C170-017"]);
  assert.equal(achados[0].campo, "VL_ICMS_ST");
});

test("ST é exigida na saída com tributação 10, e não na entrada", () => {
  const item = {
    CST_ICMS: "010",
    CFOP: "5401",
    VL_ITEM: "100,00",
    VL_BC_ICMS: "100,00",
    VL_ICMS: "18,00",
  };

  const saida = rodar(MATRIZ_CST_ICMS, [documento({ c100: { IND_OPER: "1" }, itens: [item] })]);
  assert.deepEqual(codigos(saida), ["FIS-C170-014"]);

  /*
   * Na entrada quem retém é o remetente: exigir do adquirente os campos de ST
   * acusaria de erro toda nota de compra de mercadoria substituída.
   */
  const entrada = rodar(MATRIZ_CST_ICMS, [
    documento({ c100: { IND_OPER: "0" }, itens: [{ ...item, CFOP: "1401" }] }),
  ]);
  assert.deepEqual(entrada, []);
});

test("ICMS já retido anteriormente (60) com imposto destacado é alerta, não erro", () => {
  const achados = rodar(MATRIZ_CST_ICMS, [
    documento({
      itens: [{ CST_ICMS: "060", CFOP: "5405", VL_ITEM: "100,00", VL_ICMS: "18,00" }],
    }),
  ]);

  assert.deepEqual(codigos(achados), ["FIS-C170-015"]);
  assert.equal(achados[0].severidade, "alerta");
});

test("documento cancelado fica fora de toda conferência de valor", () => {
  const achados = rodar(MATRIZ_CST_ICMS, [
    documento({
      c100: { COD_SIT: "02" },
      itens: [{ CST_ICMS: "000", CFOP: "5102", VL_ITEM: "100,00" }],
    }),
  ]);
  assert.deepEqual(achados, []);
});

test("tributação 90 não decide nada sozinha: nem exige, nem proíbe", () => {
  const achados = rodar(MATRIZ_CST_ICMS, [
    documento({ itens: [{ CST_ICMS: "090", CFOP: "5949", VL_ITEM: "100,00" }] }),
  ]);
  assert.deepEqual(achados, []);
});

/* ─────────────────────── FIS-C170-012 e FIS-C170-013 ────────────────────── */

test("base sem imposto é alerta, mas não quando a alíquota é zero", () => {
  const comAliquota = rodar(FIS_C170_012, [
    documento({
      itens: [
        {
          CST_ICMS: "000",
          CFOP: "5102",
          VL_ITEM: "100,00",
          VL_BC_ICMS: "100,00",
          ALIQ_ICMS: "18,00",
        },
      ],
    }),
  ]);
  assert.deepEqual(codigos(comAliquota), ["FIS-C170-012"]);

  const semAliquota = rodar(FIS_C170_012, [
    documento({
      itens: [{ CST_ICMS: "000", CFOP: "5102", VL_ITEM: "100,00", VL_BC_ICMS: "100,00" }],
    }),
  ]);
  assert.deepEqual(semAliquota, []);
});

test("o cálculo do ICMS tolera o centavo do arredondamento", () => {
  const dentro = rodar(FIS_C170_013, [
    documento({
      itens: [
        { CST_ICMS: "000", CFOP: "5102", VL_BC_ICMS: "33,33", ALIQ_ICMS: "18,00", VL_ICMS: "6,00" },
      ],
    }),
  ]);
  assert.deepEqual(dentro, [], "5,9994 contra 6,00 é arredondamento legítimo");

  const fora = rodar(FIS_C170_013, [
    documento({
      itens: [
        { CST_ICMS: "000", CFOP: "5102", VL_BC_ICMS: "100,00", ALIQ_ICMS: "18,00", VL_ICMS: "12,00" },
      ],
    }),
  ]);
  assert.deepEqual(codigos(fora), ["FIS-C170-013"]);
  assert.equal(fora[0].esperado, "18,00");
});

/* ────────────────────────────── CFOP × CST ──────────────────────────────── */

test("material de uso e consumo com crédito destacado", () => {
  const achados = rodar(FIS_C170_019, [
    documento({
      c100: { IND_OPER: "0" },
      itens: [
        {
          CST_ICMS: "000",
          CFOP: "1556",
          VL_ITEM: "100,00",
          VL_BC_ICMS: "100,00",
          VL_ICMS: "18,00",
        },
      ],
    }),
  ]);

  assert.deepEqual(codigos(achados), ["FIS-C170-019"]);
  assert.equal(achados[0].esperado, "0,00");
});

test("a mesma compra sem crédito destacado não gera achado", () => {
  const achados = rodar(FIS_C170_019, [
    documento({
      c100: { IND_OPER: "0" },
      itens: [{ CST_ICMS: "090", CFOP: "1556", VL_ITEM: "100,00" }],
    }),
  ]);
  assert.deepEqual(achados, []);
});

test("compra para revenda continua dando crédito", () => {
  const achados = rodar(FIS_C170_019, [
    documento({
      c100: { IND_OPER: "0" },
      itens: [
        {
          CST_ICMS: "000",
          CFOP: "1102",
          VL_ITEM: "100,00",
          VL_BC_ICMS: "100,00",
          VL_ICMS: "18,00",
        },
      ],
    }),
  ]);
  assert.deepEqual(achados, []);
});

test("mercadoria de revenda saindo como produção própria", () => {
  const produtos = new Map([["X1", linha("0200", { COD_ITEM: "X1", TIPO_ITEM: "00" })]]);

  const achados = rodar(
    FIS_C170_020,
    [documento({ itens: [{ COD_ITEM: "X1", CST_ICMS: "000", CFOP: "5101", VL_ITEM: "10,00" }] })],
    produtos
  );
  assert.deepEqual(codigos(achados), ["FIS-C170-020"]);

  const comCfopDeRevenda = rodar(
    FIS_C170_020,
    [documento({ itens: [{ COD_ITEM: "X1", CST_ICMS: "000", CFOP: "5102", VL_ITEM: "10,00" }] })],
    produtos
  );
  assert.deepEqual(comCfopDeRevenda, []);
});

/* ───────────────────────── o dominó C170 → C190 ─────────────────────────── */

const ITEM_PADRAO = {
  CST_ICMS: "000",
  CFOP: "5102",
  ALIQ_ICMS: "18,00",
  VL_ITEM: "100,00",
  VL_BC_ICMS: "100,00",
  VL_ICMS: "18,00",
};

const GRUPO_PADRAO = {
  CST_ICMS: "000",
  CFOP: "5102",
  ALIQ_ICMS: "18,00",
  VL_OPR: "100,00",
  VL_BC_ICMS: "100,00",
  VL_ICMS: "18,00",
};

test("item sem grupo correspondente no analítico", () => {
  const achados = rodar(FIS_C170_ANALITICO, [
    documento({
      itens: [ITEM_PADRAO, { ...ITEM_PADRAO, CFOP: "5405" }],
      analiticos: [GRUPO_PADRAO],
    }),
  ]);

  assert.deepEqual(codigos(achados), ["FIS-C170-022"]);
});

test("a alíquota entra na chave como número: 18,00 e 18,0 são o mesmo grupo", () => {
  const achados = rodar(FIS_C170_ANALITICO, [
    documento({
      itens: [ITEM_PADRAO],
      analiticos: [{ ...GRUPO_PADRAO, ALIQ_ICMS: "18,0" }],
    }),
  ]);

  assert.deepEqual(achados, [], "a comparação textual separaria os dois e inventaria um achado");
});

test("o grupo do analítico tem de fechar com a soma dos itens", () => {
  const achados = rodar(FIS_C170_ANALITICO, [
    documento({
      itens: [ITEM_PADRAO, ITEM_PADRAO],
      analiticos: [GRUPO_PADRAO], // consolidou um item só
    }),
  ]);

  assert.deepEqual(codigos(achados), ["FIS-C170-023", "FIS-C170-023"]);
  const base = achados.find((a) => a.campo === "VL_BC_ICMS");
  assert.equal(base?.esperado, "200,00");
  assert.equal(base?.atual, "100,00");
  assert.equal(base?.reg, "C190");
});

test("a tolerância acompanha a quantidade de itens somados", () => {
  const item = { ...ITEM_PADRAO, VL_BC_ICMS: "10,00", VL_ICMS: "1,80", VL_ITEM: "10,00" };
  const itens = new Array(10).fill(item);

  const achados = rodar(FIS_C170_ANALITICO, [
    documento({
      itens,
      // 100,00 de base contra 100,05 consolidados: cinco centavos em dez itens.
      analiticos: [{ ...GRUPO_PADRAO, VL_BC_ICMS: "100,05", VL_ICMS: "18,00" }],
    }),
  ]);

  assert.deepEqual(
    achados.filter((a) => a.campo === "VL_BC_ICMS"),
    [],
    "cinco centavos em dez itens é arredondamento, não divergência"
  );
});

/* ────────────────────────── o analítico consigo ─────────────────────────── */

test("grupo com imposto e sem alíquota", () => {
  const achados = rodar(FIS_C190_COERENCIA, [
    documento({ analiticos: [{ ...GRUPO_PADRAO, ALIQ_ICMS: "" }] }),
  ]);

  assert.ok(codigos(achados).includes("FIS-C190-010"));
});

test("grupo isento com imposto consolidado", () => {
  const achados = rodar(FIS_C190_COERENCIA, [
    documento({
      analiticos: [{ CST_ICMS: "040", CFOP: "5102", VL_OPR: "100,00", VL_ICMS: "18,00" }],
    }),
  ]);

  assert.deepEqual(codigos(achados), ["FIS-C190-012"]);
});

test("redução de base sem o valor reduzido", () => {
  const achados = rodar(FIS_C190_COERENCIA, [
    documento({
      analiticos: [
        {
          CST_ICMS: "020",
          CFOP: "5102",
          ALIQ_ICMS: "18,00",
          VL_OPR: "100,00",
          VL_BC_ICMS: "60,00",
          VL_ICMS: "10,80",
        },
      ],
    }),
  ]);

  assert.deepEqual(codigos(achados), ["FIS-C190-013"]);
});

test("combinação analítica repetida no mesmo documento", () => {
  const achados = rodar(FIS_C190_COERENCIA, [
    documento({ analiticos: [GRUPO_PADRAO, GRUPO_PADRAO] }),
  ]);

  assert.deepEqual(codigos(achados), ["FIS-C190-014"]);
});

test("a mesma combinação com observações diferentes não é duplicidade", () => {
  /*
   * Não está conferido se o COD_OBS integra a chave de agrupamento. Se integrar,
   * as duas linhas são legítimas — e apontar aqui seria achado falso sobre
   * arquivo correto.
   */
  const achados = rodar(FIS_C190_COERENCIA, [
    documento({
      analiticos: [
        { ...GRUPO_PADRAO, COD_OBS: "OBS1" },
        { ...GRUPO_PADRAO, COD_OBS: "OBS2" },
      ],
    }),
  ]);

  assert.deepEqual(achados, []);
});

/* ───────────────────────── os totais do documento ───────────────────────── */

test("os totais da nota reproduzem a soma dos analíticos", () => {
  const achados = rodar(FIS_C100_TOTAIS, [
    documento({
      c100: { VL_MERC: "200,00", VL_BC_ICMS: "100,00", VL_ICMS: "18,00" },
      itens: [ITEM_PADRAO, ITEM_PADRAO],
      analiticos: [{ ...GRUPO_PADRAO, VL_OPR: "200,00", VL_BC_ICMS: "200,00", VL_ICMS: "36,00" }],
    }),
  ]);

  const codigosEmitidos = codigos(achados);
  assert.deepEqual(codigosEmitidos, ["FIS-C100-012", "FIS-C100-012"]);
  assert.equal(achados.find((a) => a.campo === "VL_ICMS")?.esperado, "36,00");
});

test("documento com movimento e sem analítico nenhum", () => {
  const achados = rodar(FIS_C100_TOTAIS, [documento({ itens: [ITEM_PADRAO] })]);
  assert.deepEqual(codigos(achados), ["FIS-C100-018"]);
});

test("documento cancelado sem analítico não é apontado", () => {
  const achados = rodar(FIS_C100_TOTAIS, [
    documento({ c100: { COD_SIT: "02" }, itens: [] }),
  ]);
  assert.deepEqual(achados, []);
});

/* ─────────────────────── invariantes do conjunto ────────────────────────── */

test("nenhum achado carrega conteúdo fiscal na mensagem", () => {
  /*
   * A mensagem vai para a tela, para o log e para a exportação. CFOP e CST são
   * inócuos; descrição de produto e nome de participante, não. Valor vai em
   * `atual`/`esperado`, que é onde a UI o mostra como sugestão — e não no texto.
   */
  const doc = documento({
    c100: { VL_MERC: "1,00", VL_BC_ICMS: "1,00", VL_ICMS: "1,00" },
    itens: [{ ...ITEM_PADRAO, COD_ITEM: "SEGREDO-DO-CLIENTE", DESCR_COMPL: "SEGREDO" }],
    analiticos: [{ ...GRUPO_PADRAO, VL_ICMS: "99,00" }],
  });

  const motor = new MotorSped(DIC, REGRAS_ICMS_IPI);
  const { achados } = motor.executar(contexto([doc]));

  assert.ok(achados.length > 0, "o documento foi montado para gerar achados");
  for (const achado of achados) {
    assert.doesNotMatch(achado.mensagem, /SEGREDO/, `${achado.codigo} vazou conteúdo do arquivo`);
  }
});

test("toda regra declarada como implementada aponta para uma regra que existe", () => {
  /*
   * `implementadaEm` é o que fecha o ciclo entre a norma declarada e a função
   * que a confere. Um código errado ali não quebra nada — só faz o dicionário
   * mentir sobre o que está ligado.
   */
  const existentes = new Set(REGRAS_ICMS_IPI.map((r) => r.codigo));

  for (const registro of Object.values(DIC.registros)) {
    for (const regra of registro.regrasDoRegistro ?? []) {
      if (!regra.implementadaEm) continue;
      assert.ok(
        existentes.has(regra.implementadaEm),
        `${regra.id} diz ser conferida por ${regra.implementadaEm}, que não está em REGRAS_ICMS_IPI`
      );
    }
    for (const campo of registro.campos) {
      for (const regra of campo.regrasValidacaoCustomizadas ?? []) {
        if (!regra.implementadaEm) continue;
        assert.ok(
          existentes.has(regra.implementadaEm),
          `${regra.id} diz ser conferida por ${regra.implementadaEm}, que não está em REGRAS_ICMS_IPI`
        );
      }
    }
  }
});

test("o motor recusa duas regras com o mesmo código", () => {
  assert.doesNotThrow(() => new MotorSped(DIC, REGRAS_ICMS_IPI));
});
