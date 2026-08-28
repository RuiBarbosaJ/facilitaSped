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
