import type { Achado } from "@/regras/nucleo/contrato";
import type { Correcao } from "../regravacao/correcoes";

/** Seleção do menu de cada coluna da grade, indexada pelo nome da coluna. */
export type FiltrosGrade = Record<string, string[]>;

/** Finalidade da escrituração (campo COD_FIN do registro 0000). */
export type CodFin = "0" | "1";

export interface ResumoArquivo {
  empresa: string;
  cnpj: string;
  periodo: string;
  perfil: string;
  /** UF do estabelecimento, lida do registro 0000 — nunca perguntada ao usuário. */
  uf: string;
  /** COD_VER declarado no arquivo. */
  versaoLeiaute: string;
  /** SHA-256 dos bytes do arquivo como ele veio do disco. */
  hash: string;
  totalLinhas: number;
  contagemPorRegistro: Record<string, number>;
  /** COD_FIN lido do arquivo, para a exportação poder preservá-lo. */
  codFinOriginal: string;
  /** Quantos achados foram omitidos por terem estourado o teto por código. */
  achadosOmitidos: number;
}

export interface LinhaJanela {
  nl: number;
  campos: string[];
}

/**
 * Mensagens da UI para o worker.
 *
 * `INICIAR` e `CANCELAR` não levam identificador: quem numera as execuções é o
 * worker, que é o único a saber qual está de fato rodando. Já `JANELA`,
 * `VALORES_TABELA` e `GERAR_TXT` levam `requisicao`, devolvido na resposta,
 * porque a UI precisa descartar a resposta de um filtro que ela já trocou.
 */
export type ParaWorker =
  | { tipo: "INICIAR"; arquivo: File }
  | { tipo: "CANCELAR" }
  | { tipo: "LIMPAR" }
  | { tipo: "JANELA"; requisicao: number; offset: number; limite: number; filtros?: FiltrosGrade }
  | { tipo: "VALORES_TABELA"; requisicao: number; filtros?: FiltrosGrade; colunas: string[] }
  | {
      tipo: "GERAR_TXT";
      requisicao: number;
      codFin: CodFin;
      /**
       * As correções que o contador APROVOU. Lista vazia = regravação fiel,
       * só com os totalizadores e a finalidade — que é o comportamento de
       * sempre e o que o teste de fidelidade protege.
       */
      correcoes: Correcao[];
    };

/**
 * Códigos de erro devolvidos ao usuário.
 *
 * `INTERNO` existe para que uma falha de programação não seja mais reportada
 * como "o arquivo excede os limites" — o que mandava o contador reduzir um
 * arquivo que nunca foi o problema.
 */
export type CodigoErro = "FORMATO" | "LIMITE" | "ENCODING" | "INTERNO";

export type DoWorker =
  | { tipo: "PROGRESSO"; execucao: number; bytesLidos: number; bytesTotal: number; linhas: number }
  | { tipo: "PRONTO"; execucao: number; resumo: ResumoArquivo; achados: Achado[] }
  | { tipo: "CANCELADO"; execucao: number }
  | {
      tipo: "JANELA_OK";
      requisicao: number;
      offset: number;
      linhas: LinhaJanela[];
      total: number;
    }
  | {
      tipo: "VALORES_TABELA_OK";
      requisicao: number;
      valores: Record<string, string[]>;
      /** Colunas cuja lista foi cortada no teto: o menu precisa avisar. */
      truncadas: string[];
    }
  | {
      tipo: "TXT_OK";
      requisicao: number;
      blob: Blob;
      nomeSugerido: string;
      hash: string;
      /** O que de fato entrou no arquivo — o relatório que acompanha a entrega. */
      aplicadas: Correcao[];
      /** O que foi pedido e não pôde entrar, com o motivo. Nunca some em silêncio. */
      recusadas: { correcao: Correcao; motivo: string }[];
    }
  | { tipo: "ERRO"; execucao: number; codigo: CodigoErro; mensagem: string; linha?: number };

/**
 * Erro com código próprio.
 *
 * A mensagem nunca carrega conteúdo do arquivo — só código e, quando ajuda, o
 * número da linha (seção 13.2 do plano: erro é código + linha, nunca a linha).
 */
export class ErroSped extends Error {
  constructor(
    readonly codigo: CodigoErro,
    mensagem: string,
    readonly linha?: number
  ) {
    super(mensagem);
    this.name = "ErroSped";
  }
}
