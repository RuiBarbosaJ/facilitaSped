/**
 * Leitura e escrita de planilhas com o SheetJS.
 *
 * A biblioteca pesa algumas centenas de KB e só a página de auditoria precisa
 * dela, então é carregada sob demanda — a consulta principal não paga por ela.
 */

type SheetJs = typeof import("xlsx");

let carregando: Promise<SheetJs> | null = null;
function sheetjs(): Promise<SheetJs> {
  carregando ??= import("xlsx");
  return carregando;
}

/** Tamanho acima do qual recusamos o arquivo: nenhum relatório de NCM chega perto. */
export const TAMANHO_MAXIMO = 25 * 1024 * 1024;

/**
 * Primeira aba da planilha como matriz de linhas. `raw: false` devolve o texto
 * como o Excel o exibe — se a coluna de NCM estiver formatada com zeros à
 * esquerda, eles chegam; se for número puro, a normalização os recompõe.
 */
export async function lerPrimeiraAba(buffer: ArrayBuffer): Promise<unknown[][]> {
  const XLSX = await sheetjs();
  const pasta = XLSX.read(buffer, { type: "array" });
  const nome = pasta.SheetNames[0];
  if (!nome) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(pasta.Sheets[nome], {
    header: 1,
    raw: false,
    defval: "",
    blankrows: true,
  });
}

/** Monta um .xlsx em memória a partir de uma matriz de linhas. */
export async function gerarXlsx(
  linhas: unknown[][],
  nomeDaAba: string,
  largurasEmCaracteres?: number[]
): Promise<Uint8Array<ArrayBuffer>> {
  const XLSX = await sheetjs();
  const aba = XLSX.utils.aoa_to_sheet(linhas);
  if (largurasEmCaracteres) {
    aba["!cols"] = largurasEmCaracteres.map((wch) => ({ wch }));
  }
  const pasta = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(pasta, aba, nomeDaAba);
  const saida: unknown = XLSX.write(pasta, { bookType: "xlsx", type: "array" });
  // Copia para um buffer próprio: garante Uint8Array<ArrayBuffer>, que é o que
  // o construtor de Blob aceita nas tipagens atuais do TypeScript.
  if (saida instanceof Uint8Array) return new Uint8Array(saida);
  if (saida instanceof ArrayBuffer) return new Uint8Array(saida);
  throw new Error("O SheetJS não devolveu bytes ao gerar a planilha.");
}

/** Dispara o download de um arquivo gerado no navegador. */
export function baixarArquivo(bytes: Uint8Array<ArrayBuffer>, nome: string): void {
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const ancora = document.createElement("a");
  ancora.href = url;
  ancora.download = nome;
  document.body.appendChild(ancora);
  ancora.click();
  ancora.remove();
  // Libera a memória depois que o navegador já capturou o download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
