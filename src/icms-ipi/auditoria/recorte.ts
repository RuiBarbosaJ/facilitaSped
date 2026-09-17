import type { Achado, Severidade } from "@/regras/nucleo/contrato";
import type { Correcao } from "../regravacao/correcoes";

/**
 * O recorte da grade: quais linhas do arquivo merecem estar na tela agora.
 *
 * Os filtros de coluna respondem "quais linhas têm este valor?". Nenhum deles
 * alcança as duas perguntas que quem audita faz primeiro — "onde estão os
 * erros?" e "o que eu já mandei corrigir?" —, porque a resposta não está em
 * campo nenhum do arquivo: está nos apontamentos e nas correções, que vivem ao
 * lado dele.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * AS MARCAÇÕES SE SOMAM, NÃO SE CRUZAM
 *
 * Marcar "Erro" e "Corrigidas" mostra as linhas com erro MAIS as linhas
 * corrigidas, e não as corrigidas que também têm erro. É a leitura que serve à
 * conferência: o contador marca o que quer ver na tela, e cada marcação
 * ACRESCENTA. Cruzamento esconderia justamente a linha que ele acabou de
 * mandar corrigir — a que ele quer reler antes de gerar o arquivo.
 *
 * Nada marcado significa "sem recorte": o arquivo inteiro. E é diferente de
 * marcar uma severidade que não tem nenhuma linha, que legitimamente esvazia a
 * grade — confundir os dois mostraria o arquivo todo justamente quando a
 * resposta certa é "não há nenhuma".
 */
export interface RecorteDaGrade {
  /** Severidades marcadas. A linha entra se tiver apontamento de alguma. */
  readonly severidades: readonly Severidade[];
  /**
   * Também mostrar as linhas que têm correção — aprovada OU esperando decisão.
   *
   * Cobre as duas de propósito. A pergunta que traz alguém a este controle é
   * "o que tem conserto aqui?", e a linha com uma sugestão por decidir é
   * justamente a que precisa de atenção: a aprovada já está resolvida.
   */
  readonly corrigidas: boolean;
}

export const RECORTE_ABERTO: RecorteDaGrade = { severidades: [], corrigidas: false };

/** Alguma marcação está ativa — logo, a grade está recortada. */
export function recorteAtivo(recorte: RecorteDaGrade): boolean {
  return recorte.severidades.length > 0 || recorte.corrigidas;
}

export interface ResumoDoRecorte {
  /** Linhas DISTINTAS com apontamento de cada severidade. */
  readonly linhasPorSeveridade: Record<Severidade, number>;
  /** Linhas com correção proposta, aprovadas ou não. */
  readonly linhasComProposta: number;
  /** Destas, as que já vão para o arquivo gerado. */
  readonly linhasAprovadas: number;
  /** Correções que criam linha nova: não existem no arquivo lido. */
  readonly linhasNovas: number;
}

const SEVERIDADES: readonly Severidade[] = ["critico", "erro", "alerta", "info"];

/**
 * Conta LINHAS, e não apontamentos.
 *
 * O número ao lado da marcação promete o tamanho do recorte, e uma linha com
 * três erros continua sendo uma linha na grade. Contar apontamentos faria o
 * selo dizer "12" e a grade abrir com quatro — a única leitura possível para
 * quem vê isso é que a ferramenta perdeu oito.
 */
export function resumirRecorte(
  achados: readonly Achado[],
  propostas: readonly Correcao[],
  aprovadas: readonly Correcao[]
): ResumoDoRecorte {
  const porSeveridade = new Map<Severidade, Set<number>>();
  for (const severidade of SEVERIDADES) porSeveridade.set(severidade, new Set());

  for (const achado of achados) {
    // `nl` zero é o achado agregado do arquivo — sem linha, não entra em recorte
    // nenhum. Contá-lo prometeria uma linha que a grade nunca vai mostrar.
    if (achado.nl <= 0) continue;
    porSeveridade.get(achado.severidade)?.add(achado.nl);
  }

  const linhasPorSeveridade = {} as Record<Severidade, number>;
  for (const severidade of SEVERIDADES) {
    linhasPorSeveridade[severidade] = porSeveridade.get(severidade)?.size ?? 0;
  }

  const comProposta = new Set<number>();
  let novas = 0;
  for (const correcao of propostas) {
    if (correcao.tipo === "campo") comProposta.add(correcao.nl);
    else novas++;
  }

  const jaAprovadas = new Set<number>();
  for (const correcao of aprovadas) {
    if (correcao.tipo === "campo") jaAprovadas.add(correcao.nl);
  }

  return {
    linhasPorSeveridade,
    linhasComProposta: comProposta.size,
    linhasAprovadas: jaAprovadas.size,
    linhasNovas: novas,
  };
}

/**
 * As linhas do recorte, ordenadas. `undefined` quer dizer "sem recorte".
 *
 * Ordenado porque a lista vira chave de cache do índice no worker: duas ordens
 * da mesma seleção recalculariam o índice inteiro à toa.
 */
export function linhasDoRecorte(
  achados: readonly Achado[],
  propostas: readonly Correcao[],
  recorte: RecorteDaGrade
): number[] | undefined {
  if (!recorteAtivo(recorte)) return undefined;

  const marcadas = new Set(recorte.severidades);
  const linhas = new Set<number>();

  if (marcadas.size > 0) {
    for (const achado of achados) {
      if (achado.nl <= 0) continue;
      if (marcadas.has(achado.severidade)) linhas.add(achado.nl);
    }
  }

  if (recorte.corrigidas) {
    for (const correcao of propostas) {
      if (correcao.tipo === "campo") linhas.add(correcao.nl);
    }
  }

  return [...linhas].sort((a, b) => a - b);
}

/**
 * Os campos que o recorte destaca — o recorte de COLUNAS.
 *
 * Um apontamento sem `campo` (o que fala do documento inteiro, não de uma
 * célula) não contribui com coluna nenhuma, e está certo: ele não tem célula
 * para apontar. Se NENHUM apontamento do recorte tiver campo, o conjunto volta
 * vazio e quem consome mantém as colunas como estavam — ver `recortarPorCampos`.
 */
export function camposDoRecorte(
  achados: readonly Achado[],
  propostas: readonly Correcao[],
  recorte: RecorteDaGrade
): Set<string> {
  const campos = new Set<string>();
  if (!recorteAtivo(recorte)) return campos;

  const marcadas = new Set(recorte.severidades);
  if (marcadas.size > 0) {
    for (const achado of achados) {
      if (achado.nl <= 0 || !achado.campo) continue;
      if (marcadas.has(achado.severidade)) campos.add(achado.campo);
    }
  }

  if (recorte.corrigidas) {
    for (const correcao of propostas) {
      if (correcao.tipo === "campo") campos.add(correcao.campo);
    }
  }

  return campos;
}

/** Liga ou desliga uma severidade, devolvendo um recorte novo. */
export function alternarSeveridade(
  recorte: RecorteDaGrade,
  severidade: Severidade,
  marcada: boolean
): RecorteDaGrade {
  const atuais = recorte.severidades.filter((s) => s !== severidade);
  return {
    ...recorte,
    // Mantém a ordem canônica (do mais grave para o menos) em vez da ordem dos
    // cliques: é ela que o texto da tela lê em voz alta.
    severidades: marcada
      ? SEVERIDADES.filter((s) => s === severidade || atuais.includes(s))
      : atuais,
  };
}

export { SEVERIDADES };

/**
 * Onde a auditoria encostou, pronto para a grade pintar.
 *
 * A grade é virtualizada e redesenha dezenas de células por quadro de rolagem.
 * Perguntar "esta célula tem apontamento?" varrendo a lista de achados a cada
 * uma seria O(células × achados) — com 5.000 achados e 94 colunas, dezenas de
 * milhões de comparações por rolagem. Os três índices são montados UMA vez por
 * arquivo e respondem em O(1).
 */
export interface MarcasDaAuditoria {
  /** `nl|campo` → a severidade MAIS GRAVE apontada naquela célula. */
  readonly celulas: ReadonlyMap<string, Severidade>;
  /**
   * `nl` → a severidade mais grave da linha, com campo ou sem.
   *
   * Existe por causa do apontamento que fala do DOCUMENTO e não de uma célula —
   * "documento sem registro analítico" não tem coluna para pintar. Sem esta
   * marca, a linha apareceria no recorte por "Erro" sem nada colorido nela, e a
   * primeira pergunta de quem olha seria "por que esta linha está aqui?".
   */
  readonly linhas: ReadonlyMap<number, Severidade>;
  /** `campo` → severidade mais grave e quantos apontamentos no arquivo. */
  readonly colunas: ReadonlyMap<string, { severidade: Severidade; quantidade: number }>;
}

/** Índice da severidade em SEVERIDADES: quanto menor, mais grave. */
function gravidade(severidade: Severidade): number {
  return SEVERIDADES.indexOf(severidade);
}

/** Mantém a mais grave das duas. */
function maisGrave(atual: Severidade | undefined, nova: Severidade): Severidade {
  if (atual === undefined) return nova;
  return gravidade(nova) < gravidade(atual) ? nova : atual;
}

/** A chave de uma célula. Mesma forma nos dois lados, ou o lookup não casa. */
export function chaveDaCelula(nl: number, campo: string): string {
  return `${nl}|${campo}`;
}

export function marcarAuditoria(achados: readonly Achado[]): MarcasDaAuditoria {
  const celulas = new Map<string, Severidade>();
  const linhas = new Map<number, Severidade>();
  const colunas = new Map<string, { severidade: Severidade; quantidade: number }>();

  for (const achado of achados) {
    // O apontamento agregado do arquivo não tem linha para pintar. Ele conta
    // para a coluna, se citar campo — é informação útil no cabeçalho.
    if (achado.nl > 0) {
      linhas.set(achado.nl, maisGrave(linhas.get(achado.nl), achado.severidade));
      if (achado.campo) {
        const chave = chaveDaCelula(achado.nl, achado.campo);
        celulas.set(chave, maisGrave(celulas.get(chave), achado.severidade));
      }
    }

    if (!achado.campo) continue;
    const daColuna = colunas.get(achado.campo);
    colunas.set(achado.campo, {
      severidade: maisGrave(daColuna?.severidade, achado.severidade),
      quantidade: (daColuna?.quantidade ?? 0) + 1,
    });
  }

  return { celulas, linhas, colunas };
}
