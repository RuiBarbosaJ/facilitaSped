/**
 * "10064000" → "1006.40.00", como na TIPI e na nota fiscal.
 *
 * Só para ler. O dado continua sem pontos — é assim que o arquivo SPED e o XML
 * da NF-e o carregam, e é o que se copia e o que se exporta. Oito dígitos
 * seguidos não se conferem de olho; agrupados, sim.
 */
export function formatarNcm(ncm: string): string {
  if (ncm.length === 2) return `Cap. ${ncm}`;
  if (ncm.length <= 4) return ncm;
  if (ncm.length <= 6) return `${ncm.slice(0, 4)}.${ncm.slice(4)}`;
  return `${ncm.slice(0, 4)}.${ncm.slice(4, 6)}.${ncm.slice(6)}`;
}
