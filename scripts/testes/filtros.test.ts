/**
 * Testes do menu de filtro de coluna.
 *
 * O comportamento do clique mudou depois de uma queixa concreta: com o menu
 * abrindo de caixas vazias, o primeiro clique INCLUÍA. Quem quisesse tirar um
 * CFOP da vista — o que o contador faz o tempo todo — precisava marcar todos os
 * outros um a um. Estes testes travam a regra nova e, principalmente, os dois
 * casos em que ela precisa voltar sozinha para "sem filtro".
 *
 * Rode com `npm run teste`.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  alternarValor,
  estaMarcado,
  somenteValor,
  SEM_VALOR,
  filtrarPorColunas,
  opcoesDaColuna,
  type ColunaFiltravel,
} from "../../src/comum/filtrosColuna";

const CFOPS = ["1102", "5102", "5152", "6102"];

test("sem filtro, toda caixa aparece marcada", () => {
  // É a verdade sobre os dados: nenhum valor está sendo escondido.
  for (const cfop of CFOPS) assert.equal(estaMarcado([], cfop), true);
});

test("com todos marcados, clicar em um valor EXCLUI só aquele", () => {
  // A queixa que originou a mudança: antes isto devolvia ["5152"].
  const novo = alternarValor(CFOPS, [], "5152");
  assert.deepEqual(novo, ["1102", "5102", "6102"]);
  assert.equal(estaMarcado(novo!, "5152"), false);
  assert.equal(estaMarcado(novo!, "1102"), true);
});

test("excluir um segundo valor tira os dois, e não recomeça a seleção", () => {
  const um = alternarValor(CFOPS, [], "5152")!;
  const dois = alternarValor(CFOPS, um, "6102")!;
  assert.deepEqual(dois, ["1102", "5102"]);
});

test("marcar de volta o último que faltava vira 'sem filtro'", () => {
  /*
   * Guardar a lista inteira daria a mesma tabela hoje e uma diferente amanhã:
   * ela congelaria os valores de agora e passaria a esconder qualquer valor
   * novo que aparecesse depois, sem o usuário ter excluído nada.
   */
  const semUm = alternarValor(CFOPS, [], "5152")!;
  const deVolta = alternarValor(CFOPS, semUm, "5152");
  assert.equal(deVolta, null);
});

test("desmarcar o último valor volta para 'sem filtro', nunca para tabela em branco", () => {
  const so5102 = somenteValor(CFOPS, "5102")!;
  assert.deepEqual(so5102, ["5102"]);
  assert.equal(alternarValor(CFOPS, so5102, "5102"), null);
});

test("'só este' isola um valor num gesto", () => {
  assert.deepEqual(somenteValor(CFOPS, "5102"), ["5102"]);
});

test("'só este' numa coluna de valor único não cria filtro inútil", () => {
  // Filtrar por um valor quando só existe um não muda nada — e deixaria o
  // selo de filtro aceso na coluna sem motivo.
  assert.equal(somenteValor(["1102"], "1102"), null);
});

test("a exclusão de fato tira as linhas daquele valor da tabela", () => {
  interface Linha {
    cfop: string;
  }
  const colunas: ColunaFiltravel<Linha>[] = [
    { id: "cfop", rotulo: "CFOP", valores: (l) => [l.cfop] },
  ];
  const linhas: Linha[] = [
    { cfop: "1102" },
    { cfop: "5102" },
    { cfop: "5152" },
    { cfop: "5152" },
  ];

  const opcoes = opcoesDaColuna(linhas, colunas, {}, "cfop");
  const semTransferencia = alternarValor(opcoes, [], "5152")!;

  const visiveis = filtrarPorColunas(linhas, colunas, { cfop: semTransferencia });
  assert.equal(visiveis.length, 2);
  assert.ok(visiveis.every((l) => l.cfop !== "5152"));
});

test("(Vazio) é excluível como qualquer outro valor", () => {
  // Célula vazia é um valor de filtro legítimo: "me mostre tudo que TEM NCM"
  // é exatamente excluir o (Vazio).
  const opcoes = ["1102", SEM_VALOR];
  const novo = alternarValor(opcoes, [], SEM_VALOR);
  assert.deepEqual(novo, ["1102"]);
});
