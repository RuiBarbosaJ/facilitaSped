import type { EstruturaSped } from "../../leitura/parser";
import type { Achado } from "@/regras/nucleo/contrato";

/**
 * Emite um achado.
 *
 * As regras recebem esta função em vez de escreverem direto em
 * `estrutura.achados`: é por aqui que passa o teto por código, sem o qual um
 * arquivo grande gera centenas de milhares de apontamentos e derruba a aba.
 */
export type Apontar = (achado: Achado) => void;

export interface RegraAuditoria {
  /** Código estável, citado no achado e na documentação da regra. */
  codigo: string;
  nome: string;
  executar(estrutura: EstruturaSped, apontar: Apontar): void;
}
