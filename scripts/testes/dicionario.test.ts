/**
 * Testes do dicionário de regras — a ponte entre `src/regras/` e o leitor.
 *
 * O dicionário de `src/regras/icms-ipi/` é a fonte de verdade normativa, e o
 * layout de `src/icms-ipi/leiaute/` é o que o parser usa para quebrar a
 * linha. São dois arquivos, e é exatamente por isso que este teste existe: se
 * as duas fontes divergirem num índice, NADA quebra — o motor passa a ler o
 * campo vizinho e a auditoria aponta divergência falsa em massa sobre um
 * arquivo perfeitamente válido, calada, sem erro de compilação e sem teste
 * vermelho. Este arquivo é o teste vermelho que faltava.
 *
 * Rode com `npm run teste`.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { LAYOUT } from "../../src/icms-ipi/leiaute/registros";
import { DICIONARIO_SPED_ICMS_IPI } from "../../src/regras/icms-ipi/dicionario-sped-icms-ipi";
import { LEIAUTE_CONFERIDO } from "../../src/icms-ipi/leiaute/versao";
import {
  campoDe,
  codigoNormalizado,
  numeroDe,
  numeroOuNulo,
  posicaoDe,
  registroDe,
  tributacaoDoCstIcms,
} from "../../src/regras/nucleo/acesso";
import type { CampoSped } from "../../src/regras/nucleo/tipos";

const DICIONARIO = DICIONARIO_SPED_ICMS_IPI;
const LAYOUT_POR_REG: Record<string, { totalCampos: number; campos: readonly { nome: string; indice: number }[] }> =
  LAYOUT;

function todosOsCampos(): { reg: string; campo: CampoSped }[] {
  return Object.values(DICIONARIO.registros).flatMap((r) =>
    r.campos.map((campo) => ({ reg: r.reg, campo }))
  );
}

test("todo campo do dicionário tem a mesma posição que no layout do parser", () => {
  for (const registro of Object.values(DICIONARIO.registros)) {
    const doLayout = LAYOUT_POR_REG[registro.reg];
    if (!doLayout) continue; // registro que o parser ainda não conhece

    for (const campo of registro.campos) {
      const equivalente = doLayout.campos.find((c) => c.nome === campo.nome);
      assert.ok(
        equivalente,
        `${registro.reg}.${campo.nome} existe no dicionário e não no layout do parser`
      );
      assert.equal(
        campo.posicao,
        equivalente.indice,
        `${registro.reg}.${campo.nome}: dicionário diz ${campo.posicao}, layout diz ${equivalente.indice}`
      );
    }
  }
});

test("nenhum campo do layout ficou de fora do dicionário", () => {
  for (const registro of Object.values(DICIONARIO.registros)) {
    const doLayout = LAYOUT_POR_REG[registro.reg];
    if (!doLayout) continue;

    for (const campo of doLayout.campos) {
      assert.ok(
        registro.campos.some((c) => c.nome === campo.nome),
        `${registro.reg}.${campo.nome} existe no layout e não no dicionário`
      );
    }
  }
});

/**
 * Registros que o parser conhece e a norma ainda não descreve.
 *
 * A lista é explícita de propósito: acrescentar registro ao layout sem
 * descrevê-lo no dicionário passa a exigir uma decisão consciente, registrada
 * aqui, em vez de acontecer por esquecimento.
 */
const REGISTROS_SEM_DICIONARIO = new Set([
  // Abertura e fechamento de bloco: um campo cada, sem regra fiscal própria.
  "0001", "0990", "B001", "B990", "C001", "C990", "D001", "D990",
  "E001", "E990", "G001", "G990", "H001", "H990", "K001", "K990",
  "1001", "1990", "9001", "9990", "9999",
  // Cadastros e apuração já usados pelo parser, ainda não descritos na norma.
  "0190", "0400", "0450", "E110", "9900",
]);

test("nenhum registro entra no layout sem decisão sobre a norma", () => {
  /*
   * O teste de posição só enxerga registro que está no dicionário. Um registro
   * que exista APENAS no layout escapa de toda conferência — foi o que
   * aconteceu quando os abridores e fechadores de bloco entraram: ganharam
   * índice e coluna na grade sem ninguém decidir se tinham regra fiscal.
   *
   * Aqui a direção é a inversa: varre o LAYOUT e cobra uma decisão para cada
   * registro. Ou ele está no dicionário, ou está na lista acima, com o motivo.
   */
  for (const reg of Object.keys(LAYOUT_POR_REG)) {
    const descrito = reg in DICIONARIO.registros;
    assert.ok(
      descrito || REGISTROS_SEM_DICIONARIO.has(reg),
      `${reg} está no layout do parser e não foi descrito no dicionário nem declarado em REGISTROS_SEM_DICIONARIO`
    );
  }
});

test("a lista de registros sem dicionário não guarda entrada morta", () => {
  // Uma lista de exceções que ninguém poda vira permissão permanente.
  for (const reg of REGISTROS_SEM_DICIONARIO) {
    assert.ok(
      reg in LAYOUT_POR_REG,
      `${reg} está dispensado do dicionário mas não existe mais no layout — remova da lista`
    );
    assert.ok(
      !(reg in DICIONARIO.registros),
      `${reg} já foi descrito no dicionário — remova-o de REGISTROS_SEM_DICIONARIO`
    );
  }
});

test("a contagem de campos converte corretamente para a do parser", () => {
  /*
   * O layout conta REG + campos de dados, porque é o número que o parser
   * compara contra `campos.length - 2`. O dicionário conta só os dados. A
   * diferença é sempre exatamente 1 — e é a razão de os dois campos terem
   * nomes diferentes.
   */
  for (const registro of Object.values(DICIONARIO.registros)) {
    const doLayout = LAYOUT_POR_REG[registro.reg];
    if (!doLayout) continue;

    assert.equal(
      registro.totalCamposDeDados + 1,
      doLayout.totalCampos,
      `${registro.reg}: ${registro.totalCamposDeDados} + 1 deveria ser ${doLayout.totalCampos}`
    );
  }
});

test("as posições são contíguas a partir de 2, sem buraco nem repetição", () => {
  for (const registro of Object.values(DICIONARIO.registros)) {
    const posicoes = registro.campos.map((c) => c.posicao);
    const esperadas = Array.from({ length: registro.totalCamposDeDados }, (_, i) => i + 2);
    assert.deepEqual(
      [...posicoes].sort((a, b) => a - b),
      esperadas,
      `${registro.reg}: as posições não formam a sequência 2..${registro.totalCamposDeDados + 1}`
    );
  }
});

test("todo campo obrigatório condicional declara a condição", () => {
  /*
   * É o invariante mais importante do dicionário. Um `OC` sem condição deixa o
   * motor sem critério, e ele só tem duas saídas — tratar como `O`, que reprova
   * escrituração legítima em massa, ou tratar como `N`, que deixa passar
   * omissão real. As duas estão erradas.
   */
  for (const { reg, campo } of todosOsCampos()) {
    if (campo.obrigatorio !== "OC") continue;
    assert.ok(
      campo.condicao && campo.condicao.trim() !== "",
      `${reg}.${campo.nome} é OC e não diz quando passa a ser exigido`
    );
  }
});

test("nenhum domínio fechado declara valor repetido", () => {
  for (const { reg, campo } of todosOsCampos()) {
    if (!campo.valoresValidos) continue;
    const valores = campo.valoresValidos.map((v) => v.valor);
    assert.equal(
      new Set(valores).size,
      valores.length,
      `${reg}.${campo.nome} tem valor repetido no domínio`
    );
  }
});

test("os códigos de regra são únicos em todo o dicionário", () => {
  /*
   * Duas regras com o mesmo código fazem o teto de achados de uma consumir o da
   * outra, e tornam o achado impossível de rastrear até sua origem.
   */
  const vistos = new Map<string, string>();
  const registrar = (id: string, onde: string) => {
    const anterior = vistos.get(id);
    assert.ok(!anterior, `código de regra ${id} aparece em ${anterior} e em ${onde}`);
    vistos.set(id, onde);
  };

  for (const registro of Object.values(DICIONARIO.registros)) {
    for (const regra of registro.regrasDoRegistro ?? []) registrar(regra.id, registro.reg);
    for (const campo of registro.campos) {
      if (campo.regraRelacional) registrar(campo.regraRelacional.id, `${registro.reg}.${campo.nome}`);
      for (const regra of campo.regrasValidacaoCustomizadas ?? []) {
        registrar(regra.id, `${registro.reg}.${campo.nome}`);
      }
    }
  }
});

test("toda regra que compara valores declara tolerância", () => {
  /*
   * Comparar somatórios de centavos com igualdade exata é o erro mais caro que
   * este motor pode cometer: uma nota com cem itens acumula diferença de
   * arredondamento legítima, e a auditoria passaria a acusar divergência de
   * totalizador em praticamente todo documento grande de toda escrituração.
   */
  for (const registro of Object.values(DICIONARIO.registros)) {
    for (const regra of registro.regrasDoRegistro ?? []) {
      if (!regra.expressao.includes("≈")) continue;
      assert.ok(
        typeof regra.tolerancia === "number" && regra.tolerancia > 0,
        `${regra.id} compara valores por aproximação e não declara tolerância`
      );
    }
  }
});

test("campo marcado como inferido nunca gera regra de severidade erro", () => {
  /*
   * Procedência não é enfeite: achado apoiado em campo que ninguém conferiu
   * contra a fonte normativa não pode chegar ao usuário com a mesma autoridade
   * de um achado conferido.
   */
  for (const registro of Object.values(DICIONARIO.registros)) {
    for (const regra of registro.regrasDoRegistro ?? []) {
      if (regra.procedencia !== "inferido") continue;
      assert.notEqual(
        regra.severidade,
        "critico",
        `${regra.id} é inferida e mesmo assim tem severidade crítica`
      );
    }
  }
});

test("a versão do dicionário acompanha a do layout conferido", () => {
  assert.equal(
    DICIONARIO.versaoLeiaute,
    LEIAUTE_CONFERIDO,
    "o dicionário e o layout do leitor apontam para versões de leiaute diferentes"
  );
});

test("o acesso resolve posição e campo pelo nome", () => {
  assert.equal(posicaoDe(DICIONARIO, "C170", "CFOP"), 11);
  assert.equal(posicaoDe(DICIONARIO, "C170", "CST_ICMS"), 10);
  assert.equal(posicaoDe(DICIONARIO, "C100", "VL_DOC"), 12);
  assert.equal(posicaoDe(DICIONARIO, "C190", "VL_IPI"), 11);
  // Campo que não existe no registro devolve null, e não zero.
  assert.equal(posicaoDe(DICIONARIO, "C190", "COD_ITEM"), null);
  assert.equal(campoDe(DICIONARIO, "0200", "TIPO_ITEM")?.tipo, "N");
  assert.equal(registroDe(DICIONARIO, "0000")?.bloco, "0");
});

test("o acesso não se deixa envenenar pelo protótipo de Object", () => {
  /*
   * Uma linha `|constructor|…` num arquivo corrompido — ou malicioso — indexa o
   * dicionário com uma chave herdada. Com objeto literal isso devolve algo
   * truthy sem `campos`, e a primeira leitura derruba o parse inteiro.
   */
  assert.equal(registroDe(DICIONARIO, "constructor"), undefined);
  assert.equal(registroDe(DICIONARIO, "__proto__"), undefined);
  assert.equal(posicaoDe(DICIONARIO, "toString", "CFOP"), null);
});

test("números do SPED são lidos com vírgula decimal", () => {
  assert.equal(numeroDe("100,00"), 100);
  assert.equal(numeroDe("0,0000"), 0);
  assert.equal(numeroDe("-18,50"), -18.5);
  // Campo vazio vale zero — é a leitura correta do leiaute num campo de valor.
  assert.equal(numeroDe(""), 0);
  // Texto que não é número devolve null, e aí sim é achado de tipo.
  assert.equal(numeroDe("ABC"), null);
  // Ponto não é separador decimal no SPED: "1.234" não é 1,234.
  assert.equal(numeroDe("1.234"), null);
});

test("numeroOuNulo distingue campo omitido de campo zerado", () => {
  /*
   * A `ALIQ_ICMS` do 0200 vazia significa "o cadastro não informou", e não "a
   * alíquota é 0%". Quem usar `numeroDe` ali conclui zero e acusa de isento um
   * item tributado.
   */
  assert.equal(numeroOuNulo(""), null);
  assert.equal(numeroOuNulo("0,00"), 0);
  assert.equal(numeroOuNulo(null), undefined);
  assert.equal(numeroOuNulo("18,00"), 18);
});

test("a tributação do ICMS sai dos dois últimos dígitos do CST", () => {
  /*
   * Comparar o CST inteiro contra "40" nunca casa: o valor real é "040" ou
   * "140". A regra não dispara, não quebra e não aparece em teste — ela
   * simplesmente deixa de existir.
   */
  assert.equal(tributacaoDoCstIcms("000"), "00");
  assert.equal(tributacaoDoCstIcms("140"), "40");
  assert.equal(tributacaoDoCstIcms("260"), "60");
  assert.equal(tributacaoDoCstIcms("40"), null, "CST de 2 dígitos não é CST de ICMS");
  assert.equal(tributacaoDoCstIcms(""), null);
});

test("códigos de domínio são normalizados antes de comparar", () => {
  // Gerador que trata TIPO_ITEM como número grava |0| em vez de |00|.
  assert.equal(codigoNormalizado("0", 2), "00");
  assert.equal(codigoNormalizado("00", 2), "00");
  assert.equal(codigoNormalizado(" 9 ", 2), "09");
});

test("correção não automatizável sempre diz por quê", () => {
  /*
   * O texto do motivo é o que a UI mostra no lugar do botão de corrigir. Sem
   * ele o contador vê "correção manual" e não sabe o que fazer — que é pior do
   * que não ter marcado nada, porque parece resposta.
   */
  for (const registro of Object.values(DICIONARIO.registros)) {
    for (const regra of registro.regrasDoRegistro ?? []) {
      const correcao = regra.correcao;
      if (!correcao || correcao.automatizavel) continue;
      assert.ok(
        correcao.motivo && correcao.motivo.trim() !== "",
        `${regra.id} diz que não é automatizável e não explica por quê`
      );
    }
  }
});

test("correção automatizável nunca depende de juízo fiscal", () => {
  /*
   * A régua é conservadora de propósito: o TXT vai assinado para a Receita.
   * Só se automatiza o que se recalcula do próprio arquivo — nunca o que vem
   * de tabela externa ou de decisão de quem assina.
   */
  for (const registro of Object.values(DICIONARIO.registros)) {
    for (const regra of registro.regrasDoRegistro ?? []) {
      const correcao = regra.correcao;
      if (!correcao?.automatizavel) continue;
      assert.equal(
        correcao.origemDoValor,
        "calculado",
        `${regra.id} é automatizável mas o valor não vem de cálculo sobre o próprio arquivo`
      );
      assert.equal(
        correcao.exigeConfirmacao,
        false,
        `${regra.id} é automatizável e ao mesmo tempo exige confirmação — decida`
      );
    }
  }
});

test("o dicionário declara honestamente o que ainda não foi conferido", () => {
  assert.ok(
    DICIONARIO.pendenciasDeConferencia.length > 0,
    "um dicionário sem pendências ou foi inteiramente conferido, ou está fingindo certeza"
  );
});
