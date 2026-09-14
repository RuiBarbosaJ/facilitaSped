/**
 * Significado dos códigos fechados do SPED.
 *
 * Num planilhão de escrituração quase toda coluna interessante guarda um
 * código: filtrar por "IND_OPER = 0" só ajuda quem já sabe de cor que 0 é
 * entrada. Aqui o menu de filtro passa a mostrar "0 — Entrada ou aquisição".
 *
 * Só entram tabelas de domínio FECHADO e estável do Guia Prático EFD ICMS/IPI.
 * CFOP, NCM, CEST e códigos de município têm milhares de valores e ficam de
 * fora de propósito: a coluna continua listando o valor cru, que é o correto —
 * melhor nenhuma descrição do que uma descrição errada num arquivo fiscal.
 */

type Dominio = Readonly<Record<string, string>>;

/** Primeiro dígito do CST do ICMS: origem da mercadoria (Tabela A). */
const ORIGEM_DA_MERCADORIA: Dominio = {
  "0": "Nacional",
  "1": "Estrangeira — importação direta",
  "2": "Estrangeira — adquirida no mercado interno",
  "3": "Nacional com conteúdo de importação acima de 40%",
  "4": "Nacional — processos produtivos básicos",
  "5": "Nacional com conteúdo de importação até 40%",
  "6": "Estrangeira — importação direta, sem similar nacional",
  "7": "Estrangeira — mercado interno, sem similar nacional",
  "8": "Nacional com conteúdo de importação acima de 70%",
};

/** Dois últimos dígitos do CST do ICMS: tributação (Tabela B). */
const TRIBUTACAO_DO_ICMS: Dominio = {
  "00": "Tributada integralmente",
  "10": "Tributada e com cobrança do ICMS por substituição tributária",
  "20": "Com redução da base de cálculo",
  "30": "Isenta ou não tributada e com cobrança do ICMS por ST",
  "40": "Isenta",
  "41": "Não tributada",
  "50": "Suspensão",
  "51": "Diferimento",
  "60": "ICMS cobrado anteriormente por substituição tributária",
  "70": "Com redução da base de cálculo e cobrança do ICMS por ST",
  "90": "Outras",
};

/**
 * Domínios por nome de campo. A chave é o nome do campo no layout, então a
 * mesma tabela serve a todos os registros que usam aquele campo.
 */
const POR_CAMPO: Readonly<Record<string, Dominio>> = {
  COD_FIN: {
    "0": "Remessa do arquivo original",
    "1": "Remessa do arquivo substituto",
  },
  IND_PERFIL: {
    A: "Perfil A",
    B: "Perfil B",
    C: "Perfil C",
  },
  IND_ATIV: {
    "0": "Industrial ou equiparado a industrial",
    "1": "Outros",
  },
  TIPO_ITEM: {
    "00": "Mercadoria para revenda",
    "01": "Matéria-prima",
    "02": "Embalagem",
    "03": "Produto em processo",
    "04": "Produto acabado",
    "05": "Subproduto",
    "06": "Produto intermediário",
    "07": "Material de uso e consumo",
    "08": "Ativo imobilizado",
    "09": "Serviços",
    "10": "Outros insumos",
    "99": "Outras",
  },
  IND_OPER: {
    "0": "Entrada ou aquisição",
    "1": "Saída ou prestação",
  },
  IND_EMIT: {
    "0": "Emissão própria",
    "1": "Emissão por terceiros",
  },
  COD_SIT: {
    "00": "Documento regular",
    "01": "Escrituração extemporânea de documento regular",
    "02": "Documento cancelado",
    "03": "Escrituração extemporânea de documento cancelado",
    "04": "NF-e ou CT-e denegado",
    "05": "NF-e ou CT-e com numeração inutilizada",
    "06": "Documento fiscal complementar",
    "07": "Escrituração extemporânea de documento complementar",
    "08": "Documento fiscal emitido com base em regime especial ou norma específica",
  },
  IND_MOV: {
    "0": "Com movimentação física do item",
    "1": "Sem movimentação física do item",
  },
  IND_APUR: {
    "0": "Apuração mensal do IPI",
    "1": "Apuração decendial do IPI",
  },
};

/** O CST do ICMS é a origem (1 dígito) seguida da tributação (2 dígitos). */
function descreverCstIcms(valor: string): string | undefined {
  const codigo = valor.trim();
  if (codigo.length !== 3) return undefined;

  const origem = ORIGEM_DA_MERCADORIA[codigo[0]];
  const tributacao = TRIBUTACAO_DO_ICMS[codigo.slice(1)];
  if (!origem || !tributacao) return undefined;

  return `${tributacao} · ${origem}`;
}

/**
 * O que este valor significa nesta coluna, ou `undefined` quando o campo não
 * tem domínio fechado — aí o menu mostra só o valor, como sempre mostrou.
 */
export function descreverValor(coluna: string, valor: string): string | undefined {
  if (!valor) return undefined;
  if (coluna === "CST_ICMS") return descreverCstIcms(valor);
  return POR_CAMPO[coluna]?.[valor.trim()];
}

/** Se a coluna tem descrições de valor, o menu ganha uma linha de ajuda. */
export function temDominio(coluna: string): boolean {
  return coluna === "CST_ICMS" || POR_CAMPO[coluna] !== undefined;
}
