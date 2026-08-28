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
}

/** Carimbo da última sincronização bem-sucedida que trouxe dados novos. */
export interface SincronizacaoMeta {
  /** Instante em que o robô gravou estes dados, em ISO 8601 UTC. */
  atualizado_em: string;
  /** Quantas regras o arquivo tinha nessa sincronização. */
  registros: number;
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
