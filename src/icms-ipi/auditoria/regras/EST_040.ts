import { percorrerFechamentos } from "../../regravacao/totalizadores";
import type { EstruturaSped } from "../../leitura/parser";
import type { RegraAuditoria } from "./base";

const CODIGO = "EST-040";
/** Índice do campo QTD_LIN nos registros de fechamento de bloco (X990). */
const INDICE_QTD_LIN = 2;

export const EST_040: RegraAuditoria = {
  codigo: CODIGO,
  nome: "Totalizador de bloco divergente",
  executar(estrutura: EstruturaSped, apontar) {
    // A contagem vem da mesma função que a regravação usa: enquanto eram dois
    // laços separados, a regra podia apontar divergência no arquivo que a
    // própria regravação tinha acabado de gerar.
    percorrerFechamentos(estrutura.linhas, (linha, linhasDoBloco) => {
      const informado = Number.parseInt(linha.campos[INDICE_QTD_LIN] || "0", 10);
      if (informado === linhasDoBloco) return;

      apontar({
        id: `${CODIGO}:${linha.nl}:QTD_LIN`,
        codigo: CODIGO,
        severidade: "alerta",
        nl: linha.nl,
        reg: linha.reg,
        campo: "QTD_LIN",
        mensagem: `Total de linhas do bloco ${linha.reg.charAt(0)} divergente. Informado: ${informado}. Calculado: ${linhasDoBloco}.`,
        esperado: String(linhasDoBloco),
        atual: String(informado),
        corrigivel: true, // A regravação já recalcula este campo.
        regra: "Guia Prático EFD ICMS/IPI — fechamento de bloco",
      });
    });
  },
};
