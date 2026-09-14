import type { LinhaSped } from "../leitura/parser";

/** Recriados do zero na regravação, portanto fora da contagem dos blocos. */
export const REGISTROS_DE_TOTALIZACAO: ReadonlySet<string> = new Set(["9900", "9990", "9999"]);

/**
 * Percorre as linhas e informa, em cada fechamento de bloco X990, quantas
 * linhas aquele bloco tem — incluindo o próprio X990, como o Guia Prático pede.
 *
 * Existe para que a regra de auditoria EST-040 e a regravação contem do mesmo
 * jeito: enquanto eram dois laços separados, corrigir a contagem em um deixava
 * o outro apontando divergência no arquivo que ele mesmo tinha acabado de
 * gerar.
 */
export function percorrerFechamentos(
  linhas: readonly LinhaSped[],
  aoFechar: (linha: LinhaSped, linhasDoBloco: number) => void
): void {
  let linhasDoBloco = 0;
  let blocoAtual = "";

  for (const linha of linhas) {
    if (REGISTROS_DE_TOTALIZACAO.has(linha.reg)) continue;

    const bloco = linha.reg.charAt(0);
    if (bloco !== blocoAtual) {
      linhasDoBloco = 0;
      blocoAtual = bloco;
    }
    linhasDoBloco++;

    if (linha.reg === `${bloco}990`) aoFechar(linha, linhasDoBloco);
  }
}

function criarLinha(reg: string, valores: string[]): LinhaSped {
  return { reg, nl: 0, campos: ["", reg, ...valores, ""] };
}

/** Cópia profunda o bastante: `campos` é o único array que a regravação altera. */
function copiar(linha: LinhaSped): LinhaSped {
  return { reg: linha.reg, nl: linha.nl, campos: [...linha.campos] };
}

/**
 * Recalcula os fechamentos de bloco (X990) e recria o bloco 9 inteiro
 * (9900/9990/9999), devolvendo uma lista NOVA.
 *
 * Nada da estrutura em memória é alterado. A versão anterior escrevia direto em
 * `linha.campos`, então exportar uma vez adulterava permanentemente os dados
 * que a grade e os achados exibiam — e uma segunda exportação já partia de um
 * arquivo diferente do que o contador tinha auditado.
 */
export function recalcularTotalizadores(linhas: readonly LinhaSped[]): LinhaSped[] {
  const resultado: LinhaSped[] = [];
  const contagemPorRegistro = new Map<string, number>();

  let linhasDoBloco = 0;
  let blocoAtual = "";

  for (const original of linhas) {
    if (REGISTROS_DE_TOTALIZACAO.has(original.reg)) continue;

    const linha = copiar(original);
    const bloco = linha.reg.charAt(0);
    if (bloco !== blocoAtual) {
      linhasDoBloco = 0;
      blocoAtual = bloco;
    }
    linhasDoBloco++;
    contagemPorRegistro.set(linha.reg, (contagemPorRegistro.get(linha.reg) ?? 0) + 1);

    if (linha.reg === `${bloco}990`) linha.campos[2] = String(linhasDoBloco);

    resultado.push(linha);
  }

  /*
   * Há um registro 9900 para cada registro distinto do arquivo — inclusive para
   * o próprio 9900, para o 9990 e para o 9999, que ainda não estão no mapa.
   * Daí o "+3": o total de linhas 9900 é igual ao número de registros
   * distintos do arquivo final.
   */
  const totalDe9900 = contagemPorRegistro.size + 3;
  contagemPorRegistro.set("9900", totalDe9900);
  contagemPorRegistro.set("9990", 1);
  contagemPorRegistro.set("9999", 1);

  for (const [reg, quantidade] of contagemPorRegistro) {
    resultado.push(criarLinha("9900", [reg, String(quantidade)]));
  }

  // QTD_LIN_9: o 9001, todos os 9900 recém-criados, o próprio 9990 e o 9999.
  let linhasDoBloco9 = 0;
  for (const linha of resultado) if (linha.reg.charAt(0) === "9") linhasDoBloco9++;
  linhasDoBloco9 += 2;
  resultado.push(criarLinha("9990", [String(linhasDoBloco9)]));

  resultado.push(criarLinha("9999", [String(resultado.length + 1)]));

  return resultado;
}
