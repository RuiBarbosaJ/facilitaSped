/**
 * Filtros de coluna estilo Excel — o mesmo motor para a Consulta e a Auditoria.
 *
 * Antes cada tela reimplementava a extração do valor da célula (uma vez para
 * montar o menu, outra para filtrar) e as duas versões saíam do lugar. Aqui a
 * coluna declara UMA função `valores` e ela serve aos dois usos, então o menu
 * nunca oferece uma opção que o filtro não reconhece.
 *
 * Duas regras dão o comportamento que se espera de uma planilha:
 *
 * - dentro de uma coluna vale OU — a célula pode listar mais de um código (uma
 *   regra do SPED cita até 27 NCMs) e a linha entra se QUALQUER um deles
 *   estiver marcado;
 * - entre colunas vale E — cada filtro estreita o anterior.
 *
 * E uma regra que resolve a maior queixa da versão anterior: seleção vazia
 * significa "sem filtro", nunca "nenhuma linha". Desmarcar tudo não pode ser o
 * caminho para uma tabela em branco.
 */

/** Valor de uma célula vazia. O menu mostra "(Vazio)" e ele é filtrável. */
export const SEM_VALOR = "";

export interface ColunaFiltravel<T> {
  /**
   * Chave do filtro. Não é o rótulo: acertar o texto de uma coluna não pode
   * invalidar silenciosamente o filtro que o usuário já tinha aplicado.
   */
  id: string;
  rotulo: string;
  /**
   * Valores atômicos da célula. Ausente na coluna que não vira menu — texto
   * livre (descrição da regra, nome do produto) renderia uma opção por linha,
   * e para esse caso a busca serve melhor.
   */
  valores?: (item: T) => string[];
}

/** Seleção por coluna, indexada pelo `id`. Coluna ausente = coluna sem filtro. */
export type FiltrosColuna = Record<string, string[]>;

/** Ordena números como números ("9" antes de "10") e texto como o pt-BR espera. */
const COLLATOR = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

/** "(Vazio)" vai para o fim da lista: é ruído, não uma opção que se procura. */
export function compararValores(a: string, b: string): number {
  if (a === b) return 0;
  if (a === SEM_VALOR) return 1;
  if (b === SEM_VALOR) return -1;
  return COLLATOR.compare(a, b);
}

/**
 * Valores da célula já normalizados. Espaço nas pontas e duplicatas viram ruído
 * no menu ("06" e "06 " seriam duas opções); célula sem nada vira `SEM_VALOR`
 * para que "(Vazio)" também possa ser escolhido.
 */
function valoresDe<T>(coluna: ColunaFiltravel<T>, item: T): string[] {
  if (!coluna.valores) return [];
  const limpos = new Set<string>();
  for (const bruto of coluna.valores(item)) {
    const valor = String(bruto ?? "").trim();
    if (valor) limpos.add(valor);
  }
  return limpos.size > 0 ? Array.from(limpos) : [SEM_VALOR];
}

interface FiltroAtivo<T> {
  coluna: ColunaFiltravel<T>;
  escolhidos: Set<string>;
}

/** Só entram as colunas que existem, sabem extrair valor e têm seleção. */
function ativos<T>(
  colunas: ColunaFiltravel<T>[],
  filtros: FiltrosColuna,
  exceto?: string
): FiltroAtivo<T>[] {
  const lista: FiltroAtivo<T>[] = [];
  for (const coluna of colunas) {
    if (!coluna.valores || coluna.id === exceto) continue;
    const escolhidos = filtros[coluna.id];
    if (!escolhidos || escolhidos.length === 0) continue;
    lista.push({ coluna, escolhidos: new Set(escolhidos) });
  }
  return lista;
}

function passa<T>(item: T, filtros: FiltroAtivo<T>[]): boolean {
  return filtros.every(({ coluna, escolhidos }) =>
    valoresDe(coluna, item).some((valor) => escolhidos.has(valor))
  );
}

/** Aplica todos os filtros de coluna. Sem filtro ativo devolve a lista original. */
export function filtrarPorColunas<T>(
  itens: T[],
  colunas: ColunaFiltravel<T>[],
  filtros: FiltrosColuna
): T[] {
  const lista = ativos(colunas, filtros);
  if (lista.length === 0) return itens;
  return itens.filter((item) => passa(item, lista));
}

/**
 * As opções do menu de uma coluna: os valores que sobram depois de aplicar os
 * filtros das OUTRAS colunas — nunca o da própria, senão o menu esconderia
 * justamente o que ainda dá para marcar.
 *
 * É o que faltava antes. O menu listava todos os valores do arquivo, então
 * marcar um valor numa segunda coluna quase sempre caía numa interseção vazia
 * e a tabela zerava sem explicação. Agora toda opção oferecida devolve pelo
 * menos uma linha.
 */
export function opcoesDaColuna<T>(
  itens: T[],
  colunas: ColunaFiltravel<T>[],
  filtros: FiltrosColuna,
  id: string
): string[] {
  const alvo = colunas.find((coluna) => coluna.id === id);
  if (!alvo?.valores) return [];

  const outras = ativos(colunas, filtros, id);
  const vistos = new Set<string>();
  for (const item of itens) {
    if (!passa(item, outras)) continue;
    for (const valor of valoresDe(alvo, item)) vistos.add(valor);
  }
  return Array.from(vistos).sort(compararValores);
}

/**
 * Descarta seleções que os dados não têm mais.
 *
 * Os filtros guardam o texto do valor e sobrevivem à troca da busca, do CST e
 * até à navegação entre as rotas. Sem esta limpeza um valor que sumiu deixava a
 * tabela vazia sem explicação: o usuário via "0 linhas" e nenhum filtro visível
 * para desfazer. Colunas que deixaram de existir (a Alíquota some quando
 * nenhuma regra tem alíquota) caem aqui pelo mesmo motivo.
 *
 * Devolve o próprio objeto recebido quando nada mudou — a identidade estável
 * evita recalcular a tabela inteira a cada render.
 */
export function sanearFiltros<T>(
  itens: T[],
  colunas: ColunaFiltravel<T>[],
  filtros: FiltrosColuna
): FiltrosColuna {
  const chaves = Object.keys(filtros);
  if (chaves.length === 0) return filtros;

  const disponiveis = new Map<string, Set<string>>();
  for (const coluna of colunas) {
    if (coluna.valores && chaves.includes(coluna.id)) disponiveis.set(coluna.id, new Set());
  }
  if (disponiveis.size > 0) {
    for (const item of itens) {
      for (const coluna of colunas) {
        const conjunto = disponiveis.get(coluna.id);
        if (!conjunto) continue;
        for (const valor of valoresDe(coluna, item)) conjunto.add(valor);
      }
    }
  }

  const saneados: FiltrosColuna = {};
  let mudou = false;
  for (const chave of chaves) {
    const conjunto = disponiveis.get(chave);
    if (!conjunto) {
      mudou = true;
      continue;
    }
    const validos = filtros[chave].filter((valor) => conjunto.has(valor));
    if (validos.length === 0) {
      mudou = true;
      continue;
    }
    if (validos.length !== filtros[chave].length) mudou = true;
    saneados[chave] = validos;
  }
  return mudou ? saneados : filtros;
}

/**
 * O que a seleção vira quando o usuário clica na caixa de um valor.
 *
 * A regra de dado não mudou — `filtros[coluna]` continua sendo a lista de
 * valores que PASSAM, e lista ausente continua significando "todos passam".
 * O que mudou foi o que o clique quer dizer, e é uma diferença que muda o uso
 * inteiro do menu:
 *
 * Antes, sem filtro nenhum as caixas apareciam VAZIAS, então o primeiro clique
 * INCLUÍA — marcar "5102" queria dizer "quero ver só o 5102". Para tirar um
 * CFOP da vista, que é o que o contador faz o tempo todo ("quero tudo menos
 * transferência"), ele precisava marcar todos os outros um a um.
 *
 * Agora, sem filtro as caixas aparecem MARCADAS — que é a verdade: todos os
 * valores estão passando. O clique então EXCLUI, como em qualquer planilha.
 * Para isolar um único valor existe o atalho "só este", que é o outro caso de
 * uso e continua a um clique de distância.
 *
 * Dois estados são normalizados de volta para "sem filtro" (`null`), porque
 * guardar a lista inteira seria a mesma coisa com pior consequência: ela
 * congelaria os valores de agora e passaria a esconder qualquer valor novo que
 * aparecesse depois, sem o usuário ter excluído nada.
 *  - marcar de volta o último valor que faltava;
 *  - desmarcar todos, que deixaria a tabela em branco sem o usuário ter pedido.
 */
export function alternarValor(
  opcoes: readonly string[],
  selecao: readonly string[],
  valor: string
): string[] | null {
  // Sem filtro, todo valor está passando — então a base do clique é tudo.
  const base = selecao.length === 0 ? opcoes : selecao;
  const marcado = base.includes(valor);
  const novo = marcado ? base.filter((v) => v !== valor) : [...base, valor];

  if (novo.length === 0) return null;
  // Todas as opções marcadas é o mesmo que nenhum filtro — e envelhece melhor.
  if (novo.length >= opcoes.length && opcoes.every((o) => novo.includes(o))) return null;
  return novo;
}

/**
 * A seleção que isola um único valor: o atalho "só este".
 *
 * Existe porque, com o clique da caixa passando a excluir, ver um valor
 * sozinho deixaria de caber num gesto — e é metade do uso do menu.
 */
export function somenteValor(opcoes: readonly string[], valor: string): string[] | null {
  // Coluna de um valor só já está isolada; filtrar não muda nada.
  return opcoes.length === 1 ? null : [valor];
}

/**
 * Se a caixa daquele valor deve aparecer marcada.
 *
 * Sem filtro, TODAS aparecem marcadas: é o que de fato acontece com os dados.
 */
export function estaMarcado(selecao: readonly string[], valor: string): boolean {
  return selecao.length === 0 || selecao.includes(valor);
}

/** Quantas colunas estão filtrando agora — para o contador da barra de filtros. */
export function contarFiltrosAtivos(filtros: FiltrosColuna): number {
  return Object.values(filtros).filter((valores) => valores.length > 0).length;
}
