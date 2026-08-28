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

export type TipoDeArquivo = "xlsx" | "xls" | "desconhecido";

/**
 * Olha os primeiros bytes em vez de confiar na extensão: um CSV renomeado
 * para .xlsx é texto, não uma planilha.
 */
export function tipoDeArquivo(buffer: ArrayBuffer): TipoDeArquivo {
  const b = new Uint8Array(buffer.slice(0, 8));
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return "xlsx"; // "PK.."
  if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return "xls"; // OLE
  return "desconhecido";
}

export interface AbaPlanilha {
  nome: string;
  linhas: unknown[][];
}

/**
 * Todas as abas visíveis, cada uma como matriz de linhas. Vem em `raw`: células
 * numéricas chegam como número (o zero à esquerda é recomposto na normalização)
 * e células de texto chegam como texto — sem o Excel aplicar formatos que
 * colariam casas decimais ao código.
 */
export async function lerAbas(buffer: ArrayBuffer): Promise<AbaPlanilha[]> {
  const XLSX = await sheetjs();
  const pasta = XLSX.read(buffer, { type: "array" });
  const ocultas = pasta.Workbook?.Sheets ?? [];
  return pasta.SheetNames.filter((_, i) => !ocultas[i]?.Hidden).map((nome) => ({
    nome,
    linhas: XLSX.utils.sheet_to_json<unknown[]>(pasta.Sheets[nome], {
      header: 1,
      raw: true,
      defval: "",
      blankrows: true,
    }),
  }));
}

/** Traduz as falhas conhecidas do SheetJS; o texto original vai para o console. */
export function descreverErroDeLeitura(erro: unknown): string {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  console.error("SheetJS:", mensagem);
  if (/password|encrypt/i.test(mensagem)) return "A planilha está protegida por senha. Salve uma cópia sem senha e tente de novo.";
  if (/unsupported|corrupt|bad|invalid|zip|cfb/i.test(mensagem)) return "O arquivo parece corrompido ou não é uma planilha do Excel.";
  return "Não foi possível ler a planilha.";
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
