/**
 * Testes do recorte da grade do SPED.
 *
 * O recorte responde as duas perguntas que nenhum filtro de coluna alcança —
 * "onde estão os erros?" e "o que eu já mandei corrigir?" — e erra de um jeito
 * silencioso: uma linha a mais ou a menos não quebra nada, só faz a grade
 * mostrar um arquivo que não é o que está na tela. Estes testes travam os casos
 * em que isso aconteceria.
 *
 * Rode com `npm run teste`.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  alternarSeveridade,
  camposDoRecorte,
  chaveDaCelula,
  marcarAuditoria,
  linhasDoRecorte,
  recorteAtivo,
  resumirRecorte,
  RECORTE_ABERTO,
} from "../../src/icms-ipi/auditoria/recorte";
import type { Correcao } from "../../src/icms-ipi/regravacao/correcoes";
import type { Achado, Severidade } from "../../src/regras/nucleo/contrato";

function achado(nl: number, severidade: Severidade, campo?: string): Achado {
  return {
    id: `X:${nl}:${campo ?? ""}`,
    codigo: "FIS-000",
    severidade,
    nl,
    reg: "C170",
    campo,
    mensagem: "…",
    corrigivel: false,
    regra: "teste",
  };
}

function correcaoDeCampo(nl: number, campo: string): Correcao {
  return {
    tipo: "campo",
    codigo: "EST-023",
    classe: "automatica",
    nl,
    reg: "C170",
    campo,
    posicao: 11,
    de: "",
    para: "",
    motivo: "…",
  };
}

const CORRECAO_DE_LINHA: Correcao = {
  tipo: "linha",
  codigo: "CAD-022",
  classe: "sugerida",
  apos: 3,
  reg: "0190",
  campos: ["", "0190", "UN", "UNIDADE", ""],
  motivo: "…",
};

const ACHADOS: Achado[] = [
  achado(10, "erro", "CFOP"),
  achado(10, "erro", "CST_ICMS"), // mesma linha, segundo apontamento
  achado(20, "alerta", "VL_ICMS"),
  achado(30, "info"), // sem campo: não aponta célula nenhuma
  achado(0, "critico", "COD_VER"), // agregado do arquivo, sem linha
];

test("sem marcação não há recorte — e isso é diferente de recorte vazio", () => {
  assert.equal(recorteAtivo(RECORTE_ABERTO), false);
  assert.equal(linhasDoRecorte(ACHADOS, [], RECORTE_ABERTO), undefined);
});

test("severidade marcada sem nenhuma linha devolve lista VAZIA, não 'sem recorte'", () => {
  /*
   * A diferença decide o que aparece na tela: `undefined` mostra o arquivo
   * inteiro, `[]` mostra nada. Confundir os dois abriria as 500 mil linhas
   * justamente quando a resposta certa é "não há nenhuma".
   */
  const linhas = linhasDoRecorte(ACHADOS, [], { severidades: ["critico"], corrigidas: false });
  assert.deepEqual(linhas, [], "o crítico do arquivo não tem linha e não entra");
});

test("a linha do apontamento agregado (nl 0) nunca entra no recorte", () => {
  const linhas = linhasDoRecorte(ACHADOS, [], { severidades: ["critico"], corrigidas: false });
  assert.equal(linhas?.includes(0), false);
});

test("uma severidade recorta só as linhas dela", () => {
  assert.deepEqual(
    linhasDoRecorte(ACHADOS, [], { severidades: ["erro"], corrigidas: false }),
    [10]
  );
});

test("as marcações SOMAM linhas, não cruzam", () => {
  /*
   * Cruzar esconderia justamente a linha que o contador acabou de mandar
   * corrigir — a que ele quer reler antes de gerar o arquivo.
   */
  const linhas = linhasDoRecorte(ACHADOS, [correcaoDeCampo(77, "VL_ICMS")], {
    severidades: ["erro", "alerta"],
    corrigidas: true,
  });
  assert.deepEqual(linhas, [10, 20, 77]);
});

test("as linhas saem ordenadas — é a chave de cache do índice no worker", () => {
  const linhas = linhasDoRecorte(
    [achado(90, "erro"), achado(5, "erro"), achado(50, "erro")],
    [],
    { severidades: ["erro"], corrigidas: false }
  );
  assert.deepEqual(linhas, [5, 50, 90]);
});

test("correção que insere linha não entra no recorte: ela não existe no arquivo lido", () => {
  const linhas = linhasDoRecorte(ACHADOS, [CORRECAO_DE_LINHA], {
    severidades: [],
    corrigidas: true,
  });
  assert.deepEqual(linhas, []);
});

test("o resumo conta LINHAS, e não apontamentos", () => {
  /*
   * A linha 10 tem dois erros. O selo promete o tamanho do recorte: dizer "2" e
   * a grade abrir com uma linha só tem uma leitura possível — a ferramenta
   * perdeu uma.
   */
  const proposta = correcaoDeCampo(77, "VL_ICMS");
  const resumo = resumirRecorte(ACHADOS, [CORRECAO_DE_LINHA, proposta], [proposta]);

  assert.equal(resumo.linhasPorSeveridade.erro, 1);
  assert.equal(resumo.linhasPorSeveridade.alerta, 1);
  assert.equal(resumo.linhasPorSeveridade.info, 1);
  assert.equal(resumo.linhasPorSeveridade.critico, 0, "o agregado sem linha não conta");
  assert.equal(resumo.linhasComProposta, 1);
  assert.equal(resumo.linhasAprovadas, 1);
  assert.equal(resumo.linhasNovas, 1);
});

test("o recorte de colunas ignora apontamento que não aponta célula", () => {
  const campos = camposDoRecorte(ACHADOS, [], {
    severidades: ["erro", "info"],
    corrigidas: false,
  });
  assert.deepEqual([...campos].sort(), ["CFOP", "CST_ICMS"], "o info da linha 30 não tem campo");
});

test("o recorte de colunas soma os campos das correções aprovadas", () => {
  const campos = camposDoRecorte(ACHADOS, [correcaoDeCampo(77, "VL_ITEM")], {
    severidades: ["alerta"],
    corrigidas: true,
  });
  assert.deepEqual([...campos].sort(), ["VL_ICMS", "VL_ITEM"]);
});

test("marcar uma severidade preserva a ordem canônica, não a ordem dos cliques", () => {
  /*
   * É a ordem que o texto da tela lê em voz alta. Pela ordem dos cliques,
   * "alerta e erro" e "erro e alerta" seriam frases diferentes para o mesmo
   * recorte.
   */
  let recorte = alternarSeveridade(RECORTE_ABERTO, "info", true);
  recorte = alternarSeveridade(recorte, "erro", true);
  recorte = alternarSeveridade(recorte, "critico", true);

  assert.deepEqual([...recorte.severidades], ["critico", "erro", "info"]);
});

test("desmarcar tira só a severidade pedida", () => {
  let recorte = alternarSeveridade(RECORTE_ABERTO, "erro", true);
  recorte = alternarSeveridade(recorte, "alerta", true);
  recorte = alternarSeveridade(recorte, "erro", false);

  assert.deepEqual([...recorte.severidades], ["alerta"]);
});

test("marcar a mesma severidade duas vezes não a duplica", () => {
  let recorte = alternarSeveridade(RECORTE_ABERTO, "erro", true);
  recorte = alternarSeveridade(recorte, "erro", true);

  assert.deepEqual([...recorte.severidades], ["erro"]);
});

test("a célula fica com a severidade MAIS GRAVE apontada nela", () => {
  /*
   * Dois apontamentos no mesmo campo da mesma linha: pintar pelo último a
   * chegar faria a cor depender da ordem em que as regras rodaram, e um erro
   * apareceria como alerta só porque outra regra falou depois.
   */
  const marcas = marcarAuditoria([
    achado(10, "alerta", "CFOP"),
    achado(10, "erro", "CFOP"),
    achado(10, "info", "CFOP"),
  ]);

  assert.equal(marcas.celulas.get(chaveDaCelula(10, "CFOP")), "erro");
});

test("apontamento sem campo marca a LINHA, e nenhuma célula", () => {
  /*
   * "Documento sem registro analítico" fala do documento inteiro e não tem
   * coluna para pintar. Sem a marca de linha, ela apareceria no recorte por
   * "Erro" sem nada colorido — e a primeira pergunta seria "por que esta linha
   * está aqui?".
   */
  const marcas = marcarAuditoria([achado(30, "erro")]);

  assert.equal(marcas.linhas.get(30), "erro");
  assert.equal(marcas.celulas.size, 0);
  assert.equal(marcas.colunas.size, 0);
});

test("a marca da linha também é a mais grave, misturando com e sem campo", () => {
  const marcas = marcarAuditoria([achado(10, "alerta", "CFOP"), achado(10, "critico")]);
  assert.equal(marcas.linhas.get(10), "critico");
});

test("o apontamento agregado do arquivo não marca linha, mas conta para a coluna", () => {
  const marcas = marcarAuditoria([achado(0, "critico", "COD_VER")]);

  assert.equal(marcas.linhas.size, 0, "nl zero não é uma linha da grade");
  assert.equal(marcas.celulas.size, 0);
  assert.deepEqual(marcas.colunas.get("COD_VER"), { severidade: "critico", quantidade: 1 });
});

test("o selo da coluna soma os apontamentos e guarda o mais grave", () => {
  const marcas = marcarAuditoria([
    achado(10, "alerta", "VL_ICMS"),
    achado(20, "erro", "VL_ICMS"),
    achado(30, "info", "VL_ICMS"),
  ]);

  assert.deepEqual(marcas.colunas.get("VL_ICMS"), { severidade: "erro", quantidade: 3 });
});


test("o resumo separa o que já foi aprovado do que ainda espera decisão", () => {
  /*
   * Contar só as aprovadas fazia a tela dizer "Corrigidas 0" num arquivo com
   * três sugestões esperando — que se lê como "não há correção nenhuma".
   */
  const propostas = [
    correcaoDeCampo(10, "VL_ICMS"),
    correcaoDeCampo(20, "VL_BC_ICMS"),
    correcaoDeCampo(30, "CFOP"),
  ];
  const resumo = resumirRecorte([], propostas, [propostas[0]]);

  assert.equal(resumo.linhasComProposta, 3);
  assert.equal(resumo.linhasAprovadas, 1);
});

test("o recorte de correções alcança a linha que ainda não foi aprovada", () => {
  /*
   * A linha com sugestão por decidir é justamente a que precisa de atenção — a
   * aprovada já está resolvida. Alcançar só as aprovadas escondia o trabalho
   * que falta.
   */
  const linhas = linhasDoRecorte([], [correcaoDeCampo(42, "VL_ICMS")], {
    severidades: [],
    corrigidas: true,
  });

  assert.deepEqual(linhas, [42]);
});
