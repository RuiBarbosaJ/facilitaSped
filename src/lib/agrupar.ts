import type { RegistroSped } from "@/types/sped";

/** Uma regra tributária com todos os NCMs que ela abrange. */
export interface RegraAgrupada {
  chave: string;
  ncms: string[];
  descricao: string;
  cst: string;
  aliquota: string;
  natureza_receita?: string;
  tabela?: string;
  data_inicio?: string;
  data_fim?: string;
}

/**
 * O que faz duas linhas serem a mesma regra: mesma tabela de origem, mesma
 * natureza da receita, mesmo CST, mesma descrição, mesma alíquota e mesma
 * vigência. Só o NCM difere.
 */
function chaveDaRegra(registro: RegistroSped): string {
  return [
    registro.tabela ?? "",
    registro.natureza_receita ?? "",
    registro.cst,
    registro.descricao,
    registro.aliquota,
    registro.data_inicio ?? "",
    registro.data_fim ?? "",
  ].join("|");
}

/**
 * Junta numa linha só os registros que são a mesma regra com NCMs diferentes.
 *
 * O portal publica uma regra que cita vários NCMs, e o robô a desdobra em um
 * registro por NCM justamente para que a busca encontre qualquer um deles. Isso
 * é bom para pesquisar e ruim para ler: a tela repetia a mesma descrição dez
 * vezes seguidas. O agrupamento acontece aqui, na exibição, DEPOIS da busca —
 * o índice do Fuse continua vendo cada NCM separadamente, então nenhuma consulta
 * deixa de encontrar o que encontrava antes.
 *
 * Registros sem natureza da receita (as definições de CST da tabela 4.3.3) nunca
 * são agrupados: cada um é uma linha por si.
 *
 * A ordem de entrada é preservada — quando os resultados vêm ranqueados pela
 * busca, o grupo aparece na posição do seu registro mais relevante.
 */
export function agruparRegras(registros: RegistroSped[]): RegraAgrupada[] {
  const grupos = new Map<string, RegraAgrupada>();

  registros.forEach((registro, indice) => {
    const agrupavel = Boolean(registro.natureza_receita);
    const chave = agrupavel ? chaveDaRegra(registro) : `avulso:${indice}`;

    const existente = grupos.get(chave);
    if (existente) {
      if (registro.ncm && !existente.ncms.includes(registro.ncm)) {
        existente.ncms.push(registro.ncm);
      }
      return;
    }

    grupos.set(chave, {
      chave,
      ncms: registro.ncm ? [registro.ncm] : [],
      descricao: registro.descricao,
      cst: registro.cst,
      aliquota: registro.aliquota,
      natureza_receita: registro.natureza_receita,
      tabela: registro.tabela,
      data_inicio: registro.data_inicio,
      data_fim: registro.data_fim,
    });
  });

  return Array.from(grupos.values());
}
