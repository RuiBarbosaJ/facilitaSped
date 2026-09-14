import { campoDe } from "../../leiaute/acesso";
import type { EstruturaSped } from "../../leitura/parser";
import type { RegraAuditoria } from "./base";

const CODIGO = "CAD-025";

export const CAD_025: RegraAuditoria = {
  codigo: CODIGO,
  nome: "Produto não cadastrado",
  executar(estrutura: EstruturaSped, apontar) {
    for (const nota of estrutura.notas) {
      for (const item of nota.itens) {
        const codItem = campoDe("C170", item.campos, "COD_ITEM");
        if (!codItem || estrutura.produtos.has(codItem)) continue;

        apontar({
          id: `${CODIGO}:${item.nl}:COD_ITEM`,
          codigo: CODIGO,
          severidade: "erro",
          nl: item.nl,
          reg: "C170",
          campo: "COD_ITEM",
          mensagem: `Produto '${codItem}' não cadastrado no registro 0200.`,
          corrigivel: false,
          regra: "Guia Prático EFD ICMS/IPI — registro 0200",
        });
      }
    }
  },
};
