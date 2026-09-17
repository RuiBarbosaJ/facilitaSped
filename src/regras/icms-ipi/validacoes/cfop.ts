import { codigoNormalizado, tributacaoDoCstIcms } from "../../nucleo/acesso";
import type { RegraSped } from "../../nucleo/contrato";
import { CFOPS_DE_PRODUCAO_PROPRIA, classeSemCredito, sentidoDoCfop } from "../tabelas/cfop";
import { comoValorSped, numero, temMovimento, texto } from "./comum";

/**
 * Coerência entre o CFOP e o resto do item.
 *
 * O CFOP é a única coisa no C170 que diz o que a operação É. O CST diz como ela
 * foi tributada, e os valores dizem quanto — mas quem decide se aquele crédito
 * podia ser tomado é o CFOP. Daí estas regras existirem separadas da matriz da
 * Tabela B: elas não conferem o item contra si mesmo, e sim contra a natureza
 * da operação.
 */

/* ───────── FIS-C170-019 — crédito destacado onde a lei não dá crédito ────── */

const CODIGO_SEM_CREDITO = "FIS-C170-019";
const TRIBUTACOES_COM_CREDITO = new Set(["00", "10", "20", "70"]);

/**
 * Entrada que não dá crédito e mesmo assim traz imposto destacado.
 *
 * O Guia Prático é explícito: na entrada, os campos de base, alíquota e valor
 * do imposto só se informam quando o adquirente TEM DIREITO à apropriação do
 * crédito — é o enfoque do declarante. Material de uso e consumo não dá crédito
 * até a data da Lei Complementar 87/96; bem do ativo dá, mas em parcelas pelo
 * CIAP, no bloco G, e não pelo destaque no item.
 *
 * ALERTA, e não erro, por duas razões que se somam: a lista de CFOPs em
 * `tabelas/cfop.ts` é reconhecidamente parcial, e há gerador que replica o
 * documento do fornecedor nos campos do item e estorna o crédito depois, por
 * ajuste na apuração — arranjo discutível, mas que não é o erro que esta regra
 * descreve. Promover a erro exige a tabela de CFOP completa, que já é pendência
 * declarada do dicionário.
 */
export const FIS_C170_019: RegraSped = {
  codigo: CODIGO_SEM_CREDITO,
  nome: "Crédito de ICMS destacado em operação que não o admite",
  regraDoDicionario: CODIGO_SEM_CREDITO,
  executar(contexto, apontar, podeApontar) {
    for (const documento of contexto.documentos) {
      if (!temMovimento(documento)) continue;

      for (const item of documento.itens) {
        const cfop = texto(item.campos, "CFOP");
        if (sentidoDoCfop(cfop) !== "entrada") continue;

        const classe = classeSemCredito(cfop);
        if (!classe) continue;

        const imposto = numero(item.campos, "VL_ICMS") ?? 0;
        const base = numero(item.campos, "VL_BC_ICMS") ?? 0;
        if (imposto === 0 && base === 0) continue;

        const tributacao = tributacaoDoCstIcms(texto(item.campos, "CST_ICMS"));
        if (tributacao === null || !TRIBUTACOES_COM_CREDITO.has(tributacao)) continue;

        if (!podeApontar(CODIGO_SEM_CREDITO)) return;

        apontar({
          id: `${CODIGO_SEM_CREDITO}:${item.nl}:VL_ICMS`,
          codigo: CODIGO_SEM_CREDITO,
          severidade: "alerta",
          nl: item.nl,
          reg: "C170",
          campo: "VL_ICMS",
          mensagem: `Entrada de ${classe.nome} (CFOP ${cfop}) com ICMS apropriado no item, sob CST de tributação ${tributacao}. Na entrada, os campos de imposto só se preenchem quando há direito ao crédito — e aqui ${classe.motivo}.`,
          atual: comoValorSped(imposto),
          esperado: "0,00",
          corrigivel: false,
          regra: "Guia Prático EFD ICMS/IPI — enfoque do declarante; LC 87/96, art. 33",
        });
      }
    }
  },
};

/* ────────── FIS-C170-020 — revenda saindo como produção do estabelecimento ─ */

const CODIGO_TIPO_ITEM = "FIS-C170-020";
/** TIPO_ITEM do 0200: 00 = mercadoria para revenda. */
const MERCADORIA_PARA_REVENDA = "00";

/**
 * Mercadoria cadastrada para revenda saindo por CFOP de produção própria.
 *
 * O par clássico é o item com TIPO_ITEM 00 saindo em 5101: ou o cadastro do
 * item está errado, ou o CFOP deveria ser o de venda de mercadoria adquirida de
 * terceiros. A regra não escolhe qual — as duas correções são possíveis e só
 * quem conhece a operação sabe qual vale.
 *
 * O TIPO_ITEM não está no C170: vem do cadastro do produto, pelo COD_ITEM. A
 * consulta é `contexto.produtos.get(cod)` e nunca uma varredura: são ~400 mil
 * itens perguntando a um cadastro que pode ter dezenas de milhares de linhas.
 */
export const FIS_C170_020: RegraSped = {
  codigo: CODIGO_TIPO_ITEM,
  nome: "Tipo do item incompatível com o CFOP",
  regraDoDicionario: CODIGO_TIPO_ITEM,
  executar(contexto, apontar, podeApontar) {
    if (contexto.produtos.size === 0) return;

    for (const documento of contexto.documentos) {
      if (!temMovimento(documento)) continue;

      for (const item of documento.itens) {
        const cfop = texto(item.campos, "CFOP");
        if (!CFOPS_DE_PRODUCAO_PROPRIA.has(cfop)) continue;

        const codItem = texto(item.campos, "COD_ITEM");
        if (codItem === "") continue;

        const cadastro = contexto.produtos.get(codItem);
        if (!cadastro) continue; // cadastro ausente é outro achado, de outra regra

        const tipo = codigoNormalizado(texto(cadastro.campos, "TIPO_ITEM"), 2);
        if (tipo !== MERCADORIA_PARA_REVENDA) continue;

        if (!podeApontar(CODIGO_TIPO_ITEM)) return;

        apontar({
          id: `${CODIGO_TIPO_ITEM}:${item.nl}:CFOP`,
          codigo: CODIGO_TIPO_ITEM,
          severidade: "erro",
          nl: item.nl,
          reg: "C170",
          campo: "CFOP",
          mensagem: `O item sai com CFOP ${cfop}, de produção do estabelecimento, e está cadastrado no 0200 como mercadoria para revenda (TIPO_ITEM 00). Ou o cadastro do item está errado, ou o CFOP deveria ser o de venda de mercadoria adquirida de terceiros.`,
          atual: cfop,
          corrigivel: false,
          regra: "Tabela CFOP (Ajuste SINIEF 03/24) × Tabela 4.4.1 (TIPO_ITEM)",
        });
      }
    }
  },
};
