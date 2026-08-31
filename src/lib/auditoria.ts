import type { NcmOficial, RegistroSped } from "@/types/sped";
import { ordinalData } from "@/lib/datas";

/* -------------------------------------------------------------------------- */
/* Leiaute da planilha                                                        */
/* -------------------------------------------------------------------------- */

/** Cabeçalho exato do relatório padrão de NCM do Alterdata. */
export const COLUNAS_MODELO = [
  "Nome Produto",
  "Classificação",
  "Natureza da Receita de PIS",
  "CST PIS",
  "CST COFINS",
] as const;

/** Sem estas duas a auditoria não tem o que cruzar. */
export const COLUNAS_OBRIGATORIAS = ["Nome Produto", "Classificação"] as const;

export const ERRO_LAYOUT =
  "Layout não reconhecido. Certifique-se de exportar a planilha padrão com a coluna 'Classificação' e 'Nome Produto'.";

/** Índice de cada coluna conhecida na linha de cabeçalho. */
export interface MapaColunas {
  nome: number;
  classificacao: number;
  natureza?: number;
  cstPis?: number;
  cstCofins?: number;
  cfop?: number;
}

/** Minúsculas, sem acento, sem espaços duplicados: "Classificação " → "classificacao". */
export function normalizarTexto(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/:$/, "")
    .trim();
}

/** Nomes que cada coluna pode ter, já normalizados. O primeiro é o oficial. */
const APELIDOS: Record<keyof MapaColunas, string[]> = {
  nome: ["nome produto", "nome do produto", "produto", "descricao do produto", "descricao produto", "descricao"],
  classificacao: ["classificacao", "classificacao fiscal", "ncm", "cod. ncm", "cod ncm", "codigo ncm", "ncm/sh"],
  natureza: [
    "natureza da receita de pis",
    "natureza da receita",
    "natureza receita pis",
    "natureza receita",
    "nat. receita",
    "nat receita",
  ],
  cstPis: ["cst pis", "cst pis/pasep", "cst do pis", "cst pis saida"],
  cstCofins: ["cst cofins", "cst da cofins", "cst cofins saida"],
  cfop: ["cfop"],
};

/**
 * Acha a linha de cabeçalho. Relatórios de ERP costumam trazer título, nome da
 * empresa e período nas primeiras linhas, então a busca varre a planilha
 * inteira em vez de assumir a primeira — o custo é desprezível.
 */
export function localizarCabecalho(linhas: unknown[][]): { indice: number; colunas: MapaColunas } | null {
  for (let i = 0; i < linhas.length; i++) {
    const celulas = (linhas[i] ?? []).map(normalizarTexto);
    const achar = (chave: keyof MapaColunas) => celulas.findIndex((c) => APELIDOS[chave].includes(c));

    const nome = achar("nome");
    const classificacao = achar("classificacao");
    if (nome < 0 || classificacao < 0) continue;

    const opcional = (chave: keyof MapaColunas) => {
      const idx = achar(chave);
      return idx >= 0 ? idx : undefined;
    };
    return {
      indice: i,
      colunas: {
        nome,
        classificacao,
        natureza: opcional("natureza"),
        cstPis: opcional("cstPis"),
        cstCofins: opcional("cstCofins"),
        cfop: opcional("cfop"),
      },
    };
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Normalização de códigos                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Texto que é um número com fração ou notação científica ("1006302.1",
 * "1.1E+07") — coisa que o Excel produz ao formatar células numéricas. Devolve
 * o inteiro truncado, ou null quando o texto não é isso (um NCM pontuado como
 * "0709.60.00" tem dois pontos e não entra aqui).
 */
function inteiroDeTextoNumerico(texto: string): number | null {
  const t = texto.trim();
  if (/^-?\d+[.,]\d+$/.test(t) && t.replace(/[.,]\d+$/, "").replace("-", "").length >= 5) {
    return Math.trunc(Number(t.replace(",", ".")));
  }
  if (/^-?\d+(?:[.,]\d+)?[eE][+-]?\d+$/.test(t)) {
    return Math.trunc(Number(t.replace(",", ".")));
  }
  return null;
}

function apenasDigitos(valor: unknown): string {
  if (valor === null || valor === undefined || typeof valor === "boolean") return "";
  if (typeof valor === "number") return Number.isFinite(valor) ? String(Math.abs(Math.trunc(valor))) : "";
  const texto = String(valor);
  const inteiro = inteiroDeTextoNumerico(texto);
  if (inteiro !== null) return String(Math.abs(inteiro));
  return texto.replace(/\D/g, "");
}

/**
 * "0709.60.00" → "07096000". Também recupera o zero à esquerda que o Excel
 * derruba quando a célula é numérica: 7096000 → "07096000". Devolve só os
 * dígitos; quem chama decide se o tamanho serve. Só zeros conta como vazio.
 */
export function normalizarNcm(valor: unknown): string {
  const digitos = apenasDigitos(valor);
  if (!digitos || /^0+$/.test(digitos)) return "";
  return digitos.length === 7 ? digitos.padStart(8, "0") : digitos;
}

/** CST "6" → "06"; natureza 101 → "101". Vazio ou só zeros continua vazio. */
export function normalizarCodigo(valor: unknown, tamanho: number): string {
  const digitos = apenasDigitos(valor);
  if (!digitos || /^0+$/.test(digitos)) return "";
  return digitos.padStart(tamanho, "0");
}

/* -------------------------------------------------------------------------- */
/* Cruzamento com o SPED                                                      */
/* -------------------------------------------------------------------------- */

/** Que benefício cada tabela do SPED representa e quais CSTs ela admite. */
const BENEFICIOS: Record<string, { rotulo: string; csts: string[] }> = {
  "4.3.13": { rotulo: "Alíquota zero", csts: ["06"] },
  "4.3.10": { rotulo: "Monofásico", csts: ["02", "04"] },
  "4.3.11": { rotulo: "Monofásico por unidade", csts: ["03", "04"] },
  "4.3.12": { rotulo: "Substituição tributária", csts: ["05"] },
  "4.3.14": { rotulo: "Isenção", csts: ["07"] },
  "4.3.15": { rotulo: "Sem incidência", csts: ["08"] },
  "4.3.16": { rotulo: "Suspensão", csts: ["09"] },
};

/** CSTs que só fazem sentido para NCM listado numa tabela de benefício. */
const CSTS_DE_BENEFICIO = new Set(["04", "05", "06", "07", "08", "09"]);

export type Situacao = "beneficio" | "possivel" | "tributado" | "invalido";
export type Destaque = "nenhum" | "amarelo" | "vermelho";

export interface RegraSugerida {
  tabela: string;
  rotulo: string;
  descricao: string;
  /** Todas as naturezas de receita vigentes que o SPED admite para este NCM. */
  naturezas: string[];
  cstsAceitos: string[];
  ncmRegra: string;
  inicio?: string;
  fim?: string;
}

export interface LinhaAuditada {
  /** Número da linha na planilha original (1-based, como o Excel mostra). */
  linha: number;
  /** Células originais da linha, na ordem do arquivo do cliente. */
  original: unknown[];
  nome: string;
  classificacaoOriginal: string;
  ncm: string;
  cstPis: string;
  cstCofins: string;
  natureza: string;
  cfop: string;
  situacao: Situacao;
  /** Texto curto para o selo: "Alíquota zero", "Tributado", "NCM inválido"... */
  rotulo: string;
  regra?: RegraSugerida;
  /**
   * Todos os regimes vigentes do NCM, a `regra` primeiro. É o que permite ao
   * critério de correção perguntar "existe regra de alíquota zero para este
   * NCM?" sem se prender à tabela que a auditoria escolheu exibir.
   */
  regrasAplicaveis?: RegraSugerida[];
  /** Descrição oficial do NCM, quando a tabela Siscomex está disponível. */
  descricaoNcm?: string;
  /** Uma frase por problema encontrado; vazio quando a linha está coerente. */
  observacoes: string[];
  destaque: Destaque;
  /**
   * CST sugerido pelo critério de correção escolhido pelo usuário.
   * Presente apenas quando um critério está ativo.
   * Ex: "06" para NCMs com benefício; "01" para os demais.
   */
  cstCorrigido?: string;
}

/**
 * Índice de regras de benefício por NCM. As tabelas do SPED citam posições de
 * 2 a 8 dígitos; um NCM de 8 dígitos casa com qualquer regra cujo código seja
 * prefixo dele, e a mais específica vence. Todas as versões entram — quem
 * decide o que vale hoje é a vigência, na hora do cruzamento.
 */
export function indexarBase(base: RegistroSped[]): Map<string, RegistroSped[]> {
  const indice = new Map<string, RegistroSped[]>();
  for (const r of base) {
    if (!r.ncm || !r.natureza_receita || !r.tabela || !(r.tabela in BENEFICIOS)) continue;
    const lista = indice.get(r.ncm) ?? [];
    lista.push(r);
    indice.set(r.ncm, lista);
  }
  return indice;
}

/**
 * Índice das regras que a Receita descreve só por texto, sem citar NCM
 * ("Leite fluido pasteurizado...", "Queijo do reino", "Carvão mineral
 * destinado à geração de energia elétrica"). São ~30% dos registros e nunca
 * casam pelo código; a única pista que a planilha do cliente traz é o próprio
 * código de natureza da receita. Sem isso, um leite UHT com CST 06 e natureza
 * 110 — tudo certo — seria acusado de divergência.
 */
export function indexarRegrasSemNcm(base: RegistroSped[]): Map<string, RegistroSped[]> {
  const indice = new Map<string, RegistroSped[]>();
  for (const r of base) {
    if (r.ncm || !r.natureza_receita || !r.tabela || !(r.tabela in BENEFICIOS)) continue;
    const lista = indice.get(r.natureza_receita) ?? [];
    lista.push(r);
    indice.set(r.natureza_receita, lista);
  }
  return indice;
}

/** Índice da tabela NCM oficial: um código pode ter mais de uma versão. */
export function indexarNcm(codigos: NcmOficial[]): Map<string, NcmOficial[]> {
  const indice = new Map<string, NcmOficial[]>();
  for (const c of codigos) {
    const lista = indice.get(c.ncm) ?? [];
    lista.push(c);
    indice.set(c.ncm, lista);
  }
  return indice;
}

function isoParaOrdinal(iso: string | undefined): number {
  return iso ? Number(iso.replace(/-/g, "")) : 0;
}

/** Fim de vigência "MM/AAAA" vale até o último dia do mês. */
function fimDeVigenciaOrdinal(fim: string): number {
  const ordinal = ordinalData(fim);
  return fim.length === 7 ? ordinal - 1 + 31 : ordinal;
}

function hojeOrdinal(hoje: Date): number {
  return hoje.getFullYear() * 10000 + (hoje.getMonth() + 1) * 100 + hoje.getDate();
}

const REGEX_EX_TARIFARIO = /\bEx\.?\s*\d{2}\b/i;

/**
 * Uma regra é "fraca" quando o código que a trouxe não define o produto: um
 * capítulo inteiro citado na descrição ("classificadas nos Capítulos 39, 40,
 * 63 e 94") ou uma regra restrita a um Ex tarifário. Ela sinaliza um possível
 * benefício, mas não autoriza a auditoria a cobrar CST e natureza.
 */
function regraFraca(r: RegistroSped): boolean {
  return (r.origem === "descricao" && r.ncm.length === 2) || REGEX_EX_TARIFARIO.test(r.descricao);
}

function situacaoDaRegra(r: RegistroSped, hoje: number): "vigente" | "encerrada" | "futura" {
  if (r.data_inicio && ordinalData(r.data_inicio) > hoje) return "futura";
  if (r.data_fim && fimDeVigenciaOrdinal(r.data_fim) < hoje) return "encerrada";
  return "vigente";
}

/** Regra forte antes de fraca; alíquota zero antes das demais; depois a mais recente. */
function ordenarRegras(a: RegistroSped, b: RegistroSped): number {
  const fracaA = regraFraca(a);
  const fracaB = regraFraca(b);
  if (fracaA !== fracaB) return fracaA ? 1 : -1;
  if ((a.tabela === "4.3.13") !== (b.tabela === "4.3.13")) return a.tabela === "4.3.13" ? -1 : 1;
  return ordinalData(b.data_inicio) - ordinalData(a.data_inicio);
}

interface RegrasEncontradas {
  /** Regras vigentes hoje no nível mais específico que tem alguma. */
  vigentes: RegistroSped[];
  /**
   * Regras vigentes nos níveis mais abrangentes, que o nível específico esconderia.
   * Um mesmo NCM pode estar em duas tabelas ao mesmo tempo sem contradição: cerveja
   * (2203.00.00) é monofásica por unidade para o fabricante (4.3.11) e alíquota zero
   * para o varejista de bebidas frias (4.3.13, posição 2203, natureza 918). Qual vale
   * depende do papel de quem vende — a auditoria precisa enxergar as duas.
   */
  alternativas: RegistroSped[];
  /** A regra mais específica que já valeu ou ainda vai valer, quando nenhuma vale hoje. */
  foraDeVigencia?: RegistroSped;
}

/**
 * Do código completo até o capítulo (2 dígitos). O primeiro nível com regra
 * vigente dá as `vigentes`; o que vem depois, de tabela diferente, entra como
 * alternativa. Uma regra encerrada mais específica não pode esconder uma vigente
 * mais genérica: medicamentos (3004.90.99) tiveram alíquota zero até 2020, mas a
 * regra monofásica da posição 3004 continua valendo.
 */
function encontrarRegras(ncm: string, indice: Map<string, RegistroSped[]>, hoje: number): RegrasEncontradas {
  let vigentes: RegistroSped[] = [];
  const alternativas: RegistroSped[] = [];
  const tabelasVistas = new Set<string>();
  let foraDeVigencia: RegistroSped | undefined;

  for (let tamanho = 8; tamanho >= 2; tamanho--) {
    const candidatos = indice.get(ncm.slice(0, tamanho));
    if (!candidatos?.length) continue;
    const doNivel = candidatos.filter((c) => situacaoDaRegra(c, hoje) === "vigente").sort(ordenarRegras);
    if (doNivel.length === 0) {
      if (vigentes.length === 0) foraDeVigencia ??= [...candidatos].sort(ordenarRegras)[0];
      continue;
    }
    // Só interessa o que acrescenta um regime novo; repetir a mesma tabela num
    // nível mais amplo não muda o CST admitido, só duplicaria a leitura.
    if (vigentes.length === 0) vigentes = doNivel;
    else alternativas.push(...doNivel.filter((r) => !tabelasVistas.has(r.tabela ?? "")));
    for (const r of doNivel) tabelasVistas.add(r.tabela ?? "");
  }

  return { vigentes, alternativas, foraDeVigencia };
}

export interface LinhaPlanilha {
  linha: number;
  /** A linha como veio da planilha, para o export devolver as colunas do cliente. */
  original: unknown[];
  nome: unknown;
  classificacao: unknown;
  natureza?: unknown;
  cstPis?: unknown;
  cstCofins?: unknown;
  cfop?: unknown;
}

const REGEX_RODAPE = /^(sub-?)?tota(l|is)\b|^grupo\b|^quantidade\b|^resumo\b|^qtde?\b/;

/** Recorta as linhas de dados a partir do cabeçalho, ignorando vazias e totais. */
export function extrairLinhas(
  linhas: unknown[][],
  cabecalho: { indice: number; colunas: MapaColunas }
): LinhaPlanilha[] {
  const { indice, colunas } = cabecalho;
  const saida: LinhaPlanilha[] = [];
  for (let i = indice + 1; i < linhas.length; i++) {
    const l = linhas[i] ?? [];
    const pegar = (idx: number | undefined) => (idx === undefined ? undefined : l[idx]);
    const classificacao = l[colunas.classificacao];
    const nome = l[colunas.nome];
    const natureza = pegar(colunas.natureza);
    const cstPis = pegar(colunas.cstPis);
    const cstCofins = pegar(colunas.cstCofins);
    const cfop = pegar(colunas.cfop);

    if (normalizarTexto(classificacao) === "") {
      // Sem classificação, uma linha só é produto se tiver nome e algum outro
      // dado — "Total", "Subtotal", "Grupo: Bebidas" são rodapés do relatório.
      const nomeNormalizado = normalizarTexto(nome);
      const restoVazio = [natureza, cstPis, cstCofins, cfop].every((v) => normalizarTexto(v) === "");
      if (nomeNormalizado === "" || REGEX_RODAPE.test(nomeNormalizado) || restoVazio) continue;
    }

    saida.push({ linha: i + 1, original: l, nome, classificacao, natureza, cstPis, cstCofins, cfop });
  }
  return saida;
}

export interface ContextoAuditoria {
  base: Map<string, RegistroSped[]>;
  /** Regras de benefício sem NCM, por código de natureza da receita. */
  semNcm: Map<string, RegistroSped[]>;
  /** null quando a tabela oficial não pôde ser carregada. */
  ncm: Map<string, NcmOficial[]> | null;
  hoje: Date;
}

function formatarIso(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function listar(valores: string[]): string {
  return valores.length <= 1 ? valores.join("") : `${valores.slice(0, -1).join(", ")} ou ${valores[valores.length - 1]}`;
}

/** Cruza uma linha da planilha com o SPED e a NCM oficial. */
export function auditarLinha(l: LinhaPlanilha, ctx: ContextoAuditoria): LinhaAuditada {
  const ncm = normalizarNcm(l.classificacao);
  const cstPis = normalizarCodigo(l.cstPis, 2);
  const cstCofins = normalizarCodigo(l.cstCofins, 2);
  const natureza = normalizarCodigo(l.natureza, 3);
  const cfop = normalizarCodigo(l.cfop, 4);
  const observacoes: string[] = [];
  const hoje = hojeOrdinal(ctx.hoje);

  const comum = {
    linha: l.linha,
    original: l.original,
    nome: String(l.nome ?? "").trim(),
    classificacaoOriginal: String(l.classificacao ?? "").trim(),
    ncm,
    cstPis,
    cstCofins,
    natureza,
    cfop,
    observacoes,
  };

  // 1. O código existe?
  if (ncm.length !== 8) {
    observacoes.push(ncm ? `NCM com ${ncm.length} dígitos; o código precisa ter 8.` : "Classificação em branco.");
    return { ...comum, situacao: "invalido", rotulo: "NCM inválido", destaque: "vermelho" };
  }

  let descricaoNcm: string | undefined;
  if (ctx.ncm) {
    const versoes = ctx.ncm.get(ncm) ?? [];
    const vigente = versoes.find(
      (v) => isoParaOrdinal(v.inicio) <= hoje && (!v.fim || isoParaOrdinal(v.fim) >= hoje)
    );
    if (!vigente) {
      const ultima = versoes[versoes.length - 1];
      observacoes.push(
        ultima?.fim ? `NCM revogado em ${formatarIso(ultima.fim)}.` : "NCM não consta na nomenclatura vigente (Siscomex)."
      );
      return {
        ...comum,
        situacao: "invalido",
        rotulo: "NCM inválido",
        descricaoNcm: ultima?.descricao,
        destaque: "vermelho",
      };
    }
    descricaoNcm = vigente.descricao;
  }

  // 2. Tem benefício vigente no SPED?
  const { vigentes, alternativas, foraDeVigencia } = encontrarRegras(ncm, ctx.base, hoje);
  const aplicaveis = [...vigentes, ...alternativas];

  // A regra mais específica é o palpite padrão, mas quem manda é o CST informado:
  // se ele não cabe nela e cabe em outro regime vigente do mesmo NCM, foi esse o
  // regime que o cliente aplicou — cobrar o outro seria acusar quem está certo.
  const aceitaOInformado = (r: RegistroSped) => {
    const csts = BENEFICIOS[r.tabela ?? ""]?.csts ?? [];
    return (cstPis !== "" && csts.includes(cstPis)) || (cstCofins !== "" && csts.includes(cstCofins));
  };
  const principal = (!vigentes[0] || aceitaOInformado(vigentes[0])
    ? vigentes[0]
    : aplicaveis.find(aceitaOInformado)) ?? vigentes[0];
  const beneficio = principal?.tabela ? BENEFICIOS[principal.tabela] : undefined;

  if (principal && beneficio) {
    const montar = (r: RegistroSped): RegraSugerida => {
      const irmas = aplicaveis.filter((x) => x.tabela === r.tabela && x.ncm === r.ncm);
      return {
        tabela: r.tabela ?? "",
        rotulo: BENEFICIOS[r.tabela ?? ""].rotulo,
        descricao: r.descricao,
        naturezas: Array.from(new Set(irmas.map((x) => x.natureza_receita ?? "").filter(Boolean))),
        cstsAceitos: BENEFICIOS[r.tabela ?? ""].csts,
        ncmRegra: r.ncm,
        inicio: r.data_inicio,
        fim: r.data_fim,
      };
    };
    const sugerida = montar(principal);
    const naturezas = sugerida.naturezas;
    // Um regime por tabela, a exibida na frente — é a lista que o critério consulta.
    const regrasAplicaveis = [
      sugerida,
      ...aplicaveis
        .filter((r) => r.tabela !== principal.tabela)
        .filter((r, i, todas) => todas.findIndex((x) => x.tabela === r.tabela) === i)
        .map(montar),
    ];

    if (alternativas.length > 0 || vigentes.some((r) => r.tabela !== principal.tabela)) {
      const outras = regrasAplicaveis.slice(1).map((r) => `${r.rotulo} (tabela ${r.tabela})`);
      observacoes.push(
        `Este NCM tem mais de um regime vigente no SPED — também consta como ${listar(outras)}; qual vale depende da operação.`
      );
    }

    if (principal.ncm.length === 2) {
      observacoes.push(`A regra do SPED cita o capítulo ${principal.ncm} inteiro; confira se o produto é o descrito.`);
    } else if (principal.ncm.length < 8) {
      observacoes.push(`A regra do SPED cobre a posição ${principal.ncm}; confira a descrição.`);
    }
    if (principal.origem === "descricao" && principal.ncm.length > 2) {
      observacoes.push("O NCM foi identificado pelos códigos citados no texto da regra — confira a descrição.");
    }
    if (REGEX_EX_TARIFARIO.test(principal.descricao)) {
      observacoes.push("A regra vale só para o Ex tarifário citado — confira se o produto é esse.");
    }
    if (/\bexceto\b|\bexclu[ií]d|\bexcetuad|com exce[çc][ãa]o|\bsalvo\b/i.test(principal.descricao)) {
      observacoes.push("A regra tem exceções na descrição — confira se o produto não está entre elas.");
    }

    // Regra fraca: aponta o benefício possível, mas não cobra CST nem natureza.
    if (regraFraca(principal)) {
      return {
        ...comum,
        situacao: "possivel",
        rotulo: `Possível ${beneficio.rotulo.toLowerCase()}`,
        regra: sugerida,
        regrasAplicaveis,
        descricaoNcm,
        destaque: "nenhum",
      };
    }

    const aceitos = listar(beneficio.csts);
    if (!cstPis) observacoes.push(`CST PIS não informado; o SPED indica ${aceitos}.`);
    else if (!beneficio.csts.includes(cstPis)) observacoes.push(`CST PIS ${cstPis} informado; o SPED indica ${aceitos}.`);
    if (!cstCofins) observacoes.push(`CST COFINS não informado; o SPED indica ${aceitos}.`);
    else if (!beneficio.csts.includes(cstCofins))
      observacoes.push(`CST COFINS ${cstCofins} informado; o SPED indica ${aceitos}.`);

    if (naturezas.length > 0) {
      const esperadas = listar(naturezas);
      if (!natureza) observacoes.push(`Natureza da receita não informada; o SPED indica ${esperadas}.`);
      else if (!naturezas.includes(natureza))
        observacoes.push(`Natureza da receita ${natureza} informada; o SPED indica ${esperadas}.`);
    }

    return {
      ...comum,
      situacao: "beneficio",
      rotulo: beneficio.rotulo,
      regra: sugerida,
      regrasAplicaveis,
      descricaoNcm,
      destaque: observacoes.some((o) => /informad/.test(o)) ? "amarelo" : "nenhum",
    };
  }

  // 3. Tributado — talvez com um benefício que já acabou ou ainda não começou.
  if (foraDeVigencia?.tabela && BENEFICIOS[foraDeVigencia.tabela]) {
    const rotulo = BENEFICIOS[foraDeVigencia.tabela].rotulo;
    if (situacaoDaRegra(foraDeVigencia, hoje) === "futura") {
      observacoes.push(
        `${rotulo} (tabela ${foraDeVigencia.tabela}) passa a valer em ${foraDeVigencia.data_inicio}; hoje o NCM é tributado.`
      );
    } else {
      observacoes.push(
        `${rotulo} (tabela ${foraDeVigencia.tabela}) encerrado em ${foraDeVigencia.data_fim}; hoje o NCM é tributado.`
      );
    }
  }
  // A regra pode existir sem NCM: o SPED descreve o produto por texto e a única
  // ligação possível é a natureza da receita informada pelo cliente.
  const porNatureza = natureza
    ? (ctx.semNcm.get(natureza) ?? []).filter((r) => situacaoDaRegra(r, hoje) === "vigente")
    : [];
  if (porNatureza.length > 0) {
    const regraTexto = [...porNatureza].sort((a, b) => ordinalData(b.data_inicio) - ordinalData(a.data_inicio))[0];
    const beneficioTexto = BENEFICIOS[regraTexto.tabela ?? ""];
    const regraPorTexto: RegraSugerida = {
      tabela: regraTexto.tabela ?? "",
      rotulo: beneficioTexto?.rotulo ?? "Benefício",
      descricao: regraTexto.descricao,
      naturezas: [natureza],
      cstsAceitos: beneficioTexto?.csts ?? [],
      ncmRegra: "",
      inicio: regraTexto.data_inicio,
      fim: regraTexto.data_fim,
    };
    observacoes.push(
      `A regra da natureza ${natureza} (tabela ${regraTexto.tabela}) não traz NCM na tabela do SPED — a Receita descreve o produto por texto. Confira pela descrição.`
    );
    if (cstPis && !beneficioTexto?.csts.includes(cstPis))
      observacoes.push(`CST PIS ${cstPis} informado; a regra dessa natureza admite ${listar(beneficioTexto?.csts ?? [])}.`);
    if (cstCofins && !beneficioTexto?.csts.includes(cstCofins))
      observacoes.push(`CST COFINS ${cstCofins} informado; a regra dessa natureza admite ${listar(beneficioTexto?.csts ?? [])}.`);
    return {
      ...comum,
      situacao: "possivel",
      rotulo: `Possível ${(beneficioTexto?.rotulo ?? "benefício").toLowerCase()}`,
      regra: regraPorTexto,
      regrasAplicaveis: [regraPorTexto],
      descricaoNcm,
      destaque: "nenhum",
    };
  }

  if (cstPis && CSTS_DE_BENEFICIO.has(cstPis))
    observacoes.push(`CST PIS ${cstPis} informado, mas o NCM não consta nas tabelas de benefício do SPED.`);
  if (cstCofins && CSTS_DE_BENEFICIO.has(cstCofins))
    observacoes.push(`CST COFINS ${cstCofins} informado, mas o NCM não consta nas tabelas de benefício do SPED.`);
  if (natureza) observacoes.push(`Natureza da receita ${natureza} informada para NCM sem benefício no SPED.`);

  return {
    ...comum,
    situacao: "tributado",
    rotulo: "Tributado",
    descricaoNcm,
    destaque: observacoes.some((o) => /informad/.test(o)) ? "amarelo" : "nenhum",
  };
}

export interface ResumoAuditoria {
  total: number;
  beneficio: number;
  possivel: number;
  tributado: number;
  invalido: number;
  divergencias: number;
  coerente: number;
}

export function resumir(linhas: LinhaAuditada[]): ResumoAuditoria {
  const contar = (s: Situacao) => linhas.filter((l) => l.situacao === s).length;
  return {
    total: linhas.length,
    beneficio: contar("beneficio"),
    possivel: contar("possivel"),
    tributado: contar("tributado"),
    invalido: contar("invalido"),
    divergencias: linhas.filter((l) => l.destaque === "amarelo").length,
    coerente: linhas.filter((l) => l.destaque === "nenhum" && l.situacao !== "invalido").length,
  };
}

export function valorColuna(l: LinhaAuditada, coluna: string): string {
  switch (coluna) {
    case "Linha": return l.linha.toString();
    case "Produto": return (l.nome || "—").trim();
    case "Classificação": return (l.ncm || l.classificacaoOriginal || "—").trim();
    case "Informado": return `CST ${l.cstPis || "—"}/${l.cstCofins || "—"} nat. ${l.natureza || "—"}${l.cfop ? ` CFOP ${l.cfop}` : ""}`;
    case "Situação": return (l.rotulo || "—").trim();
    case "Sugestão do SPED": return (l.regra ? l.regra.rotulo : "—").trim();
    case "Observações": return l.observacoes.length > 0 ? l.observacoes.join(" ") : "Coerente com o SPED";
    default: return "";
  }
}

/* -------------------------------------------------------------------------- */
/* Critério de correção                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Aplica o critério de correção estilo Alterdata e sincroniza a exibição.
 *
 * O critério funciona como chave geral: enquanto está ligado, a auditoria só
 * enxerga a tabela do benefício escolhido. Cerveja é monofásica (4.3.11, CST 03)
 * e alíquota zero para o varejista (4.3.13, CST 06) ao mesmo tempo; com o
 * critério de CST 06 ligado, mostrar "o SPED indica 03 ou 04" ao lado de uma
 * linha corrigida para 06 só confunde. Por isso a regra exibida passa a ser a do
 * critério, e as das outras tabelas somem da linha.
 *
 * Lógica do cstCorrigido:
 * - NCM inválido                                            → vazio (inaplicável)
 * - Algum regime vigente do NCM aceita `cstBeneficio`       → `cstBeneficio`
 * - Nenhum regime vigente aceita                            → `cstTributado` ("01")
 *
 * Efeitos na UI (sincroniza com o critério ativo):
 * - `destaque` → "nenhum" em toda linha corrigida: remove o realce amarelo e
 *   retira a linha dos contadores de "Divergências" nos cards de resumo.
 * - `observacoes` → esvaziadas (benefício correto) ou substituídas por uma
 *   nota informativa (requalificado para tributado), nunca mais um alerta de
 *   divergência — a decisão já foi tomada pelo critério escolhido.
 */
export function corrigirLinhas(
  linhas: LinhaAuditada[],
  cstBeneficio: string,
  cstTributado = "01"
): LinhaAuditada[] {
  return linhas.map((l) => {
    // NCM inválido → não há o que corrigir; mantém tudo como está
    if (l.situacao === "invalido") {
      return { ...l, cstCorrigido: "" };
    }

    // Basta um regime vigente do NCM aceitar o CST do critério. A tabela que a
    // auditoria escolheu exibir não decide: o NCM 22030000 casa com a posição
    // 2203 da tabela 4.3.13 (alíquota zero, natureza 918) mesmo tendo regra
    // própria de 8 dígitos na 4.3.11.
    const regraDoCriterio = (l.regrasAplicaveis ?? [l.regra])
      .filter((r): r is RegraSugerida => Boolean(r))
      .find((r) => r.cstsAceitos.includes(cstBeneficio));

    if (regraDoCriterio) {
      // Enquadrado no critério: o CST informado fica, e a linha passa a falar só
      // da regra que o sustenta.
      return {
        ...l,
        cstCorrigido: cstBeneficio,
        situacao: "beneficio",
        rotulo: regraDoCriterio.rotulo,
        regra: regraDoCriterio,
        destaque: "nenhum",
        observacoes: [],
      };
    }

    // Nenhum regime vigente aceita o CST do critério → requalificado
    // intencionalmente como tributado. Como a decisão é explícita do usuário,
    // não é divergência: sai o realce amarelo, saem os alertas e sai também a
    // sugestão das outras tabelas, que o critério mandou ignorar.
    return {
      ...l,
      cstCorrigido: cstTributado,
      situacao: "tributado",
      rotulo: "Tributado",
      regra: undefined,
      destaque: "nenhum",
      observacoes: [
        `Tratado como ${cstTributado === "01" ? "tributado (CST 01)" : `CST ${cstTributado}`} conforme o critério de correção.`,
      ],
    };
  });
}

