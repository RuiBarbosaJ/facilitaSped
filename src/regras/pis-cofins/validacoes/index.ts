import type { RegraSped } from "../../nucleo/contrato";

/**
 * Regras da aba PIS/COFINS.
 *
 * Vazio de propósito: o escopo entregue foi ICMS/IPI. A lista existe para que
 * montar o motor desta aba seja um `new MotorSped(DICIONARIO_SPED_PIS_COFINS,
 * REGRAS_PIS_COFINS)` — a mesma linha da outra aba, com as duas listas
 * incomunicáveis.
 */
export const REGRAS_PIS_COFINS: readonly RegraSped[] = [];
