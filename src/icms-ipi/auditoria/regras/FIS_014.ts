import { campoDe } from "../../leiaute/acesso";
import type { EstruturaSped } from "../../leitura/parser";
import type { RegraAuditoria } from "./base";

const CODIGO = "FIS-014";

/** IND_OPER do C100: 0 = entrada/aquisição, 1 = saída/prestação. */
const OPERACAO = { ENTRADA: "0", SAIDA: "1" } as const;

/** O primeiro dígito do CFOP diz o sentido: 1/2/3 entram, 5/6/7 saem. */
function sentidoDoCfop(cfop: string): "entrada" | "saida" | null {
  switch (cfop.charAt(0)) {
    case "1":
    case "2":
    case "3":
      return "entrada";
    case "5":
    case "6":
    case "7":
      return "saida";
    default:
      return null;
  }
}

export const FIS_014: RegraAuditoria = {
  codigo: CODIGO,
  nome: "Divergência entre CFOP e tipo de operação",
  executar(estrutura: EstruturaSped, apontar) {
    for (const nota of estrutura.notas) {
      const indOper = campoDe("C100", nota.campos, "IND_OPER");
      if (indOper !== OPERACAO.ENTRADA && indOper !== OPERACAO.SAIDA) continue;

      const esperado = indOper === OPERACAO.SAIDA ? "saida" : "entrada";

      for (const item of nota.itens) {
        const cfop = campoDe("C170", item.campos, "CFOP");
        if (!cfop) continue;

        const sentido = sentidoDoCfop(cfop);
        if (sentido === null || sentido === esperado) continue;

        apontar({
          id: `${CODIGO}:${item.nl}:CFOP`,
          codigo: CODIGO,
          severidade: "erro",
          nl: item.nl,
          reg: "C170",
          campo: "CFOP",
          mensagem:
            esperado === "saida"
              ? `CFOP de entrada (${cfop}) em documento classificado como saída (IND_OPER = 1).`
              : `CFOP de saída (${cfop}) em documento classificado como entrada (IND_OPER = 0).`,
          corrigivel: false,
          regra: "Tabela CFOP x tipo de operação",
        });
      }
    }
  },
};
