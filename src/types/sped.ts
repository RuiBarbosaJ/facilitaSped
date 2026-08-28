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
