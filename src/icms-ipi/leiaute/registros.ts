import type { DefRegistro } from "./tipos";

export const LAYOUT = {
  "0000": {
    reg: "0000",
    bloco: "0",
    nivel: 0,
    pai: null,
    totalCampos: 15,
    campos: [
      { nome: "COD_VER", indice: 2, tipo: "codigo", titulo: "Versão", obrigatorio: true },
      { nome: "COD_FIN", indice: 3, tipo: "codigo", titulo: "Finalidade", obrigatorio: true },
      { nome: "DT_INI", indice: 4, tipo: "data", titulo: "Data Inicial", obrigatorio: true },
      { nome: "DT_FIN", indice: 5, tipo: "data", titulo: "Data Final", obrigatorio: true },
      { nome: "NOME", indice: 6, tipo: "texto", titulo: "Nome", obrigatorio: true },
      { nome: "CNPJ", indice: 7, tipo: "codigo", titulo: "CNPJ" },
      { nome: "CPF", indice: 8, tipo: "codigo", titulo: "CPF" },
      { nome: "UF", indice: 9, tipo: "codigo", titulo: "UF", obrigatorio: true },
      { nome: "IE", indice: 10, tipo: "codigo", titulo: "IE", obrigatorio: true },
      { nome: "COD_MUN", indice: 11, tipo: "codigo", titulo: "Município", obrigatorio: true },
      { nome: "IM", indice: 12, tipo: "codigo", titulo: "IM" },
      { nome: "SUFRAMA", indice: 13, tipo: "codigo", titulo: "SUFRAMA" },
      { nome: "IND_PERFIL", indice: 14, tipo: "codigo", titulo: "Perfil", obrigatorio: true },
      { nome: "IND_ATIV", indice: 15, tipo: "codigo", titulo: "Atividade", obrigatorio: true },
    ]
  },
  "0150": {
    reg: "0150",
    bloco: "0",
    nivel: 2,
    pai: ["0000"],
    totalCampos: 13,
    campos: [
      { nome: "COD_PART", indice: 2, tipo: "codigo", titulo: "Código", obrigatorio: true },
      { nome: "NOME", indice: 3, tipo: "texto", titulo: "Nome", obrigatorio: true },
      { nome: "COD_PAIS", indice: 4, tipo: "codigo", titulo: "País", obrigatorio: true },
      { nome: "CNPJ", indice: 5, tipo: "codigo", titulo: "CNPJ" },
      { nome: "CPF", indice: 6, tipo: "codigo", titulo: "CPF" },
      { nome: "IE", indice: 7, tipo: "codigo", titulo: "IE" },
      { nome: "COD_MUN", indice: 8, tipo: "codigo", titulo: "Município" },
      { nome: "SUFRAMA", indice: 9, tipo: "codigo", titulo: "SUFRAMA" },
      { nome: "END", indice: 10, tipo: "texto", titulo: "Endereço", obrigatorio: true },
      { nome: "NUM", indice: 11, tipo: "texto", titulo: "Número" },
      { nome: "COMPL", indice: 12, tipo: "texto", titulo: "Complemento" },
      { nome: "BAIRRO", indice: 13, tipo: "texto", titulo: "Bairro" },
    ]
  },
  "0190": {
    reg: "0190",
    bloco: "0",
    nivel: 2,
    pai: ["0000"],
    totalCampos: 3,
    campos: [
      { nome: "UNID", indice: 2, tipo: "codigo", titulo: "Unidade", obrigatorio: true },
      { nome: "DESCR", indice: 3, tipo: "texto", titulo: "Descrição", obrigatorio: true },
    ]
  },
  "0200": {
    reg: "0200",
    bloco: "0",
    nivel: 2,
    pai: ["0000"],
    totalCampos: 13,
    campos: [
      { nome: "COD_ITEM", indice: 2, tipo: "codigo", titulo: "Código", obrigatorio: true },
      { nome: "DESCR_ITEM", indice: 3, tipo: "texto", titulo: "Descrição", obrigatorio: true },
      { nome: "COD_BARRA", indice: 4, tipo: "codigo", titulo: "Cód. Barras" },
      { nome: "COD_ANT_ITEM", indice: 5, tipo: "codigo", titulo: "Cód. Anterior" },
      { nome: "UNID_INV", indice: 6, tipo: "codigo", titulo: "Unidade", obrigatorio: true },
      { nome: "TIPO_ITEM", indice: 7, tipo: "codigo", titulo: "Tipo", obrigatorio: true },
      { nome: "COD_NCM", indice: 8, tipo: "codigo", titulo: "NCM" },
      { nome: "EX_IPI", indice: 9, tipo: "codigo", titulo: "Exceção IPI" },
      { nome: "COD_GEN", indice: 10, tipo: "codigo", titulo: "Gênero" },
      { nome: "COD_LST", indice: 11, tipo: "codigo", titulo: "Cód. Serviço" },
      { nome: "ALIQ_ICMS", indice: 12, tipo: "aliquota", titulo: "Alíq. ICMS" },
      { nome: "CEST", indice: 13, tipo: "codigo", titulo: "CEST" },
    ]
  },
  "0400": {
    reg: "0400",
    bloco: "0",
    nivel: 2,
    pai: ["0000"],
    totalCampos: 3,
    campos: [
      { nome: "COD_NAT", indice: 2, tipo: "codigo", titulo: "Código", obrigatorio: true },
      { nome: "DESCR_NAT", indice: 3, tipo: "texto", titulo: "Descrição", obrigatorio: true },
    ]
  },
  "0450": {
    reg: "0450",
    bloco: "0",
    nivel: 2,
    pai: ["0000"],
    totalCampos: 3,
    campos: [
      { nome: "COD_INF", indice: 2, tipo: "codigo", titulo: "Código", obrigatorio: true },
      { nome: "TXT", indice: 3, tipo: "texto", titulo: "Texto", obrigatorio: true },
    ]
  },
  "C100": {
    reg: "C100",
    bloco: "C",
    nivel: 2,
    pai: ["0000"],
    totalCampos: 29,
    campos: [
      { nome: "IND_OPER", indice: 2, tipo: "codigo", titulo: "Tipo Operação", obrigatorio: true },
      { nome: "IND_EMIT", indice: 3, tipo: "codigo", titulo: "Emitente", obrigatorio: true },
      { nome: "COD_PART", indice: 4, tipo: "codigo", titulo: "Participante" },
      { nome: "COD_MOD", indice: 5, tipo: "codigo", titulo: "Modelo", obrigatorio: true },
      { nome: "COD_SIT", indice: 6, tipo: "codigo", titulo: "Situação", obrigatorio: true },
      { nome: "SER", indice: 7, tipo: "texto", titulo: "Série" },
      { nome: "NUM_DOC", indice: 8, tipo: "codigo", titulo: "Nº Doc.", obrigatorio: true },
      { nome: "CHV_NFE", indice: 9, tipo: "codigo", titulo: "Chave NF-e" },
      { nome: "DT_DOC", indice: 10, tipo: "data", titulo: "Data Doc.", obrigatorio: true },
      { nome: "DT_E_S", indice: 11, tipo: "data", titulo: "Data E/S" },
      { nome: "VL_DOC", indice: 12, tipo: "valor", titulo: "Vl. Doc.", obrigatorio: true },
      { nome: "IND_PGTO", indice: 13, tipo: "codigo", titulo: "Pagamento" },
      { nome: "VL_DESC", indice: 14, tipo: "valor", titulo: "Vl. Desc." },
      { nome: "VL_ABAT_NT", indice: 15, tipo: "valor", titulo: "Vl. Abat." },
      { nome: "VL_MERC", indice: 16, tipo: "valor", titulo: "Vl. Merc." },
      { nome: "IND_FRT", indice: 17, tipo: "codigo", titulo: "Tipo Frete" },
      { nome: "VL_FRT", indice: 18, tipo: "valor", titulo: "Vl. Frete" },
      { nome: "VL_SEG", indice: 19, tipo: "valor", titulo: "Vl. Seguro" },
      { nome: "VL_OUT_DA", indice: 20, tipo: "valor", titulo: "Outras Desp." },
      { nome: "VL_BC_ICMS", indice: 21, tipo: "valor", titulo: "BC ICMS" },
      { nome: "VL_ICMS", indice: 22, tipo: "valor", titulo: "Vl. ICMS" },
      { nome: "VL_BC_ICMS_ST", indice: 23, tipo: "valor", titulo: "BC ST" },
      { nome: "VL_ICMS_ST", indice: 24, tipo: "valor", titulo: "Vl. ST" },
      { nome: "VL_IPI", indice: 25, tipo: "valor", titulo: "Vl. IPI" },
      { nome: "VL_PIS", indice: 26, tipo: "valor", titulo: "Vl. PIS" },
      { nome: "VL_COFINS", indice: 27, tipo: "valor", titulo: "Vl. COFINS" },
      { nome: "VL_PIS_ST", indice: 28, tipo: "valor", titulo: "Vl. PIS ST" },
      { nome: "VL_COFINS_ST", indice: 29, tipo: "valor", titulo: "Vl. COFINS ST" },
    ]
  },
  "C170": {
    reg: "C170",
    bloco: "C",
    nivel: 3,
    pai: ["C100"],
    totalCampos: 38,
    campos: [
      { nome: "NUM_ITEM", indice: 2, tipo: "codigo", titulo: "Nº Item", obrigatorio: true },
      { nome: "COD_ITEM", indice: 3, tipo: "codigo", titulo: "Código", obrigatorio: true },
      { nome: "DESCR_COMPL", indice: 4, tipo: "texto", titulo: "Descr. Compl." },
      { nome: "QTD", indice: 5, tipo: "quantidade", titulo: "Qtd", obrigatorio: true },
      { nome: "UNID", indice: 6, tipo: "codigo", titulo: "Un", obrigatorio: true },
      { nome: "VL_ITEM", indice: 7, tipo: "valor", titulo: "Vl. Item", obrigatorio: true },
      { nome: "VL_DESC", indice: 8, tipo: "valor", titulo: "Desconto" },
      { nome: "IND_MOV", indice: 9, tipo: "codigo", titulo: "Mov." },
      { nome: "CST_ICMS", indice: 10, tipo: "codigo", titulo: "CST ICMS", obrigatorio: true },
      { nome: "CFOP", indice: 11, tipo: "codigo", titulo: "CFOP", obrigatorio: true },
      { nome: "COD_NAT", indice: 12, tipo: "codigo", titulo: "Nat." },
      { nome: "VL_BC_ICMS", indice: 13, tipo: "valor", titulo: "BC ICMS" },
      { nome: "ALIQ_ICMS", indice: 14, tipo: "aliquota", titulo: "Alíq. ICMS" },
      { nome: "VL_ICMS", indice: 15, tipo: "valor", titulo: "Vl. ICMS" },
      { nome: "VL_BC_ICMS_ST", indice: 16, tipo: "valor", titulo: "BC ST" },
      { nome: "ALIQ_ST", indice: 17, tipo: "aliquota", titulo: "Alíq. ST" },
      { nome: "VL_ICMS_ST", indice: 18, tipo: "valor", titulo: "Vl. ST" },
      { nome: "IND_APUR", indice: 19, tipo: "codigo", titulo: "Apur. IPI" },
      { nome: "CST_IPI", indice: 20, tipo: "codigo", titulo: "CST IPI" },
      { nome: "COD_ENQ", indice: 21, tipo: "codigo", titulo: "Enquadramento IPI" },
      { nome: "VL_BC_IPI", indice: 22, tipo: "valor", titulo: "BC IPI" },
      { nome: "ALIQ_IPI", indice: 23, tipo: "aliquota", titulo: "Alíq. IPI" },
      { nome: "VL_IPI", indice: 24, tipo: "valor", titulo: "Vl. IPI" },
      { nome: "CST_PIS", indice: 25, tipo: "codigo", titulo: "CST PIS" },
      { nome: "VL_BC_PIS", indice: 26, tipo: "valor", titulo: "BC PIS" },
      { nome: "ALIQ_PIS_PERC", indice: 27, tipo: "aliquota", titulo: "Alíq. PIS %" },
      { nome: "QUANT_BC_PIS", indice: 28, tipo: "quantidade", titulo: "Qtd. PIS" },
      { nome: "ALIQ_PIS_R$", indice: 29, tipo: "valor", titulo: "Alíq. PIS R$" },
      { nome: "VL_PIS", indice: 30, tipo: "valor", titulo: "Vl. PIS" },
      { nome: "CST_COFINS", indice: 31, tipo: "codigo", titulo: "CST COFINS" },
      { nome: "VL_BC_COFINS", indice: 32, tipo: "valor", titulo: "BC COFINS" },
      { nome: "ALIQ_COFINS_PERC", indice: 33, tipo: "aliquota", titulo: "Alíq. COFINS %" },
      { nome: "QUANT_BC_COFINS", indice: 34, tipo: "quantidade", titulo: "Qtd. COFINS" },
      { nome: "ALIQ_COFINS_R$", indice: 35, tipo: "valor", titulo: "Alíq. COFINS R$" },
      { nome: "VL_COFINS", indice: 36, tipo: "valor", titulo: "Vl. COFINS" },
      { nome: "COD_CTA", indice: 37, tipo: "codigo", titulo: "Conta Analítica" },
      { nome: "VL_ABAT_NT", indice: 38, tipo: "valor", titulo: "Vl. Abat." },
    ]
  },
  "C190": {
    reg: "C190",
    bloco: "C",
    nivel: 3,
    pai: ["C100"],
    totalCampos: 12,
    campos: [
      { nome: "CST_ICMS", indice: 2, tipo: "codigo", titulo: "CST ICMS", obrigatorio: true },
      { nome: "CFOP", indice: 3, tipo: "codigo", titulo: "CFOP", obrigatorio: true },
      { nome: "ALIQ_ICMS", indice: 4, tipo: "aliquota", titulo: "Alíq. ICMS" },
      { nome: "VL_OPR", indice: 5, tipo: "valor", titulo: "Vl. Operação", obrigatorio: true },
      { nome: "VL_BC_ICMS", indice: 6, tipo: "valor", titulo: "BC ICMS", obrigatorio: true },
      { nome: "VL_ICMS", indice: 7, tipo: "valor", titulo: "Vl. ICMS", obrigatorio: true },
      { nome: "VL_BC_ICMS_ST", indice: 8, tipo: "valor", titulo: "BC ST", obrigatorio: true },
      { nome: "VL_ICMS_ST", indice: 9, tipo: "valor", titulo: "Vl. ST", obrigatorio: true },
      { nome: "VL_RED_BC", indice: 10, tipo: "valor", titulo: "Vl. Red. BC", obrigatorio: true },
      { nome: "VL_IPI", indice: 11, tipo: "valor", titulo: "Vl. IPI", obrigatorio: true },
      { nome: "COD_OBS", indice: 12, tipo: "codigo", titulo: "Cód. Obs." },
    ]
  },
  "E110": {
    reg: "E110",
    bloco: "E",
    nivel: 3,
    pai: ["E100"],
    totalCampos: 15,
    campos: [
      { nome: "VL_TOT_DEBITOS", indice: 2, tipo: "valor", titulo: "Tot. Débitos", obrigatorio: true },
      { nome: "VL_AJ_DEBITOS", indice: 3, tipo: "valor", titulo: "Aj. Débitos", obrigatorio: true },
      { nome: "VL_TOT_AJ_DEBITOS", indice: 4, tipo: "valor", titulo: "Tot. Aj. Déb.", obrigatorio: true },
      { nome: "VL_ESTORNOS_CRED", indice: 5, tipo: "valor", titulo: "Estorno Créd.", obrigatorio: true },
      { nome: "VL_TOT_CREDITOS", indice: 6, tipo: "valor", titulo: "Tot. Créditos", obrigatorio: true },
      { nome: "VL_AJ_CREDITOS", indice: 7, tipo: "valor", titulo: "Aj. Créditos", obrigatorio: true },
      { nome: "VL_TOT_AJ_CREDITOS", indice: 8, tipo: "valor", titulo: "Tot. Aj. Créd.", obrigatorio: true },
      { nome: "VL_ESTORNOS_DEB", indice: 9, tipo: "valor", titulo: "Estorno Déb.", obrigatorio: true },
      { nome: "VL_SLD_CREDOR_ANT", indice: 10, tipo: "valor", titulo: "Sld. Credor Ant.", obrigatorio: true },
      { nome: "VL_SLD_APURADO", indice: 11, tipo: "valor", titulo: "Sld. Apurado", obrigatorio: true },
      { nome: "VL_TOT_DED", indice: 12, tipo: "valor", titulo: "Tot. Deduções", obrigatorio: true },
      { nome: "VL_ICMS_RECOLHER", indice: 13, tipo: "valor", titulo: "ICMS a Recolher", obrigatorio: true },
      { nome: "VL_SLD_CREDOR_TRANSPORTAR", indice: 14, tipo: "valor", titulo: "Sld. Credor a Transportar", obrigatorio: true },
      { nome: "DEB_ESP", indice: 15, tipo: "valor", titulo: "Déb. Especial", obrigatorio: true },
    ]
  },

  /*
   * Abertura e fechamento de cada bloco.
   *
   * Aparecem em TODO arquivo e sao os registros mais estaveis do leiaute: um
   * campo cada, e o Ato COTEPE nao os altera. Estavam fora do dicionario, e
   * por isso todo arquivo trazia 0001, C001, C990, E001, E990, 9001 e 9990 na
   * lista de "fora do escopo de auditoria" — ruido puro, justamente nos
   * registros mais triviais de conferir.
   *
   * Com eles aqui, a conferencia de quantidade de campos passa a valer para os
   * fechamentos, que e onde o PVA mais recusa arquivo: um X990 com QTD_LIN
   * errado reprova a entrega inteira.
   */
  "0001": {
    reg: "0001",
    bloco: "0",
    nivel: 1,
    pai: ["0000"],
    totalCampos: 2,
    campos: [
      { nome: "IND_MOV", indice: 2, tipo: "codigo", titulo: "Movimento", obrigatorio: true },
    ]
  },
  "0990": {
    reg: "0990",
    bloco: "0",
    nivel: 1,
    pai: ["0001"],
    totalCampos: 2,
    campos: [
      { nome: "QTD_LIN", indice: 2, tipo: "quantidade", titulo: "Qtd. Linhas", obrigatorio: true },
    ]
  },
  "B001": {
    reg: "B001",
    bloco: "B",
    nivel: 1,
    pai: ["0000"],
    totalCampos: 2,
    campos: [
      { nome: "IND_MOV", indice: 2, tipo: "codigo", titulo: "Movimento", obrigatorio: true },
    ]
  },
  "B990": {
    reg: "B990",
    bloco: "B",
    nivel: 1,
    pai: ["B001"],
    totalCampos: 2,
    campos: [
      { nome: "QTD_LIN", indice: 2, tipo: "quantidade", titulo: "Qtd. Linhas", obrigatorio: true },
    ]
  },
  "C001": {
    reg: "C001",
    bloco: "C",
    nivel: 1,
    pai: ["0000"],
    totalCampos: 2,
    campos: [
      { nome: "IND_MOV", indice: 2, tipo: "codigo", titulo: "Movimento", obrigatorio: true },
    ]
  },
  "C990": {
    reg: "C990",
    bloco: "C",
    nivel: 1,
    pai: ["C001"],
    totalCampos: 2,
    campos: [
      { nome: "QTD_LIN", indice: 2, tipo: "quantidade", titulo: "Qtd. Linhas", obrigatorio: true },
    ]
  },
  "D001": {
    reg: "D001",
    bloco: "D",
    nivel: 1,
    pai: ["0000"],
    totalCampos: 2,
    campos: [
      { nome: "IND_MOV", indice: 2, tipo: "codigo", titulo: "Movimento", obrigatorio: true },
    ]
  },
  "D990": {
    reg: "D990",
    bloco: "D",
    nivel: 1,
    pai: ["D001"],
    totalCampos: 2,
    campos: [
      { nome: "QTD_LIN", indice: 2, tipo: "quantidade", titulo: "Qtd. Linhas", obrigatorio: true },
    ]
  },
  "E001": {
    reg: "E001",
    bloco: "E",
    nivel: 1,
    pai: ["0000"],
    totalCampos: 2,
    campos: [
      { nome: "IND_MOV", indice: 2, tipo: "codigo", titulo: "Movimento", obrigatorio: true },
    ]
  },
  "E990": {
    reg: "E990",
    bloco: "E",
    nivel: 1,
    pai: ["E001"],
    totalCampos: 2,
    campos: [
      { nome: "QTD_LIN", indice: 2, tipo: "quantidade", titulo: "Qtd. Linhas", obrigatorio: true },
    ]
  },
  "G001": {
    reg: "G001",
    bloco: "G",
    nivel: 1,
    pai: ["0000"],
    totalCampos: 2,
    campos: [
      { nome: "IND_MOV", indice: 2, tipo: "codigo", titulo: "Movimento", obrigatorio: true },
    ]
  },
  "G990": {
    reg: "G990",
    bloco: "G",
    nivel: 1,
    pai: ["G001"],
    totalCampos: 2,
    campos: [
      { nome: "QTD_LIN", indice: 2, tipo: "quantidade", titulo: "Qtd. Linhas", obrigatorio: true },
    ]
  },
  "H001": {
    reg: "H001",
    bloco: "H",
    nivel: 1,
    pai: ["0000"],
    totalCampos: 2,
    campos: [
      { nome: "IND_MOV", indice: 2, tipo: "codigo", titulo: "Movimento", obrigatorio: true },
    ]
  },
  "H990": {
    reg: "H990",
    bloco: "H",
    nivel: 1,
    pai: ["H001"],
    totalCampos: 2,
    campos: [
      { nome: "QTD_LIN", indice: 2, tipo: "quantidade", titulo: "Qtd. Linhas", obrigatorio: true },
    ]
  },
  "K001": {
    reg: "K001",
    bloco: "K",
    nivel: 1,
    pai: ["0000"],
    totalCampos: 2,
    campos: [
      { nome: "IND_MOV", indice: 2, tipo: "codigo", titulo: "Movimento", obrigatorio: true },
    ]
  },
  "K990": {
    reg: "K990",
    bloco: "K",
    nivel: 1,
    pai: ["K001"],
    totalCampos: 2,
    campos: [
      { nome: "QTD_LIN", indice: 2, tipo: "quantidade", titulo: "Qtd. Linhas", obrigatorio: true },
    ]
  },
  "1001": {
    reg: "1001",
    bloco: "1",
    nivel: 1,
    pai: ["0000"],
    totalCampos: 2,
    campos: [
      { nome: "IND_MOV", indice: 2, tipo: "codigo", titulo: "Movimento", obrigatorio: true },
    ]
  },
  "1990": {
    reg: "1990",
    bloco: "1",
    nivel: 1,
    pai: ["1001"],
    totalCampos: 2,
    campos: [
      { nome: "QTD_LIN", indice: 2, tipo: "quantidade", titulo: "Qtd. Linhas", obrigatorio: true },
    ]
  },
  "9001": {
    reg: "9001",
    bloco: "9",
    nivel: 1,
    pai: ["0000"],
    totalCampos: 2,
    campos: [
      { nome: "IND_MOV", indice: 2, tipo: "codigo", titulo: "Movimento", obrigatorio: true },
    ]
  },
  "9990": {
    reg: "9990",
    bloco: "9",
    nivel: 1,
    pai: ["9001"],
    totalCampos: 2,
    campos: [
      { nome: "QTD_LIN_9", indice: 2, tipo: "quantidade", titulo: "Qtd. Linhas Bloco 9", obrigatorio: true },
    ]
  },
  "9999": {
    reg: "9999",
    bloco: "9",
    nivel: 0,
    pai: ["0000"],
    totalCampos: 2,
    campos: [
      { nome: "QTD_LIN", indice: 2, tipo: "quantidade", titulo: "Qtd. Linhas do Arquivo", obrigatorio: true },
    ]
  },
  "9900": {
    reg: "9900",
    bloco: "9",
    nivel: 2,
    pai: ["9001"],
    totalCampos: 3,
    campos: [
      { nome: "REG_BLC", indice: 2, tipo: "codigo", titulo: "Registro", obrigatorio: true },
      { nome: "QTD_REG_BLC", indice: 3, tipo: "quantidade", titulo: "Quantidade", obrigatorio: true },
    ]
  },
} as const satisfies Record<string, DefRegistro>;
