export interface RegistroSped {
  ncm: string;
  descricao: string;
  cst: string;
  aliquota: string;
  natureza_receita?: string;
  data_inicio?: string;
  data_fim?: string;
  /** Tabela de origem no portal do SPED, ex.: "4.3.13". */
  tabela?: string;
  /**
   * "descricao" quando o NCM não veio da coluna própria, mas dos códigos citados
   * no texto da regra. Um capítulo inteiro citado ali ("Almofadas antiescaras
   * classificadas nos Capítulos 39, 40...") localiza o produto; não o define.
   */
  origem?: "descricao";
}

/** Carimbo da sincronização com o portal do SPED, regravado a cada execução bem-sucedida. */
export interface SincronizacaoMeta {
  /** Última vez que os DADOS mudaram de fato, em ISO 8601 UTC. */
  atualizado_em: string;
  /**
   * Última vez que o robô CONFERIU o portal com sucesso, mesmo sem mudança.
   * É a data que a tela mostra: o contador precisa saber que a checagem
   * diária aconteceu hoje. Ausente em carimbos gravados por versões antigas.
   */
  verificado_em?: string;
  /** Quantas regras o arquivo tinha nessa sincronização. */
  registros: number;
  /** Versões das tabelas do portal SPED mapeadas pelo número da tabela. */
  versoes?: Record<string, string>;
}

/** Um código da Nomenclatura Comum do Mercosul, como publicado pelo Siscomex. */
export interface NcmOficial {
  /** 8 dígitos, sem pontos. */
  ncm: string;
  descricao: string;
  /** Início de vigência, em ISO (AAAA-MM-DD). */
  inicio: string;
  /** Fim de vigência em ISO; ausente quando o código segue vigente. */
  fim?: string;
}

/** Tabela NCM completa, usada para saber se um código existe ou foi revogado. */
export interface TabelaNcm {
  /** Ato normativo que publicou esta versão da nomenclatura. */
  fonte: string;
  codigos: NcmOficial[];
}
