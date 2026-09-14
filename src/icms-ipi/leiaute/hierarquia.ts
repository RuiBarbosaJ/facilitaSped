// Regras de negócio do SPED Fiscal para hierarquia
const REGRAS_HIERARQUIA = {
  PREFIXO_C100: "C1",
  EXCECOES_FILHOS_C100: new Set(["C100", "C170", "C190"])
} as const;

/**
 * Verifica se um determinado registro pertence à hierarquia de filhos do C100.
 * Pela regra de negócio, registros iniciados em C1 são filhos de C100,
 * exceto o próprio C100, e os registros C170 e C190 que possuem tratamentos específicos.
 *
 * @param registro Código do registro (ex: "C101", "C170")
 * @returns boolean
 */
export function ehFilhoDeC100(registro: string): boolean {
  if (!registro || typeof registro !== "string") {
    return false;
  }
  
  const iniciaComPrefixo = registro.startsWith(REGRAS_HIERARQUIA.PREFIXO_C100);
  const ehExcecao = REGRAS_HIERARQUIA.EXCECOES_FILHOS_C100.has(registro);
  
  return iniciaComPrefixo && !ehExcecao;
}

/**
 * Extrai a letra do bloco a qual o registro pertence.
 * No SPED, a primeira letra do registro (ex: "C100") indica o seu bloco ("C").
 *
 * @param registro Código do registro
 * @returns Letra identificadora do bloco ou string vazia se inválido
 */
export function pegaBloco(registro: string): string {
  if (!registro || typeof registro !== "string") {
    return "";
  }
  
  return registro.charAt(0);
}
