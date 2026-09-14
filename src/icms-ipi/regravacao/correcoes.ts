import type { LinhaSped } from "../leitura/parser";

/**
 * Uma correção proposta pela auditoria e aplicável na regravação.
 *
 * É a peça que faltava entre a auditoria e o arquivo gerado. Antes, `gerarTxt`
 * recebia só a finalidade e nunca lia os achados: o selo "Automática na
 * regravação" era verdade apenas para X990 e bloco 9 — que a regravação
 * refazia de qualquer jeito, com ou sem apontamento. Tudo o mais que o
 * contador imaginasse corrigido saía idêntico no arquivo entregue.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A RÉGUA — quem decide o que pode ser aplicado
 *
 * O TXT vai assinado à Receita. A ferramenta nunca inventa dado fiscal. Três
 * classes, e a classe é decidida pela ORIGEM do valor novo, não pela vontade
 * de ajudar:
 *
 *  - `automatica`: o valor certo é dedutível do próprio arquivo, sem juízo —
 *    contagem de linhas, delimitador ausente, formato que não muda conteúdo.
 *    Aplicada sem perguntar, mas listada no relatório.
 *  - `sugerida`: o valor é dedutível, mas há uma decisão embutida — criar um
 *    cadastro 0190 a partir da unidade que o C170 já usa, por exemplo. Só
 *    entra no arquivo se o contador aprovar, e a tela mostra de → para.
 *  - `manual`: só se aponta. Nunca vira `Correcao`.
 *
 * Na dúvida entre duas classes, vale a mais conservadora.
 */
export type ClasseDeCorrecao = "automatica" | "sugerida";

export interface CorrecaoDeCampo {
  readonly tipo: "campo";
  /** Código da regra que propôs. Ex.: `EST-023`. */
  readonly codigo: string;
  readonly classe: ClasseDeCorrecao;
  /** Linha no arquivo original, base 1 — a mesma do achado. */
  readonly nl: number;
  readonly reg: string;
  /** Nome do campo, para a UI. */
  readonly campo: string;
  /** Índice no array de `linha.split("|")` — REG = 1, primeiro dado = 2. */
  readonly posicao: number;
  readonly de: string;
  readonly para: string;
  /** Uma frase: por que este valor. É o que o contador lê antes de aprovar. */
  readonly motivo: string;
}

export interface CorrecaoDeLinha {
  readonly tipo: "linha";
  readonly codigo: string;
  readonly classe: ClasseDeCorrecao;
  /**
   * Onde a linha nova entra: DEPOIS da linha original de número `apos`.
   *
   * Um 0190 novo entra antes do 0990; um C990 ausente entra depois da última
   * linha do bloco C. É sempre "depois de", nunca um índice absoluto, porque
   * outras correções podem inserir linhas antes e os índices absolutos se
   * deslocam — o `nl` original, não.
   */
  readonly apos: number;
  readonly reg: string;
  /** Campos completos da linha nova, no formato do array após split. */
  readonly campos: readonly string[];
  readonly motivo: string;
}

export type Correcao = CorrecaoDeCampo | CorrecaoDeLinha;

/** Identidade estável, para a UI de revisão e para deduplicar. */
export function idDaCorrecao(c: Correcao): string {
  return c.tipo === "campo"
    ? `${c.codigo}:${c.nl}:${c.posicao}`
    : `${c.codigo}:apos${c.apos}:${c.reg}`;
}

/**
 * Aplica as correções numa CÓPIA das linhas. A estrutura em memória não é
 * tocada: a grade e os achados continuam mostrando o arquivo que o contador
 * carregou, e uma segunda exportação parte do mesmo original.
 *
 * ORDEM DENTRO DO PIPELINE — esta função roda ANTES de
 * `recalcularTotalizadores`, e a ordem não é negociável: uma linha inserida
 * muda o QTD_LIN do bloco e a contagem do bloco 9. Corrigir depois dos
 * totalizadores entregaria um arquivo com os totais do arquivo antigo.
 *
 * Correção de campo cujo `de` não confere com o valor atual é IGNORADA e
 * devolvida em `recusadas`. É a proteção contra correção velha: a lista foi
 * montada sobre um arquivo, o contador trocou de arquivo, e uma correção que
 * aponta "nl 412, posição 7, de '0,00' para '18,00'" cairia numa linha que não
 * tem nada a ver com aquilo.
 */
export interface ResultadoDaAplicacao {
  readonly linhas: LinhaSped[];
  readonly aplicadas: readonly Correcao[];
  readonly recusadas: readonly { correcao: Correcao; motivo: string }[];
}

export function aplicarCorrecoes(
  originais: readonly LinhaSped[],
  correcoes: readonly Correcao[]
): ResultadoDaAplicacao {
  if (correcoes.length === 0) {
    // Cópia rasa basta: `recalcularTotalizadores` copia o que altera.
    return { linhas: [...originais], aplicadas: [], recusadas: [] };
  }

  const porNl = new Map<number, CorrecaoDeCampo[]>();
  const insercoes = new Map<number, CorrecaoDeLinha[]>();
  for (const c of correcoes) {
    if (c.tipo === "campo") {
      const lista = porNl.get(c.nl) ?? [];
      lista.push(c);
      porNl.set(c.nl, lista);
    } else {
      const lista = insercoes.get(c.apos) ?? [];
      lista.push(c);
      insercoes.set(c.apos, lista);
    }
  }

  const linhas: LinhaSped[] = [];
  const aplicadas: Correcao[] = [];
  const recusadas: { correcao: Correcao; motivo: string }[] = [];

  // Inserções pedidas "depois da linha 0" entram antes de tudo.
  for (const c of insercoes.get(0) ?? []) {
    linhas.push({ reg: c.reg, nl: 0, campos: [...c.campos] });
    aplicadas.push(c);
  }

  for (const original of originais) {
    const doCampo = porNl.get(original.nl);
    if (!doCampo) {
      linhas.push(original);
    } else {
      // Copia só a linha que muda — num arquivo de 100 MB copiar tudo dobraria a memória.
      const campos = [...original.campos];
      for (const c of doCampo) {
        if (c.reg !== original.reg) {
          recusadas.push({ correcao: c, motivo: `a linha ${c.nl} é ${original.reg}, não ${c.reg}` });
          continue;
        }
        if ((campos[c.posicao] ?? "") !== c.de) {
          recusadas.push({
            correcao: c,
            motivo: `o campo já não contém o valor esperado pela correção`,
          });
          continue;
        }
        campos[c.posicao] = c.para;
        aplicadas.push(c);
      }
      linhas.push({ reg: original.reg, nl: original.nl, campos });
    }

    for (const c of insercoes.get(original.nl) ?? []) {
      linhas.push({ reg: c.reg, nl: 0, campos: [...c.campos] });
      aplicadas.push(c);
    }
  }

  // Inserção "depois de" uma linha que não existe: recusa, não perde em silêncio.
  const nlsExistentes = new Set(originais.map((l) => l.nl));
  for (const [apos, lista] of insercoes) {
    if (apos === 0 || nlsExistentes.has(apos)) continue;
    for (const c of lista) recusadas.push({ correcao: c, motivo: `a linha ${apos} não existe` });
  }

  return { linhas, aplicadas, recusadas };
}
