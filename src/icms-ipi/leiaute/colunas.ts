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
