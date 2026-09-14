import type { Severidade } from "../../nucleo/tipos";

/**
 * Tabelas externas do ICMS/IPI — federais e estaduais.
 *
 * Nada aqui é código: são DADOS tipados, no mesmo espírito do dicionário. Uma
 * tabela que fosse função deixaria de ser auditável por quem precisa auditá-la,
 * que é o contador, não o programador.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE AS TABELAS ESTADUAIS SÃO UM PROBLEMA DIFERENTE DAS FEDERAIS
 *
 * CFOP, NCM e CST são nacionais: uma tabela serve o arquivo inteiro. Os ajustes
 * da apuração (5.1.1) e os benefícios fiscais (5.3) NÃO são — cada UF publica a
 * sua, e o MESMO código significa coisas diferentes em estados diferentes.
 * Validar um arquivo do Maranhão contra a tabela de São Paulo não produz um
 * resultado pior: produz um resultado inventado.
 *
 * Daí três decisões que atravessam todo este arquivo:
 *
 * 1. A UF vem do registro 0000 do próprio arquivo, nunca de uma preferência do
 *    usuário. O arquivo diz de quem ele é.
 * 2. A tabela é carregada sob demanda, depois de saber a UF — e não as 27 de
 *    uma vez, o que jogaria megabytes de dado estadual na memória de uma aba
 *    que já está segurando um arquivo de 100 MB.
 * 3. O tipo de quem consome é `TabelaEstadual | null`. Nulável de propósito: é
 *    o compilador obrigando cada regra a escrever o caminho da degradação,
 *    em vez de descobrir em produção que a tabela não estava lá.
 */

/** Período em que um código esteve em vigor. Datas em `AAAA-MM`. */
export interface Vigencia {
  readonly desde: string;
  /** Ausente significa vigente até hoje. */
  readonly ate?: string;
}

/**
 * Um código de ajuste da apuração do ICMS (tabela 5.1.1), como publicado pela UF.
 *
 * O código tem a forma `UU` + 6 dígitos — por exemplo `MA000001`:
 *
 * ```
 *   M A 0 0 0 0 0 1
 *   └┬┘ │ │ │ └──┬─┘
 *    │  │ │ │    └── sequencial dentro da combinação
 *    │  │ │ └─────── origem do documento do ajuste
 *    │  │ └───────── tipo do ajuste (débito, estorno, crédito…)
 *    │  └─────────── tipo da apuração (própria ou ST)
 *    └────────────── UF que publicou o código
 * ```
 *
 * A decomposição é a razão de dar para validar ALGUMA coisa sem ter a tabela:
 * o formato, o prefixo de UF e a coerência entre o tipo do ajuste e o campo do
 * E110 que ele alimenta são estruturais. O SIGNIFICADO do código, não — esse
 * exige a tabela publicada.
 */
export interface CodigoDeAjuste {
  readonly codigo: string;
  readonly descricao: string;
  readonly vigencia: Vigencia;
  /** Registro em que o código é utilizável: `E111`, `E220`, `C197`… */
  readonly registros: readonly string[];
}

/**
 * Um código de benefício fiscal (tabela 5.3) e as combinações em que cabe.
 *
 * `cstAdmitidos` e `cfopAdmitidos` vazios significam "a tabela não restringe",
 * e não "nada é admitido". A diferença importa: tratada como lista fechada, uma
 * tabela sem restrição declarada reprovaria todas as operações do benefício.
 */
export interface CodigoDeBeneficio {
  readonly codigo: string;
  readonly descricao: string;
  readonly vigencia: Vigencia;
  /** Tributações do CST do ICMS (2 dígitos) em que o benefício cabe. */
  readonly cstAdmitidos: readonly string[];
  readonly cfopAdmitidos: readonly string[];
  readonly baseLegal?: string;
}

/** O conjunto de tabelas de uma UF, já resolvido para o período do arquivo. */
export interface TabelaEstadual {
  readonly uf: string;
  /** Versão publicada pela SEFAZ, para exibir ao usuário e para o sync. */
  readonly versao: string;
  /** Quando estes dados foram conferidos contra a publicação oficial. */
  readonly conferidoEm: string;
  readonly fonte: string;
  readonly ajustesDaApuracao: readonly CodigoDeAjuste[];
  readonly beneficiosFiscais: readonly CodigoDeBeneficio[];
}

/**
 * Como a validação se comporta quando a tabela da UF não está disponível.
 *
 * Existe como tipo, e não como convenção, porque "o que fazer quando não sei"
 * é decisão de produto que precisa ser a mesma em toda regra estadual. Um
 * arquivo do Acre não pode gerar um mar de achados só porque ninguém ainda
 * transcreveu a tabela do Acre — isso ensinaria o contador a ignorar achados,
 * que é o pior resultado possível para uma ferramenta de auditoria.
 */
export const SEM_TABELA_ESTADUAL = {
  /**
   * O que a regra faz sem a tabela: NADA de severidade `erro`.
   *
   * No máximo um `info` agregado, uma vez por arquivo, dizendo que a
   * conferência dos códigos estaduais não pôde ser feita. Nunca um achado por
   * linha, nunca um achado que pareça uma irregularidade do contribuinte.
   */
  severidadeMaxima: "info" as Severidade,
  mensagem:
    "Os códigos de ajuste e de benefício fiscal não foram conferidos: a tabela desta UF não está carregada nesta versão do sistema.",
} as const;

/**
 * Manifesto das tabelas disponíveis, servido junto com os dados.
 *
 * O worker lê a UF do 0000, consulta o manifesto e só então busca o arquivo
 * daquela UF. É o que evita carregar 27 tabelas para usar uma.
 */
export interface ManifestoEstadual {
  readonly atualizadoEm: string;
  readonly ufs: readonly {
    readonly uf: string;
    readonly versao: string;
    readonly arquivo: string;
    readonly bytes: number;
  }[];
}

/**
 * Onde as tabelas estaduais moram.
 *
 * ARMADILHA DE NAMESPACE — `public/data/sync-meta.json` JÁ possui as chaves
 * `5.1.1` e `5.1.2`, e elas se referem às tabelas da EFD-CONTRIBUIÇÕES (as
 * vizinhas são todas `4.3.x`). Gravar a tabela de ajustes do ICMS sob a mesma
 * chave sobrescreveria silenciosamente o controle de versão da OUTRA aba, e o
 * robô de sincronização passaria a se achar atualizado sobre uma tabela que
 * nunca baixou. Por isso as tabelas estaduais têm diretório e manifesto
 * próprios, fora do arquivo compartilhado.
 */
export const CAMINHO_DAS_TABELAS_ESTADUAIS = {
  manifesto: "/data/estaduais/index.json",
  porUf: (uf: string) => `/data/estaduais/${uf.toLowerCase()}.json`,
} as const;
