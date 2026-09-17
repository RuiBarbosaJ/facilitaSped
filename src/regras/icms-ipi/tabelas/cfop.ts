/**
 * Classes de CFOP que mudam o que se espera dos campos de valor do item.
 *
 * A tabela oficial do CFOP (Ajuste SINIEF 03/24) tem centenas de códigos, e
 * carregá-la inteira aqui seria trocar um problema por outro: o que as regras
 * precisam não é do significado de cada código, e sim de UMA pergunta por
 * classe — "esta operação dá direito a crédito?", "esta saída é de produção
 * própria?". São conjuntos pequenos, estáveis e conferíveis a olho.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * AS LISTAS SÃO PARCIAIS DE PROPÓSITO, E ISSO É SEGURO
 *
 * Uma lista incompleta aqui produz FALSO NEGATIVO — a regra deixa de apontar um
 * caso que existia. Uma lista com um código a mais produz FALSO POSITIVO, que é
 * muito pior: o contador recebe um erro sobre uma operação correta e perde a
 * confiança na aba inteira. Por isso entra aqui só o código cujo significado
 * está conferido; o resto espera a tabela oficial completa, que já é uma
 * pendência declarada do dicionário.
 *
 * O primeiro dígito dá o sentido — 1, 2 e 3 entram (dentro do estado, fora do
 * estado, do exterior); 5, 6 e 7 saem —, e é por isso que cada conjunto traz as
 * três variantes do mesmo código quando elas existem.
 */

/**
 * Entradas de material de uso ou consumo, e de serviço fora do campo do ICMS.
 *
 * O crédito do ICMS sobre material de uso e consumo está vedado até a data
 * fixada pela Lei Complementar 87/96, sucessivamente prorrogada. Item que entra
 * por um destes CFOPs com base e imposto destacados está tomando um crédito que
 * a lei não dá — e o Guia Prático é explícito em que, na entrada, os campos de
 * valor do imposto só se informam quando há direito à apropriação.
 */
export const CFOPS_DE_USO_E_CONSUMO: ReadonlySet<string> = new Set([
  "1128", "2128", // compra para utilização na prestação de serviço sujeita ao ISSQN
  "1407", "2407", // compra para uso ou consumo de mercadoria sujeita a ST
  "1556", "2556", "3556", // compra de material para uso ou consumo
  "1557", "2557", // transferência de material para uso ou consumo
]);

/**
 * Entradas de bem destinado ao ativo imobilizado.
 *
 * O crédito existe, mas não é imediato nem cabe no C170: apropria-se em 48
 * parcelas pelo CIAP, no bloco G. Valor destacado aqui costuma ser o ERP
 * replicando o documento do fornecedor sem olhar o enfoque do declarante.
 */
export const CFOPS_DE_ATIVO_IMOBILIZADO: ReadonlySet<string> = new Set([
  "1406", "2406", // compra de bem para o ativo imobilizado, mercadoria sujeita a ST
  "1551", "2551", "3551", // compra de bem para o ativo imobilizado
  "1552", "2552", // transferência de bem do ativo imobilizado
]);

/**
 * Saídas de PRODUÇÃO DO ESTABELECIMENTO.
 *
 * Existe para a conferência contra o TIPO_ITEM do 0200: mercadoria cadastrada
 * como "00 — mercadoria para revenda" não sai por um CFOP de produção própria.
 * O par clássico é 5101 × 5102 — ou o cadastro do item está errado, ou o CFOP
 * deveria ser o de venda de mercadoria adquirida de terceiros.
 *
 * Cuidado ao acrescentar: vários códigos vizinhos são o espelho de REVENDA do
 * mesmo negócio (5116 é produção, 5117 é revenda; 5122 é produção, 5123 é
 * revenda), e confundir os dois inverte a regra.
 */
export const CFOPS_DE_PRODUCAO_PROPRIA: ReadonlySet<string> = new Set([
  "5101", "6101", "7101", // venda de produção do estabelecimento
  "5105", "6105", // venda de produção que não deva por ele transitar
  "5109", "6109", // venda de produção destinada à Zona Franca ou área de livre comércio
  "5111", "6111", // venda de produção remetida anteriormente em consignação industrial
  "5113", "6113", // venda de produção remetida anteriormente em consignação mercantil
  "5116", "6116", // venda de produção originada de encomenda para entrega futura
  "5118", "6118", // venda de produção entregue por conta e ordem do adquirente originário
  "5122", "6122", // venda de produção remetida para industrialização por conta do adquirente
  "5151", "6151", // transferência de produção do estabelecimento
  "5401", "6401", // venda de produção em operação com ST, na condição de substituto
]);

/** Sentido da operação pelo primeiro dígito do CFOP. */
export type SentidoDaOperacao = "entrada" | "saida";

export function sentidoDoCfop(cfop: string | null | undefined): SentidoDaOperacao | null {
  switch ((cfop ?? "").trim().charAt(0)) {
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

export interface ClasseSemCredito {
  readonly nome: string;
  /** O que a UI diz no lugar de "corrija para X". */
  readonly motivo: string;
}

/**
 * A classe de vedação do crédito a que o CFOP pertence, se pertence a alguma.
 *
 * Devolve `null` para o CFOP comum, que é a esmagadora maioria — e a saída
 * rápida que mantém a regra barata no laço de meio milhão de itens.
 */
export function classeSemCredito(cfop: string | null | undefined): ClasseSemCredito | null {
  const limpo = (cfop ?? "").trim();
  if (CFOPS_DE_USO_E_CONSUMO.has(limpo)) {
    return {
      nome: "material de uso ou consumo",
      motivo:
        "o crédito do ICMS sobre material de uso e consumo está vedado até a data da Lei Complementar 87/96",
    };
  }
  if (CFOPS_DE_ATIVO_IMOBILIZADO.has(limpo)) {
    return {
      nome: "bem do ativo imobilizado",
      motivo:
        "o crédito do ativo imobilizado se apropria em parcelas pelo CIAP, no bloco G, e não pelo destaque no item",
    };
  }
  return null;
}
