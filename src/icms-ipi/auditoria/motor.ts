import { DICIONARIO_SPED_ICMS_IPI } from "@/regras/icms-ipi/dicionario-sped-icms-ipi";
import { REGRAS_ICMS_IPI } from "@/regras/icms-ipi/validacoes";
import { MotorSped, type ResultadoDoMotor } from "@/regras/nucleo/motor";
import { LIMITES } from "../limites";
import { registrarAchado, registrarOmitidos, type EstruturaSped } from "../leitura/parser";
import { contextoDaEstrutura } from "./contexto";
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

/**
 * Roda as regras declaradas em `src/regras/` sobre a estrutura já lida.
 *
 * Convive com `rodarMotor` em vez de substituí-lo: as quatro regras antigas
 * ainda não foram migradas, e desligá-las agora tiraria da tela conferências
 * que funcionam. Enquanto as duas coexistem, a única sobreposição conhecida é
 * FIS-014 (sentido do CFOP), que por isso NÃO foi reescrita em `regras/`.
 *
 * Três coisas que esta função existe para garantir, e que o motor antigo não dá:
 *
 * 1. **Cancelamento.** O motor recebe `cancelado` e o consulta entre regras. Sem
 *    isso o botão Cancelar é decorativo durante a fase mais longa do processo:
 *    enquanto uma função síncrona roda no worker, `self.onmessage` não é
 *    chamado e a mensagem CANCELAR fica parada na fila.
 * 2. **Teto global.** O teto por código sozinho deixa o limite real em dezenas
 *    de milhares de achados num único `postMessage`. O teto global desconta o
 *    que o motor antigo já emitiu.
 * 3. **Regra que falha não some.** O motor devolve os códigos que lançaram, e
 *    já emite um achado crítico por regra falhada. A tela dizer "nenhum
 *    problema" enquanto uma regra inteira não rodou faz o contador assinar a
 *    escrituração confiando numa conferência que não aconteceu.
 */
export function rodarValidacoes(
  estrutura: EstruturaSped,
  cancelado?: () => boolean
): ResultadoDoMotor {
  const motor = new MotorSped(DICIONARIO_SPED_ICMS_IPI, REGRAS_ICMS_IPI, {
    tetoPorCodigo: LIMITES.ACHADOS_POR_CODIGO,
    tetoGlobal: Math.max(0, LIMITES.ACHADOS_NO_TOTAL - estrutura.achados.length),
    cancelado,
  });

  const resultado = motor.executar(contextoDaEstrutura(estrutura));

  for (const achado of resultado.achados) registrarAchado(estrutura, achado);

  let omitidos = 0;
  for (const quantidade of resultado.omitidosPorCodigo.values()) omitidos += quantidade;
  registrarOmitidos(estrutura, omitidos);

  return resultado;
}
