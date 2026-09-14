import { registrarAchado, type EstruturaSped } from "../leitura/parser";
import { TODAS_AS_REGRAS } from "./regras";
import type { RegraAuditoria } from "./regras/base";

/**
 * Roda a bateria de auditoria sobre a estrutura já lida.
 *
 * Uma regra que lança não interrompe as outras — mas a falha VIRA UM ACHADO, em
 * vez de sumir num `console.error`. A versão anterior engolia a exceção no
 * console do worker: a tela continuava dizendo "nenhum problema encontrado"
 * enquanto uma regra inteira não tinha rodado, e o contador entregava a
 * escrituração confiando numa auditoria que não aconteceu.
 */
export function rodarMotor(
  estrutura: EstruturaSped,
  regras: readonly RegraAuditoria[] = TODAS_AS_REGRAS
): void {
  const apontar = (achado: Parameters<typeof registrarAchado>[1]) =>
    registrarAchado(estrutura, achado);

  for (const regra of regras) {
    try {
      regra.executar(estrutura, apontar);
    } catch {
      apontar({
        id: `AUD-000:${regra.codigo}`,
        codigo: "AUD-000",
        severidade: "critico",
        nl: 0,
        reg: "",
        mensagem: `A regra ${regra.codigo} (${regra.nome}) falhou e não pôde ser aplicada. A auditoria deste arquivo está incompleta.`,
        corrigivel: false,
        regra: "Motor de auditoria",
      });
    }
  }
}
