import type { NcmOficial, RegistroSped } from "@/types/sped";
import { apenasVigenciaMaisRecente } from "@/hooks/useFiltroCst";
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
}

/** Minúsculas, sem acento, sem espaços duplicados: "Classificação " → "classificacao". */
export function normalizarTexto(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Nomes que cada coluna pode ter, já normalizados. O primeiro é o oficial. */
const APELIDOS: Record<keyof MapaColunas, string[]> = {
  nome: ["nome produto", "nome do produto", "produto", "descricao do produto", "descricao"],
  classificacao: ["classificacao", "classificacao fiscal", "ncm", "codigo ncm"],
  natureza: ["natureza da receita de pis", "natureza da receita", "natureza receita pis", "nat. receita", "nat receita"],
  cstPis: ["cst pis", "cst pis/pasep", "cst do pis"],
  cstCofins: ["cst cofins", "cst da cofins"],
};

/**
 * Acha a linha de cabeçalho. Relatórios de ERP costumam trazer título, nome da
 * empresa e período nas primeiras linhas, então a busca varre as primeiras
 * `limite` linhas em vez de assumir a primeira.
 */
export function localizarCabecalho(
  linhas: unknown[][],
  limite = 40
): { indice: number; colunas: MapaColunas } | null {
  for (let i = 0; i < Math.min(linhas.length, limite); i++) {
    const celulas = (linhas[i] ?? []).map(normalizarTexto);
    const achar = (chave: keyof MapaColunas) =>
      celulas.findIndex((c) => APELIDOS[chave].includes(c));

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
      },
    };
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Normalização de códigos                                                    */
/* -------------------------------------------------------------------------- */

/**
 * "0709.60.00" → "07096000". Também recupera o zero à esquerda que o Excel
 * derruba quando a célula é numérica: 7096000 → "07096000". Devolve só os
 * dígitos; quem chama decide se o tamanho serve.
 */
export function normalizarNcm(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  const digitos = String(typeof valor === "number" ? Math.trunc(valor) : valor).replace(/\D/g, "");
  if (digitos.length === 7 || digitos.length === 6 && typeof valor === "number") {
    return digitos.padStart(8, "0");
  }
  return digitos;
}

/** CST "6" → "06"; natureza 101 → "101". Vazio continua vazio. */
export function normalizarCodigo(valor: unknown, tamanho: number): string {
  if (valor === null || valor === undefined) return "";
  const digitos = String(typeof valor === "number" ? Math.trunc(valor) : valor).replace(/\D/g, "");
  return digitos ? digitos.padStart(tamanho, "0") : "";
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

export type Situacao = "beneficio" | "tributado" | "invalido";
export type Destaque = "nenhum" | "amarelo" | "vermelho";

export interface RegraSugerida {
  tabela: string;
  rotulo: string;
  descricao: string;
  natureza: string;
  cstsAceitos: string[];
  ncmRegra: string;
  inicio?: string;
  fim?: string;
}

export interface LinhaAuditada {
  /** Número da linha na planilha original (1-based, como o Excel mostra). */
  linha: number;
  nome: string;
  classificacaoOriginal: string;
  ncm: string;
  cstPis: string;
  cstCofins: string;
  natureza: string;
  situacao: Situacao;
  /** Texto curto para o selo: "Alíquota zero", "Tributado", "NCM inválido"... */
  rotulo: string;
  regra?: RegraSugerida;
  /** Descrição oficial do NCM, quando a tabela Siscomex está disponível. */
  descricaoNcm?: string;
  /** Uma frase por problema encontrado; vazio quando a linha está coerente. */
  observacoes: string[];
  destaque: Destaque;
}

/**
 * Índice de regras de benefício por prefixo de NCM. As tabelas do SPED citam
 * posições de 4, 5, 6 ou 8 dígitos; um NCM de 8 dígitos casa com qualquer regra
 * cujo código seja prefixo dele, e a mais específica vence.
 */
export function indexarBase(base: RegistroSped[]): Map<string, RegistroSped[]> {
  const vigentes = apenasVigenciaMaisRecente(base);
  const indice = new Map<string, RegistroSped[]>();
  for (const r of vigentes) {
    if (!r.ncm || !r.tabela || !(r.tabela in BENEFICIOS)) continue;
    const lista = indice.get(r.ncm) ?? [];
    lista.push(r);
    indice.set(r.ncm, lista);
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

function melhorRegra(ncm: string, indice: Map<string, RegistroSped[]>): RegistroSped | undefined {
  // Do código completo até o capítulo (2 dígitos): "Capítulo 31" cobre 31xxxxxx.
  for (let tamanho = 8; tamanho >= 2; tamanho--) {
    const candidatos = indice.get(ncm.slice(0, tamanho));
    if (!candidatos?.length) continue;
    // Entre regras igualmente específicas, a de alíquota zero é a que a equipe
    // mais usa; depois, a de vigência mais recente.
    return [...candidatos].sort((a, b) => {
      if ((a.tabela === "4.3.13") !== (b.tabela === "4.3.13")) return a.tabela === "4.3.13" ? -1 : 1;
      return ordinalData(b.data_inicio) - ordinalData(a.data_inicio);
    })[0];
  }
  return undefined;
}

export interface LinhaPlanilha {
  linha: number;
  nome: unknown;
  classificacao: unknown;
  natureza?: unknown;
  cstPis?: unknown;
  cstCofins?: unknown;
}

/** Recorta as linhas de dados a partir do cabeçalho, ignorando vazias e totais. */
export function extrairLinhas(
  linhas: unknown[][],
  cabecalho: { indice: number; colunas: MapaColunas }
): LinhaPlanilha[] {
  const { indice, colunas } = cabecalho;
  const saida: LinhaPlanilha[] = [];
  for (let i = indice + 1; i < linhas.length; i++) {
    const l = linhas[i] ?? [];
    const classificacao = l[colunas.classificacao];
    const nome = l[colunas.nome];
    // Sem classificação, uma linha só é produto se tiver nome — e "Total" não
    // é nome de produto, é o rodapé do relatório.
    const nomeNormalizado = normalizarTexto(nome);
    if (normalizarTexto(classificacao) === "" && (nomeNormalizado === "" || /^tota(l|is)\b/.test(nomeNormalizado))) {
      continue;
    }
    saida.push({
      linha: i + 1,
      nome,
      classificacao,
      natureza: colunas.natureza !== undefined ? l[colunas.natureza] : undefined,
      cstPis: colunas.cstPis !== undefined ? l[colunas.cstPis] : undefined,
      cstCofins: colunas.cstCofins !== undefined ? l[colunas.cstCofins] : undefined,
    });
  }
  return saida;
}

export interface ContextoAuditoria {
  base: Map<string, RegistroSped[]>;
  /** null quando a tabela oficial não pôde ser carregada. */
  ncm: Map<string, NcmOficial[]> | null;
  hoje: Date;
}

/** Cruza uma linha da planilha com o SPED e a NCM oficial. */
export function auditarLinha(l: LinhaPlanilha, ctx: ContextoAuditoria): LinhaAuditada {
  const ncm = normalizarNcm(l.classificacao);
  const cstPis = normalizarCodigo(l.cstPis, 2);
  const cstCofins = normalizarCodigo(l.cstCofins, 2);
  const natureza = normalizarCodigo(l.natureza, 3);
  const observacoes: string[] = [];
  const hoje = hojeOrdinal(ctx.hoje);

  const comum = {
    linha: l.linha,
    nome: String(l.nome ?? "").trim(),
    classificacaoOriginal: String(l.classificacao ?? "").trim(),
    ncm,
    cstPis,
    cstCofins,
    natureza,
    observacoes,
  };

  // 1. O código existe?
  if (ncm.length !== 8) {
    observacoes.push(
      ncm ? `NCM com ${ncm.length} dígitos; o código precisa ter 8.` : "Classificação em branco."
    );
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
        ultima?.fim
          ? `NCM revogado em ${formatarIso(ultima.fim)}.`
          : "NCM não consta na nomenclatura vigente (Siscomex)."
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

  // 2. Tem benefício no SPED?
  const regra = melhorRegra(ncm, ctx.base);
  const beneficio = regra?.tabela ? BENEFICIOS[regra.tabela] : undefined;
  const encerrada = regra?.data_fim ? fimDeVigenciaOrdinal(regra.data_fim) < hoje : false;

  if (regra && beneficio && !encerrada) {
    const sugerida: RegraSugerida = {
      tabela: regra.tabela ?? "",
      rotulo: beneficio.rotulo,
      descricao: regra.descricao,
      natureza: regra.natureza_receita ?? "",
      cstsAceitos: beneficio.csts,
      ncmRegra: regra.ncm,
      inicio: regra.data_inicio,
      fim: regra.data_fim,
    };
    const aceitos = beneficio.csts.join(" ou ");
    if (!cstPis) observacoes.push(`CST PIS não informado; o SPED indica ${aceitos}.`);
    else if (!beneficio.csts.includes(cstPis))
      observacoes.push(`CST PIS ${cstPis} informado; o SPED indica ${aceitos}.`);
    if (!cstCofins) observacoes.push(`CST COFINS não informado; o SPED indica ${aceitos}.`);
    else if (!beneficio.csts.includes(cstCofins))
      observacoes.push(`CST COFINS ${cstCofins} informado; o SPED indica ${aceitos}.`);
    if (sugerida.natureza && natureza && natureza !== sugerida.natureza)
      observacoes.push(`Natureza da receita ${natureza} informada; o SPED indica ${sugerida.natureza}.`);
    else if (sugerida.natureza && !natureza)
      observacoes.push(`Natureza da receita não informada; o SPED indica ${sugerida.natureza}.`);
    if (regra.ncm.length === 2)
      observacoes.push(`Regra do SPED cobre todo o capítulo ${regra.ncm}; confira a descrição.`);
    else if (regra.ncm.length < 8)
      observacoes.push(`Regra do SPED cobre a posição ${regra.ncm}; confira a descrição.`);
    if (/\bexceto\b|\bexclu[ií]d/i.test(regra.descricao))
      observacoes.push("A regra tem exceções na descrição — confira se o produto não está entre elas.");

    return {
      ...comum,
      situacao: "beneficio",
      rotulo: beneficio.rotulo,
      regra: sugerida,
      descricaoNcm,
      destaque: observacoes.some((o) => /informad/.test(o)) ? "amarelo" : "nenhum",
    };
  }

  // 3. Tributado — com ou sem um benefício já encerrado.
  if (regra && beneficio && encerrada) {
    observacoes.push(
      `${beneficio.rotulo} (tabela ${regra.tabela}) encerrado em ${regra.data_fim}; hoje o NCM é tributado.`
    );
  }
  if (cstPis && CSTS_DE_BENEFICIO.has(cstPis))
    observacoes.push(`CST PIS ${cstPis} informado, mas o NCM não consta nas tabelas de benefício do SPED.`);
  if (cstCofins && CSTS_DE_BENEFICIO.has(cstCofins))
    observacoes.push(`CST COFINS ${cstCofins} informado, mas o NCM não consta nas tabelas de benefício do SPED.`);
  if (natureza)
    observacoes.push(`Natureza da receita ${natureza} informada para NCM sem benefício no SPED.`);

  return {
    ...comum,
    situacao: "tributado",
    rotulo: "Tributado",
    descricaoNcm,
    destaque: observacoes.some((o) => /informad/.test(o)) ? "amarelo" : "nenhum",
  };
}

function formatarIso(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export interface ResumoAuditoria {
  total: number;
  beneficio: number;
  tributado: number;
  invalido: number;
  divergencias: number;
}

export function resumir(linhas: LinhaAuditada[]): ResumoAuditoria {
  return {
    total: linhas.length,
    beneficio: linhas.filter((l) => l.situacao === "beneficio").length,
    tributado: linhas.filter((l) => l.situacao === "tributado").length,
    invalido: linhas.filter((l) => l.situacao === "invalido").length,
    divergencias: linhas.filter((l) => l.destaque === "amarelo").length,
  };
}
