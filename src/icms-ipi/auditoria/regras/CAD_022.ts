import { campoDe } from "../../leiaute/acesso";
import type { EstruturaSped } from "../../leitura/parser";
import type { RegraAuditoria } from "./base";

const CODIGO = "CAD-022";

export const CAD_022: RegraAuditoria = {
  codigo: CODIGO,
  nome: "Unidade de medida não cadastrada",
  executar(estrutura: EstruturaSped, apontar) {
    for (const nota of estrutura.notas) {
      for (const item of nota.itens) {
        const unid = campoDe("C170", item.campos, "UNID");
        if (!unid || estrutura.unidades.has(unid)) continue;

        apontar({
          id: `${CODIGO}:${item.nl}:UNID`,
          codigo: CODIGO,
          severidade: "erro",
          nl: item.nl,
          reg: "C170",
          campo: "UNID",
          mensagem: `Unidade de medida '${unid}' não cadastrada no registro 0190.`,
          corrigivel: false,
          regra: "Guia Prático EFD ICMS/IPI — registro 0190",
        });
      }
    }
  },
};
