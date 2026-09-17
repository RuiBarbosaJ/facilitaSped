import type { Severidade } from "../../nucleo/tipos";

/**
 * As duas tabelas que compõem o CST do ICMS, e a matriz de exigências de valor
 * que decorre delas.
 *
 * O CST_ICMS do C170 e do C190 é `N(3)`: UM dígito de origem (Tabela A) mais
 * DOIS de tributação (Tabela B). Separar as duas metades não é preciosismo de
 * modelagem — é o que torna a conferência possível. O domínio completo teria 99
 * combinações, e listá-lo como `valoresValidos` no dicionário esconderia qual
 * das duas metades está errada justamente no achado que o contador precisa ler.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE A MATRIZ É DADO, E NÃO UMA CADEIA DE `if`
 *
 * A matriz do § 3 do guia de referência diz, para cada tributação, se os quatro
 * campos de valor do item (base e imposto próprios, base e imposto retidos por
 * substituição) são obrigatórios, proibidos ou livres. Escrita como código, ela
 * vira quinze blocos `case` que só um programador audita. Escrita como dado,
 * um contador lê a tabela inteira numa tela e diz "esta linha está errada" —
 * que é exatamente a revisão de que ela precisa.
 *
 * A SEVERIDADE viaja junto com cada linha, e não com a regra, porque a mesma
 * afirmação tem forças diferentes conforme a tributação: exigir imposto próprio
 * em CST 00 é regra do Guia Prático; exigir ST na ENTRADA com CST 10 não vale,
 * porque quem retém é o remetente. Uma severidade única para a regra inteira
 * obrigaria a escolher entre calar sobre o primeiro caso e gritar sobre o
 * segundo.
 */

/** Origem da mercadoria — primeiro dígito do CST (Tabela A). */
export const ORIGENS_DA_MERCADORIA: ReadonlyMap<string, string> = new Map([
  ["0", "Nacional, exceto as indicadas nos códigos 3, 4, 5 e 8"],
  ["1", "Estrangeira — importação direta, exceto a indicada no código 6"],
  ["2", "Estrangeira — adquirida no mercado interno, exceto a indicada no código 7"],
  ["3", "Nacional com conteúdo de importação superior a 40% e até 70%"],
  ["4", "Nacional cujo processo produtivo básico esteja previsto na legislação de incentivo"],
  ["5", "Nacional com conteúdo de importação igual ou inferior a 40%"],
  ["6", "Estrangeira — importação direta, sem similar nacional (lista CAMEX e gás natural)"],
  ["7", "Estrangeira — mercado interno, sem similar nacional (lista CAMEX e gás natural)"],
  ["8", "Nacional com conteúdo de importação superior a 70%"],
]);

/** O que a norma exige de um campo de valor diante de uma tributação. */
export type ExigenciaDeValor =
  /** Precisa vir maior que zero. */
  | "obrigatorio"
  /** Precisa vir zerado (ou vazio, que vale zero). */
  | "proibido"
  /** A norma não decide sozinha: depende do CFOP, da UF ou do caso concreto. */
  | "livre";

export interface ExigenciaDeCampo {
  readonly exigencia: ExigenciaDeValor;
  /** Com que força o achado chega ao contador quando a exigência é violada. */
  readonly severidade: Severidade;
  /** Código do achado emitido. Amarra a linha da matriz à regra do dicionário. */
  readonly codigo: string;
}

export interface TributacaoDoIcms {
  /** Os dois últimos dígitos do CST. */
  readonly tributacao: string;
  readonly descricao: string;
  /** Exigência sobre VL_BC_ICMS e VL_ICMS — o imposto próprio. */
  readonly proprio: ExigenciaDeCampo;
  /** Exigência sobre VL_BC_ICMS_ST e VL_ICMS_ST — o imposto retido. */
  readonly substituicao: ExigenciaDeCampo;
  /** A tributação implica redução de base: o C190 deve trazer VL_RED_BC > 0. */
  readonly reduzBase?: boolean;
  readonly observacao?: string;
}

const EXIGE_PROPRIO: ExigenciaDeCampo = {
  exigencia: "obrigatorio",
  severidade: "erro",
  codigo: "FIS-C170-010",
};
const PROIBE_PROPRIO: ExigenciaDeCampo = {
  exigencia: "proibido",
  severidade: "erro",
  codigo: "FIS-C170-011",
};
/**
 * Proíbe o imposto próprio, mas só como alerta.
 *
 * Usada onde a proibição é real e a prática diverge: CST 60 admite destaque em
 * algumas UF para instruir pedido de ressarcimento, e os códigos monofásicos de
 * combustível são recentes o bastante para que os geradores ainda escrevam
 * coisas diferentes no mesmo campo. Erro duro aqui reprovaria escrituração
 * aceita pelo PVA.
 */
const PROIBE_PROPRIO_COM_RESSALVA: ExigenciaDeCampo = {
  exigencia: "proibido",
  severidade: "alerta",
  codigo: "FIS-C170-015",
};
const EXIGE_ST: ExigenciaDeCampo = {
  exigencia: "obrigatorio",
  severidade: "alerta",
  codigo: "FIS-C170-014",
};
const PROIBE_ST: ExigenciaDeCampo = {
  exigencia: "proibido",
  severidade: "alerta",
  codigo: "FIS-C170-017",
};
const ST_LIVRE: ExigenciaDeCampo = {
  exigencia: "livre",
  severidade: "info",
  codigo: "FIS-C170-017",
};
const PROPRIO_LIVRE: ExigenciaDeCampo = {
  exigencia: "livre",
  severidade: "info",
  codigo: "FIS-C170-010",
};

/**
 * Tabela B — tributação pelo ICMS, com a exigência de cada par de campos.
 *
 * Os códigos 02, 15, 53 e 61 são os da tributação monofásica de combustíveis
 * (Convênio ICMS 199/22). Entram com exigência `livre` sobre o imposto próprio:
 * a tributação ali é POR UNIDADE DE MEDIDA (ad rem), o que zera a base
 * percentual sem zerar o imposto — e uma regra que exigisse base positiva
 * acusaria de erro toda distribuidora de combustível.
 */
export const TRIBUTACOES_DO_ICMS: readonly TributacaoDoIcms[] = [
  {
    tributacao: "00",
    descricao: "Tributada integralmente",
    proprio: EXIGE_PROPRIO,
    substituicao: PROIBE_ST,
  },
  {
    tributacao: "02",
    descricao: "Tributação monofásica própria sobre combustíveis",
    proprio: PROPRIO_LIVRE,
    substituicao: PROIBE_ST,
    observacao:
      "Tributação por unidade de medida: a base percentual é zero e o imposto não. Conferir contra o C170 de combustível antes de endurecer qualquer exigência aqui.",
  },
  {
    tributacao: "10",
    descricao: "Tributada e com cobrança do ICMS por substituição tributária",
    proprio: EXIGE_PROPRIO,
    substituicao: EXIGE_ST,
  },
  {
    tributacao: "15",
    descricao: "Tributação monofásica própria e com responsabilidade pela retenção",
    proprio: PROPRIO_LIVRE,
    substituicao: ST_LIVRE,
  },
  {
    tributacao: "20",
    descricao: "Com redução de base de cálculo",
    proprio: EXIGE_PROPRIO,
    substituicao: PROIBE_ST,
    reduzBase: true,
  },
  {
    tributacao: "30",
    descricao: "Isenta ou não tributada e com cobrança do ICMS por substituição tributária",
    proprio: PROIBE_PROPRIO,
    substituicao: EXIGE_ST,
  },
  {
    tributacao: "40",
    descricao: "Isenta",
    proprio: PROIBE_PROPRIO,
    substituicao: PROIBE_ST,
  },
  {
    tributacao: "41",
    descricao: "Não tributada",
    proprio: PROIBE_PROPRIO,
    substituicao: PROIBE_ST,
  },
  {
    tributacao: "50",
    descricao: "Suspensão",
    proprio: PROIBE_PROPRIO,
    substituicao: PROIBE_ST,
  },
  {
    tributacao: "51",
    descricao: "Diferimento",
    proprio: PROPRIO_LIVRE,
    substituicao: PROIBE_ST,
    observacao:
      "O diferimento pode ser total ou parcial conforme a legislação da UF: com diferimento parcial há base e imposto legítimos no item. Por isso o imposto próprio fica livre.",
  },
  {
    tributacao: "53",
    descricao: "Tributação monofásica sobre combustíveis com recolhimento diferido",
    proprio: PROIBE_PROPRIO_COM_RESSALVA,
    substituicao: PROIBE_ST,
  },
  {
    tributacao: "60",
    descricao: "ICMS cobrado anteriormente por substituição tributária",
    proprio: PROIBE_PROPRIO_COM_RESSALVA,
    substituicao: ST_LIVRE,
    observacao:
      "O ST do item já foi retido lá atrás. Há gerador que repete os valores retidos aqui a título informativo, e há UF que admite destaque próprio para instruir ressarcimento — daí o par livre/alerta em vez de proibição dura.",
  },
  {
    tributacao: "61",
    descricao: "Tributação monofásica sobre combustíveis cobrada anteriormente",
    proprio: PROIBE_PROPRIO_COM_RESSALVA,
    substituicao: ST_LIVRE,
  },
  {
    tributacao: "70",
    descricao: "Com redução de base de cálculo e cobrança do ICMS por substituição tributária",
    proprio: EXIGE_PROPRIO,
    substituicao: EXIGE_ST,
    reduzBase: true,
  },
  {
    tributacao: "90",
    descricao: "Outras",
    proprio: PROPRIO_LIVRE,
    substituicao: ST_LIVRE,
    observacao:
      "O código-curinga. Só o CFOP e a legislação da UF dizem o que se espera dos valores, e é por isso que as duas exigências ficam livres: uma regra que decidisse por conta própria apontaria erro sobre a operação atípica que o 90 existe para acomodar.",
  },
];

const POR_TRIBUTACAO = new Map(TRIBUTACOES_DO_ICMS.map((t) => [t.tributacao, t]));

/** A linha da Tabela B, ou `undefined` se a tributação não existe na tabela. */
export function tributacaoDeclarada(tributacao: string | null): TributacaoDoIcms | undefined {
  if (tributacao === null) return undefined;
  return POR_TRIBUTACAO.get(tributacao);
}

/**
 * Códigos da Tabela B do Simples Nacional (CSOSN), para reconhecê-los onde não
 * deveriam estar.
 *
 * O CSOSN NÃO cabe no campo CST_ICMS desta escrituração, e a razão é aritmética:
 * o campo é `N(3)` — origem mais DOIS dígitos de tributação —, enquanto o CSOSN
 * tem três dígitos por si só e ainda pede a origem na frente, somando quatro.
 * Quem copia o CSOSN da NF-e para cá produz um valor que o leitor lê como outra
 * coisa: `102` (tributada pelo Simples sem permissão de crédito) vira origem 1
 * com tributação 02 (monofásico de combustível), que é um CST válido — e a
 * conferência seguinte passa a medir o item contra a regra errada, calada.
 *
 * Daí esta lista existir: os valores cuja leitura como CST é VÁLIDA são
 * exatamente os perigosos, porque nenhuma outra regra os pega.
 */
export const CODIGOS_CSOSN: ReadonlyMap<string, string> = new Map([
  ["101", "Tributada pelo Simples Nacional com permissão de crédito"],
  ["102", "Tributada pelo Simples Nacional sem permissão de crédito"],
  ["103", "Isenção do ICMS no Simples Nacional para faixa de receita bruta"],
  ["201", "Tributada com permissão de crédito e com cobrança do ICMS por ST"],
  ["202", "Tributada sem permissão de crédito e com cobrança do ICMS por ST"],
  ["203", "Isenção para faixa de receita bruta e com cobrança do ICMS por ST"],
  ["300", "Imune"],
  ["400", "Não tributada pelo Simples Nacional"],
  ["500", "ICMS cobrado anteriormente por substituição tributária ou por antecipação"],
  ["900", "Outros"],
]);
