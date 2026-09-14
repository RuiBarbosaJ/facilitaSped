export type TipoCampo =
  | "texto"
  | "valor"
  | "aliquota"
  | "quantidade"
  | "data"
  | "codigo";

export interface DefCampo {
  nome: string;
  indice: number;
  tipo: TipoCampo;
  titulo: string;
  obrigatorio?: boolean;
  tamanho?: number;
}

export interface DefRegistro {
  reg: string;
  bloco: string;
  nivel: number;
  pai: string[] | null;
  campos: readonly DefCampo[];
  /** quantos campos a linha deve ter, sem contar o índice 0 vazio */
  totalCampos: number;
}
