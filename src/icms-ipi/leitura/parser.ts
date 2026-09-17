import { ehFilhoDeC100 } from "../leiaute/hierarquia";
import { definicaoDoRegistro } from "../leiaute/acesso";
import { LIMITES } from "../limites";
import type { Achado, Severidade } from "@/regras/nucleo/contrato";

export interface LinhaSped {
  reg: string;
  /** Nº da linha no arquivo original, base 1. */
  nl: number;
  /** Índice 0 = "" (antes do primeiro pipe), índice 1 = REG, último = "" (depois do último pipe). */
  campos: string[];
}

export interface NotaC100 {
  nl: number;
  campos: string[];
  itens: LinhaSped[];
  analiticos: LinhaSped[];
  /** C101, C110, C140, C176, C197… na ordem em que apareceram. */
  filhos: LinhaSped[];
}

/**
 * Estado do parse de UM arquivo.
 *
 * A nota em aberto e o pool de interning moram aqui, e não em variáveis de
 * módulo, porque `processarLinha` recebe a estrutura como parâmetro e portanto
 * promete ser reentrante. Enquanto o contexto era global, dois parses na mesma
 * sessão — cancelar e recarregar é suficiente — misturavam os itens de uma nota
 * do primeiro arquivo dentro do segundo, silenciosamente.
 */
export interface EstruturaSped {
  cabecalho: LinhaSped | null;
  participantes: Map<string, LinhaSped>;
  produtos: Map<string, LinhaSped>;
  unidades: Map<string, LinhaSped>;
  naturezas: Map<string, LinhaSped>;

  notas: NotaC100[];
  apuracao: LinhaSped[];

  /** Todas as linhas, na ordem original — é o que sustenta a regravação fiel. */
  linhas: LinhaSped[];
  encoding: "windows-1252" | "utf-8";
  fimDeLinha: "\r\n" | "\n";
  /** O arquivo começava com marca de ordem de bytes (BOM UTF-8). */
  temBom: boolean;
  /** O arquivo terminava com quebra de linha. Nem todo gerador a coloca. */
  terminaComQuebra: boolean;
  /** SHA-256 dos bytes do arquivo como ele veio do disco. */
  hashOriginal: string;

  achados: Achado[];
  contagemPorRegistro: Map<string, number>;

  /** Estado interno do parse; ninguém fora daqui deveria mexer. */
  contexto: {
    notaAtual: NotaC100 | null;
    pool: Map<string, string>;
    /** Quantos achados já foram emitidos por código, para respeitar o teto. */
    porCodigo: Map<string, number>;
    /** Registros fora do dicionário, agregados: código → quantidade de linhas. */
    desconhecidos: Map<string, number>;
    omitidos: number;
  };
}

export function novaEstrutura(): EstruturaSped {
  return {
    cabecalho: null,
    participantes: new Map(),
    produtos: new Map(),
    unidades: new Map(),
    naturezas: new Map(),
    notas: [],
    apuracao: [],
    linhas: [],
    encoding: "windows-1252",
    fimDeLinha: "\r\n",
    temBom: false,
    terminaComQuebra: true,
    hashOriginal: "",
    achados: [],
    contagemPorRegistro: new Map(),
    contexto: {
      notaAtual: null,
      pool: new Map(),
      porCodigo: new Map(),
      desconhecidos: new Map(),
      omitidos: 0,
    },
  };
}

/**
 * Registra um achado respeitando o teto por código.
 *
 * Um arquivo com um bloco inteiro fora do dicionário produzia um objeto por
 * linha: centenas de milhares de achados clonados para a main thread e
 * transformados em nós de DOM. Passado o teto, só o contador sobrevive — o
 * usuário vê "e mais N ocorrências" em vez de perder a análise inteira.
 */
export function registrarAchado(estrutura: EstruturaSped, achado: Achado): void {
  const jaEmitidos = estrutura.contexto.porCodigo.get(achado.codigo) ?? 0;
  if (jaEmitidos >= LIMITES.ACHADOS_POR_CODIGO) {
    estrutura.contexto.omitidos++;
    return;
  }
  estrutura.contexto.porCodigo.set(achado.codigo, jaEmitidos + 1);
  estrutura.achados.push(achado);
}

interface DadosDoAchado {
  codigo: string;
  severidade: Severidade;
  nl: number;
  reg: string;
  mensagem: string;
  regra: string;
  campo?: string;
}

function achadoEstrutural(estrutura: EstruturaSped, dados: DadosDoAchado): void {
  registrarAchado(estrutura, {
    // O registro entra na identidade porque os achados agregados no fim do
    // parse não têm linha (nl = 0): sem ele, todos os EST-022 do arquivo
    // colidiriam numa única chave e a lista renderizaria um só.
    id: `${dados.codigo}:${dados.nl}:${dados.campo ?? dados.reg}`,
    corrigivel: false,
    ...dados,
  });
}

/**
 * Interning das strings repetidas.
 *
 * Só vale para campos de código e alíquota: são poucos valores distintos
 * repetidos milhões de vezes (CFOP, CST, UNID). Aplicar em campo livre —
 * descrição de produto, nome de participante — faria o pool virar uma segunda
 * cópia do arquivo, que é exatamente o custo que ele deveria evitar.
 */
const indicesInternaveis = new Map<string, readonly number[]>();

function indicesDeCodigo(reg: string): readonly number[] {
  const memorizado = indicesInternaveis.get(reg);
  if (memorizado) return memorizado;

  const def = definicaoDoRegistro(reg);
  const indices = def
    ? def.campos.filter((c) => c.tipo === "codigo" || c.tipo === "aliquota").map((c) => c.indice)
    : [];
  indicesInternaveis.set(reg, indices);
  return indices;
}

function internarCampos(estrutura: EstruturaSped, reg: string, campos: string[]): string[] {
  const { pool } = estrutura.contexto;
  for (const i of indicesDeCodigo(reg)) {
    const valor = campos[i];
    if (!valor) continue;
    const existente = pool.get(valor);
    if (existente === undefined) pool.set(valor, valor);
    else campos[i] = existente;
  }
  return campos;
}

export function processarLinha(linhaBruta: string, nl: number, estrutura: EstruturaSped): void {
  if (!linhaBruta || linhaBruta === "|") return;

  const campos = linhaBruta.split("|");
  const reg = campos[1] ?? "";

  if (!reg) {
    achadoEstrutural(estrutura, {
      codigo: "EST-001",
      severidade: "erro",
      nl,
      reg: "",
      mensagem: "Linha sem código de registro.",
      regra: "Guia Prático EFD ICMS/IPI",
    });
    return;
  }

  const item: LinhaSped = { reg, nl, campos: internarCampos(estrutura, reg, campos) };
  estrutura.linhas.push(item);
  estrutura.contagemPorRegistro.set(reg, (estrutura.contagemPorRegistro.get(reg) ?? 0) + 1);

  rotear(item, estrutura);
  conferirQuantidadeDeCampos(item, estrutura);
}

/** Registros que fecham o bloco ou abrem outro, encerrando a nota em aberto. */
const QUEBRAM_CONTEXTO_DA_NOTA = new Set([
  "C990", "C001", "D001", "E001", "G001", "H001", "K001", "1001", "9001",
]);

function rotear(item: LinhaSped, estrutura: EstruturaSped): void {
  const ctx = estrutura.contexto;

  switch (item.reg) {
    case "0000":
      estrutura.cabecalho = item;
      return;
    case "0150":
      estrutura.participantes.set(item.campos[2] ?? "", item);
      return;
    case "0190":
      estrutura.unidades.set(item.campos[2] ?? "", item);
      return;
    case "0200":
      estrutura.produtos.set(item.campos[2] ?? "", item);
      return;
    case "0400":
      estrutura.naturezas.set(item.campos[2] ?? "", item);
      return;

    case "C100":
      ctx.notaAtual = { nl: item.nl, campos: item.campos, itens: [], analiticos: [], filhos: [] };
      estrutura.notas.push(ctx.notaAtual);
      return;

    case "C170":
    case "C190": {
      if (!ctx.notaAtual) {
        achadoEstrutural(estrutura, {
          codigo: "EST-010",
          severidade: "critico",
          nl: item.nl,
          reg: item.reg,
          mensagem: `Registro filho ${item.reg} órfão (sem C100 pai).`,
          regra: "Hierarquia do Bloco C",
        });
        return;
      }
      if (item.reg === "C170") ctx.notaAtual.itens.push(item);
      else ctx.notaAtual.analiticos.push(item);
      return;
    }
  }

  if (QUEBRAM_CONTEXTO_DA_NOTA.has(item.reg)) {
    ctx.notaAtual = null;
    return;
  }

  /*
   * Apuração — bloco E inteiro, não só o E1.
   *
   * A condição era `startsWith("E1")`, e com ela o E200/E210/E220 (apuração do
   * ICMS-ST), o E300 (FCP) e o E500 (apuração do IPI) caíam em lugar nenhum.
   *
   * RESSALVA HONESTA: hoje isto NÃO corrige nenhum achado, porque `apuracao`
   * ainda não é lido por regra nenhuma — só é escrito aqui. O roteamento
   * prepara o terreno para a primeira regra de apuração (fechar o E110 contra
   * os débitos e créditos dos filhos é o caso óbvio, e o E110 já está no
   * leiaute); enquanto ela não existir, o ganho é potencial, não real.
   *
   * Abertura e fechamento ficam de fora: são estrutura do bloco, não apuração.
   */
  if (item.reg.startsWith("E") && item.reg !== "E001" && item.reg !== "E990") {
    estrutura.apuracao.push(item);
  }
  if (ctx.notaAtual && ehFilhoDeC100(item.reg)) ctx.notaAtual.filhos.push(item);
}

/**
 * Registros dispensados da conferência de layout.
 *
 * Vazio desde que os abridores e fechadores de bloco entraram no dicionário:
 * o 9999 e o 0990 estavam aqui porque não tinham definição, não porque não
 * devessem ser conferidos. Agora têm — e são justamente os registros em que um
 * campo errado faz o PVA recusar o arquivo inteiro.
 */
const SEM_CONFERENCIA_DE_LAYOUT = new Set<string>([]);

function conferirQuantidadeDeCampos(item: LinhaSped, estrutura: EstruturaSped): void {
  const def = definicaoDoRegistro(item.reg);

  /*
   * O delimitador final é conferido ANTES de olhar o dicionário.
   *
   * Uma linha bem formada termina em "|", então `split` deixa um "" no fim.
   * Quando o gerador esquece o delimitador, esse sentinela não existe — e o
   * PVA recusa o arquivo, seja qual for o registro.
   *
   * Esta checagem não depende do dicionário: depende só da FORMA da linha. Ela
   * ficava depois do `if (!def)` e por isso valia apenas para os registros
   * conhecidos — num arquivo de indústria, onde a maioria dos registros está
   * fora do dicionário, o aviso mais barato e mais objetivo da aba
   * simplesmente não acontecia. O arquivo era aprovado na tela e reprovado no
   * PVA, que é o pior resultado possível para uma conferência prévia.
   *
   * A linha NÃO é corrigida aqui: o campo continua no índice em que veio, e a
   * regravação devolve a linha exatamente como ela entrou.
   */
  if (item.campos[item.campos.length - 1] !== "") {
    achadoEstrutural(estrutura, {
      codigo: "EST-023",
      severidade: "alerta",
      nl: item.nl,
      reg: item.reg,
      mensagem: "Linha sem o delimitador final '|'. O PVA pode recusar o arquivo; corrija na origem.",
      regra: "Estrutura do registro",
    });
  }

  if (!def) {
    if (SEM_CONFERENCIA_DE_LAYOUT.has(item.reg)) return;
    // Agregado por registro no fim do parse: um achado por CÓDIGO, não por linha.
    const ctx = estrutura.contexto;
    ctx.desconhecidos.set(item.reg, (ctx.desconhecidos.get(item.reg) ?? 0) + 1);
    return;
  }

  const quantidadeNoArquivo = item.campos.length - 2;

  /*
   * A divergência é APONTADA, nunca corrigida.
   *
   * A versão anterior completava os campos que faltavam com vazios, direto no
   * array da linha. Parecia prestativo e era o maior risco do módulo: o
   * dicionário aqui é de UMA versão de leiaute, e o Ato COTEPE publica versão
   * nova quase todo ano. Diante de um arquivo de uma versão que acrescentou
   * campos, aquele preenchimento reescrevia todas as linhas de um registro
   * perfeitamente válido — e o arquivo "corrigido" saía adulterado para a
   * Receita. Sem tocar na linha, um dicionário defasado no máximo aponta demais;
   * nunca estraga.
   */
  if (quantidadeNoArquivo < def.totalCampos) {
    achadoEstrutural(estrutura, {
      codigo: "EST-020",
      severidade: "erro",
      nl: item.nl,
      reg: item.reg,
      mensagem: `Quantidade de campos menor que o layout (encontrado: ${quantidadeNoArquivo}, esperado: ${def.totalCampos}). A linha foi preservada como veio.`,
      regra: "Estrutura do registro",
    });
    return;
  }

  if (quantidadeNoArquivo > def.totalCampos) {
    achadoEstrutural(estrutura, {
      codigo: "EST-021",
      severidade: "alerta",
      nl: item.nl,
      reg: item.reg,
      mensagem: `Quantidade de campos maior que o layout (encontrado: ${quantidadeNoArquivo}, esperado: ${def.totalCampos}).`,
      regra: "Estrutura do registro",
    });
  }
}

/**
 * Fecha o parse: emite o que só se sabe depois de ler o arquivo inteiro.
 *
 * Os registros fora do dicionário viram UM achado por código, com a contagem —
 * e não um por linha. Num arquivo de indústria com os blocos D, H e K, a versão
 * por linha gerava centenas de milhares de avisos idênticos que enterravam os
 * poucos erros que o contador precisava ver.
 */
export function finalizarParse(estrutura: EstruturaSped): void {
  const desconhecidos = estrutura.contexto.desconhecidos;
  if (desconhecidos.size === 0) return;

  /*
   * UM achado para todo o escopo não coberto, e não um por código de registro.
   *
   * A versão anterior emitia um EST-022 por registro fora do dicionário. Numa
   * escrituração de indústria — blocos D, G, H, K e 1 — isso são mais de cento
   * e quarenta apontamentos, todos dizendo a mesma coisa: "não auditamos este
   * registro". O contador abria a aba, lia "148 apontamentos" e percorria uma
   * lista em que 144 não eram problema nenhum do arquivo dele; os poucos
   * achados fiscais de verdade ficavam enterrados no meio.
   *
   * A informação é útil e continua aqui — é escopo da ferramenta, não defeito
   * da escrituração. O que muda é que ela ocupa uma linha, com a lista dos
   * registros e o total, em vez de tomar a lista inteira.
   */
  let linhas = 0;
  for (const quantidade of desconhecidos.values()) linhas += quantidade;

  const codigos = [...desconhecidos.keys()].sort();
  const amostra = codigos.slice(0, 12).join(", ");
  const resto = codigos.length > 12 ? ` e mais ${codigos.length - 12}` : "";

  achadoEstrutural(estrutura, {
    codigo: "EST-022",
    severidade: "info",
    nl: 0,
    reg: "",
    mensagem: `${codigos.length} ${codigos.length === 1 ? "registro está" : "registros estão"} fora do escopo de auditoria (${linhas.toLocaleString("pt-BR")} ${linhas === 1 ? "linha lida e preservada" : "linhas lidas e preservadas"} na regravação, sem conferência de layout): ${amostra}${resto}.`,
    regra: "Escopo",
  });
}

/** Achados que o teto por código descartou. */
/**
 * Contabiliza achados descartados por um teto aplicado FORA daqui.
 *
 * O motor de `src/regras/` tem tetos próprios — inclusive um teto global, que
 * `registrarAchado` não conhece — e descarta antes de a estrutura ver o achado.
 * Sem este canal, a conta de "e mais N ocorrências" da tela ficaria menor do
 * que o que realmente foi omitido, que é a única informação que impede o
 * contador de ler a lista como se fosse completa.
 */
export function registrarOmitidos(estrutura: EstruturaSped, quantidade: number): void {
  if (quantidade > 0) estrutura.contexto.omitidos += quantidade;
}

export function achadosOmitidos(estrutura: EstruturaSped): number {
  return estrutura.contexto.omitidos;
}
