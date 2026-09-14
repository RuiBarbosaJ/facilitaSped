import { RegraAuditoria } from "./base";
import { CAD_022 } from "./CAD_022";
import { CAD_025 } from "./CAD_025";
import { EST_040 } from "./EST_040";
import { FIS_014 } from "./FIS_014";

/**
 * Registro centralizado de todas as regras de auditoria ativas do sistema.
 * Segregando as instâncias das regras para fora do motor, aplicamos
 * o Princípio de Responsabilidade Única (SRP).
 */
export const TODAS_AS_REGRAS: RegraAuditoria[] = [
  CAD_022,
  CAD_025,
  EST_040,
  FIS_014,
];
