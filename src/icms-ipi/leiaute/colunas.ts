import { COLUNA_REGISTRO, definicaoDoRegistro } from "./acesso";
import { LAYOUT } from "./registros";
import type { TipoCampo } from "./tipos";

export interface ColunaGrade {
  /** Nome do campo no layout — é a chave do filtro, e não muda com o rótulo. */
  nome: string;
  titulo: string;
  tipo: TipoCampo;
  /** Registros do arquivo que possuem esta coluna. Vazio para a coluna sintética. */
  registros: string[];
}

/**
 * Ordem dos blocos na escrituração. `Object.keys` não serve: "9900" é uma chave
 * numérica canônica e o motor de JavaScript a devolve antes de "0000".
 */
const ORDEM_DOS_BLOCOS = "0BCDEGHK19";

function ordemDoRegistro(reg: string): number {
  const bloco = ORDEM_DOS_BLOCOS.indexOf(reg.charAt(0));
  return bloco === -1 ? ORDEM_DOS_BLOCOS.length : bloco;
}

/** Larguras iniciais por tipo: valor não precisa de 160px, descrição precisa de mais. */
const LARGURA_POR_TIPO: Readonly<Record<TipoCampo, number>> = {
  texto: 220,
  codigo: 130,
  valor: 120,
  quantidade: 120,
  aliquota: 100,
  data: 110,
};

export function larguraPadraoDe(coluna: { nome: string; tipo: TipoCampo }): number {
  if (coluna.nome === COLUNA_REGISTRO) return 110;
  return LARGURA_POR_TIPO[coluna.tipo] ?? 140;
}

/**
 * As colunas do planilhão: uma por informação distinta do arquivo.
 *
 * Campos com o mesmo nome em registros diferentes viram UMA coluna — CFOP é
 * CFOP, esteja ele no C170 ou no C190 —, que é o que permite filtrar por
 * informação em vez de por registro. Cada linha preenche apenas as colunas que
 * o seu registro possui; as demais ficam vazias.
 *
 * Só entram registros presentes no arquivo: um SPED de comércio não carrega as
 * colunas do bloco K só porque o dicionário as conhece.
 */
export function montarColunas(contagens: Record<string, number>): ColunaGrade[] {
  const presentes = Object.keys(LAYOUT)
    .filter((reg) => (contagens[reg] ?? 0) > 0)
    .sort((a, b) => ordemDoRegistro(a) - ordemDoRegistro(b) || a.localeCompare(b));

  const colunas: ColunaGrade[] = [
    { nome: COLUNA_REGISTRO, titulo: "Registro", tipo: "codigo", registros: [] },
  ];
  const porNome = new Map<string, ColunaGrade>();

  for (const reg of presentes) {
    const def = definicaoDoRegistro(reg);
    if (!def) continue;

    for (const campo of def.campos) {
      const existente = porNome.get(campo.nome);
      if (existente) {
        existente.registros.push(reg);
        continue;
      }
      const coluna: ColunaGrade = {
        nome: campo.nome,
        titulo: campo.titulo,
        tipo: campo.tipo,
        registros: [reg],
      };
      porNome.set(campo.nome, coluna);
      colunas.push(coluna);
    }
  }

  return colunas;
}

/**
 * Como uma coluna está vazia — e os dois casos NÃO são a mesma coisa.
 *
 * O worker só coleta, de cada linha, os campos do registro DAQUELA linha. Isso
 * separa dois estados que parecem iguais na tela e são opostos para quem
 * confere escrituração:
 *
 *  - `ausente`: nenhuma linha do recorte sequer POSSUI esta coluna. Filtrando
 *    por C170, a coluna VL_TOT_DEBITOS do E110 não se aplica — não há nada a
 *    conferir, e escondê-la é puro ganho de legibilidade.
 *
 *  - `emBranco`: as linhas possuem a coluna e ela está vazia em todas. O
 *    registro tem o campo e ninguém preencheu. Este é exatamente o caso que o
 *    contador precisa VER: o NCM que deveria estar no 0200 e não está, o CST
 *    que o gerador esqueceu. Esconder isso automaticamente transformaria a
 *    ausência de um dado obrigatório em invisibilidade — o erro mais caro que
 *    esta grade pode cometer.
 */
export interface EstadoDasColunas {
  /** Não se aplica ao recorte: nenhuma linha tem a coluna. Some sozinha. */
  readonly ausentes: ReadonlySet<string>;
  /** Tem a coluna e está em branco em todas as linhas. NUNCA some sozinha. */
  readonly emBranco: ReadonlySet<string>;
}

/**
 * Classifica as colunas a partir das opções que o worker já calcula para os
 * menus de filtro.
 *
 * ENQUANTO `opcoes` ESTÁ VAZIO devolve tudo vazio, de propósito. É o estado
 * entre abrir o arquivo e a primeira resposta do worker chegar; tratar isso
 * como "tudo ausente" faria a grade abrir com uma coluna só e piscar inteira
 * quando os valores chegassem.
 */
export function estadoDasColunas(
  colunas: readonly ColunaGrade[],
  opcoes: Readonly<Record<string, string[]>>
): EstadoDasColunas {
  const ausentes = new Set<string>();
  const emBranco = new Set<string>();
  if (Object.keys(opcoes).length === 0) return { ausentes, emBranco };

  for (const coluna of colunas) {
    if (coluna.nome === COLUNA_REGISTRO) continue;
    const valores = opcoes[coluna.nome];
    if (!valores || valores.length === 0) ausentes.add(coluna.nome);
    else if (valores.length === 1 && valores[0] === "") emBranco.add(coluna.nome);
  }
  return { ausentes, emBranco };
}

/**
 * As colunas que a grade desenha.
 *
 * Três nunca somem sozinhas, e as três exceções têm o mesmo motivo — esconder
 * o que o usuário precisa ver tira dele o controle da conferência:
 *  - a coluna do registro, que diz de onde a linha veio;
 *  - qualquer coluna com filtro ativo, mesmo que o filtro a tenha esvaziado;
 *  - as colunas EM BRANCO, que são campo existente e não preenchido — o
 *    achado, não o ruído.
 *
 * Some sozinha apenas o que NÃO SE APLICA ao recorte. Fora isso vale a decisão
 * explícita do usuário.
 */
export function colunasVisiveisDe(
  colunas: readonly ColunaGrade[],
  estado: EstadoDasColunas,
  escolha: Readonly<Record<string, boolean>>,
  comFiltro: ReadonlySet<string>
): ColunaGrade[] {
  return colunas.filter((coluna) => {
    if (coluna.nome === COLUNA_REGISTRO) return true;
    if (comFiltro.has(coluna.nome)) return true;
    // `escolha` vem de JSON.parse do localStorage. Indexar objeto literal com
    // chave que já foi conteúdo externo devolve coisa herdada do protótipo para
    // "constructor" ou "__proto__" — a mesma regra que vale para o dicionário.
    if (Object.hasOwn(escolha, coluna.nome)) return escolha[coluna.nome];
    return !estado.ausentes.has(coluna.nome);
  });
}
