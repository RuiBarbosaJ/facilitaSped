/// <reference lib="webworker" />
import { createSHA256 } from "hash-wasm";

import { compararValores } from "@/comum/filtrosColuna";
import { COLUNA_REGISTRO, definicaoDoRegistro } from "../leiaute/acesso";
import { LEIAUTE_CONFERIDO } from "../leiaute/versao";
import { LIMITES } from "../limites";
import { rodarMotor, rodarValidacoes } from "../auditoria/motor";
import { identificarDocumentos } from "../auditoria/documentos";
import { aplicarCorrecoes } from "../regravacao/correcoes";
import { marcarConsertos, proporCorrecoes } from "../regravacao/propostas";
import { recalcularTotalizadores } from "../regravacao/totalizadores";
import { serializar } from "../regravacao/serializador";
import { encodeCP1252 } from "./encoder";
import { detectarEncoding, detectarFimDeLinha, lerLinhas } from "./leitor";
import { colunasReprovadas } from "./filtros";
import {
  ErroSped,
  type CodigoErro,
  type DoWorker,
  type FiltrosGrade,
  type LinhaJanela,
  type ParaWorker,
} from "./protocolo";
import {
  achadosOmitidos,
  finalizarParse,
  novaEstrutura,
  processarLinha,
  registrarAchado,
  type EstruturaSped,
} from "./parser";

declare const self: DedicatedWorkerGlobalScope;

/** Índices do registro 0000 usados no resumo (ver layout/registros.ts). */
const CAMPO_0000 = {
  COD_VER: 2,
  COD_FIN: 3,
  DT_INI: 4,
  DT_FIN: 5,
  NOME: 6,
  CNPJ: 7,
  UF: 9,
  IND_PERFIL: 14,
} as const;

const BOM = "﻿";

let estruturaAtiva: EstruturaSped | null = null;

/**
 * Identidade da execução em curso.
 *
 * Cada INICIAR e cada CANCELAR incrementa o contador; o laço de leitura guarda
 * o número com que começou e para assim que ele muda. Antes havia só um
 * booleano `cancelado`, e um INICIAR o punha de volta em `false` — o que
 * *ressuscitava* o laço anterior, ainda vivo, e fazia os dois escreverem na
 * mesma estrutura: linhas de um arquivo apareciam dentro do outro.
 */
let execucaoAtual = 0;

function responder(mensagem: DoWorker): void {
  self.postMessage(mensagem);
}

function limparTudo(): void {
  estruturaAtiva = null;
  indiceFiltrado = null;
  chaveDoIndice = null;
}

/**
 * Traduz a exceção em código + mensagem.
 *
 * Nunca repassa a mensagem de um erro desconhecido: ela pode carregar conteúdo
 * do arquivo para a tela e para qualquer log (seção 13.2 do plano). E uma falha
 * de programação deixa de se disfarçar de "arquivo grande demais", que mandava
 * o contador encolher um arquivo que nunca foi o problema.
 */
function descrever(erro: unknown): { codigo: CodigoErro; mensagem: string; linha?: number } {
  if (erro instanceof ErroSped) {
    return { codigo: erro.codigo, mensagem: erro.message, linha: erro.linha };
  }
  return {
    codigo: "INTERNO",
    mensagem: "Falha interna ao processar o arquivo. Nenhum dado saiu do seu navegador.",
  };
}

/** Reconhece o arquivo pelos primeiros bytes, antes de abrir a stream. */
async function reconhecerArquivo(arquivo: File) {
  if (arquivo.size === 0) {
    throw new ErroSped("FORMATO", "O arquivo está vazio (0 bytes).");
  }
  if (arquivo.size > LIMITES.TAMANHO_MAXIMO_BYTES) {
    const limite = LIMITES.TAMANHO_MAXIMO_BYTES / 1024 / 1024;
    throw new ErroSped(
      "LIMITE",
      `O arquivo tem ${(arquivo.size / 1024 / 1024).toFixed(1)} MB; o limite é ${limite} MB.`
    );
  }

  const amostra = new Uint8Array(await arquivo.slice(0, LIMITES.BYTES_DE_ASSINATURA).arrayBuffer());

  // Byte nulo é a assinatura de um binário renomeado (zip, PDF, xlsx).
  if (amostra.includes(0x00)) {
    throw new ErroSped("FORMATO", "O arquivo é binário, não um texto de escrituração EFD.");
  }

  const encoding = await detectarEncoding(amostra);
  const fimDeLinha = detectarFimDeLinha(amostra);
  const temBom = amostra[0] === 0xef && amostra[1] === 0xbb && amostra[2] === 0xbf;

  const inicio = new TextDecoder(encoding).decode(amostra.slice(0, 64));
  if (!inicio.replace(BOM, "").startsWith("|0000|")) {
    throw new ErroSped(
      "FORMATO",
      "O arquivo não começa com o registro 0000 de um SPED EFD ICMS/IPI."
    );
  }

  return { encoding, fimDeLinha, temBom };
}

async function iniciar(arquivo: File): Promise<void> {
  const minhaExecucao = ++execucaoAtual;
  limparTudo();

  const estrutura = novaEstrutura();
  const cancelada = () => execucaoAtual !== minhaExecucao;

  try {
    const { encoding, fimDeLinha, temBom } = await reconhecerArquivo(arquivo);
    if (cancelada()) return;

    estrutura.encoding = encoding;
    estrutura.fimDeLinha = fimDeLinha;
    estrutura.temBom = temBom;

    const hasher = await createSHA256();
    hasher.init();

    let bytesLidos = 0;
    let ultimoByte = 0;
    let linhasLidas = 0;
    let ultimoReporte = 0;
    const comecouEm = Date.now();

    // Hasheia os BYTES do arquivo, não o texto decodificado: é o único jeito de
    // o SHA-256 exibido bater com o `sha256sum` do arquivo entregue ao fisco.
    const iterador = lerLinhas(arquivo, encoding, {
      aoLerBytes: (bloco) => {
        hasher.update(bloco);
        bytesLidos += bloco.byteLength;
        // Nem todo gerador fecha o arquivo com quebra de linha; a regravação
        // precisa devolver o arquivo com a mesma forma com que ele chegou.
        if (bloco.byteLength > 0) ultimoByte = bloco[bloco.byteLength - 1];
      },
    });

    for await (const linha of iterador) {
      if (cancelada()) return;

      linhasLidas++;
      if (linhasLidas > LIMITES.LINHAS_MAXIMAS) {
        throw new ErroSped(
          "LIMITE",
          `O arquivo passa de ${LIMITES.LINHAS_MAXIMAS.toLocaleString("pt-BR")} linhas.`
        );
      }
      if (Date.now() - comecouEm > LIMITES.TEMPO_MAXIMO_MS) {
        throw new ErroSped(
          "LIMITE",
          "A leitura passou do tempo máximo e foi interrompida.",
          linhasLidas
        );
      }

      processarLinha(linha, linhasLidas, estrutura);

      if (linhasLidas - ultimoReporte >= LIMITES.INTERVALO_DE_PROGRESSO) {
        ultimoReporte = linhasLidas;
        responder({
          tipo: "PROGRESSO",
          execucao: minhaExecucao,
          bytesLidos,
          bytesTotal: arquivo.size,
          linhas: linhasLidas,
        });
      }
    }

    if (cancelada()) return;

    if (linhasLidas === 0 || !estrutura.cabecalho) {
      throw new ErroSped("FORMATO", "O arquivo não tem nenhum registro 0000 legível.");
    }

    estrutura.hashOriginal = hasher.digest("hex");
    estrutura.terminaComQuebra = ultimoByte === 0x0a;
    finalizarParse(estrutura);
    conferirVersaoDoLeiaute(estrutura);
    rodarMotor(estrutura);
    /*
     * As regras declaradas em `src/regras/` rodam com o cancelamento em mãos.
     * É a fase mais longa num arquivo grande — meio milhão de itens conferidos
     * contra a matriz do CST e contra o analítico —, e sem este canal o botão
     * Cancelar ficaria inerte exatamente enquanto ela corre.
     */
    rodarValidacoes(estrutura, cancelada);
    if (cancelada()) return;

    // O número da nota entra DEPOIS de todas as regras: a lista já está
    // limitada pelos tetos, e nenhuma regra precisa conhecer o índice.
    identificarDocumentos(estrutura);

    // As propostas nascem dos achados: depois do motor, nunca antes.
    const correcoes = proporCorrecoes(estrutura);
    // E o achado só sabe que tem conserto depois de a proposta existir.
    marcarConsertos(estrutura, correcoes);

    if (cancelada()) return;

    estruturaAtiva = estrutura;

    const cabecalho = estrutura.cabecalho;
    const campo = (indice: number) => cabecalho.campos[indice] || "";

    responder({
      tipo: "PRONTO",
      execucao: minhaExecucao,
      resumo: {
        empresa: campo(CAMPO_0000.NOME) || "Não informado",
        cnpj: campo(CAMPO_0000.CNPJ) || "Não informado",
        periodo: `${campo(CAMPO_0000.DT_INI)} a ${campo(CAMPO_0000.DT_FIN)}`,
        perfil: campo(CAMPO_0000.IND_PERFIL) || "Não informado",
        uf: campo(CAMPO_0000.UF) || "Não informada",
        versaoLeiaute: campo(CAMPO_0000.COD_VER) || "Não informada",
        hash: estrutura.hashOriginal,
        totalLinhas: linhasLidas,
        contagemPorRegistro: Object.fromEntries(estrutura.contagemPorRegistro),
        codFinOriginal: campo(CAMPO_0000.COD_FIN),
        achadosOmitidos: achadosOmitidos(estrutura),
      },
      achados: estrutura.achados,
      correcoes,
    });
  } catch (erro) {
    if (cancelada()) return;
    limparTudo();
    responder({ tipo: "ERRO", execucao: minhaExecucao, ...descrever(erro) });
  }
}

/**
 * Avisa quando o arquivo declara um leiaute diferente daquele contra o qual o
 * dicionário foi conferido.
 *
 * Não é motivo para recusar o arquivo: a leitura e a regravação não dependem do
 * dicionário, e por isso continuam fiéis. O que pode ficar impreciso são as
 * conferências de quantidade de campos — e é exatamente isso que o aviso diz.
 */
function conferirVersaoDoLeiaute(estrutura: EstruturaSped): void {
  const declarada = estrutura.cabecalho?.campos[CAMPO_0000.COD_VER] ?? "";
  if (!declarada || declarada === LEIAUTE_CONFERIDO) return;

  registrarAchado(estrutura, {
    id: `EST-002:0:${declarada}`,
    codigo: "EST-002",
    severidade: "alerta",
    nl: estrutura.cabecalho?.nl ?? 0,
    reg: "0000",
    campo: "COD_VER",
    mensagem: `O arquivo declara a versão de leiaute ${declarada} e o dicionário desta ferramenta foi conferido para a versão ${LEIAUTE_CONFERIDO}. As conferências de quantidade de campos podem apontar divergências que não existem; a leitura e a regravação do arquivo não são afetadas.`,
    corrigivel: false,
    regra: "Ato COTEPE/ICMS — tabela de versões do leiaute",
  });
}

/*
 * Índice das linhas que passam pelo filtro atual.
 *
 * A grade pede uma janela nova a cada rolagem. Recalcular o filtro inteiro a
 * cada pedido custava de 100 ms (1 milhão de linhas) a quase 1 s (5 milhões) e
 * alocava um array do tamanho do arquivo por evento de rolagem — o worker ficava
 * permanentemente atrás do usuário. O índice é montado uma vez por combinação
 * de filtros e reaproveitado por todas as janelas seguintes.
 */
let indiceFiltrado: number[] | null = null;
let chaveDoIndice: string | null = null;

/**
 * Identidade do recorte atual: filtros de coluna mais recorte por linha.
 *
 * O recorte por linha entra na chave POR INTEIRO, e não por um resumo (tamanho,
 * primeiro, último). Um resumo é barato e erra: duas listas diferentes de mesmo
 * tamanho e mesmas pontas reaproveitariam o índice uma da outra, e a grade
 * mostraria o recorte anterior sem nada indicar. O custo real é montar uma
 * string de alguns KB por rolagem — microssegundos —, e o que ela evita é a
 * grade mentir sobre qual recorte está na tela.
 */
function chaveDe(filtros: FiltrosGrade | undefined, linhas: number[] | undefined): string {
  const porColuna = filtros
    ? Object.entries(filtros)
        .filter(([, valores]) => valores && valores.length > 0)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([coluna, valores]) => `${coluna}=${[...valores].sort().join("")}`)
        .join("")
    : "";

  // `undefined` (sem recorte) e `[]` (recorte vazio) PRECISAM ter chaves
  // distintas: o segundo é um recorte legítimo, que zera a grade.
  const porLinha = linhas === undefined ? "" : `#nl:${linhas.join(",")}`;
  return porColuna + porLinha;
}

function obterIndice(
  estrutura: EstruturaSped,
  filtros: FiltrosGrade | undefined,
  recorte: number[] | undefined
): number[] {
  const chave = chaveDe(filtros, recorte);
  if (indiceFiltrado && chaveDoIndice === chave) return indiceFiltrado;

  // Um Set por recorte, e não `includes` por linha: o recorte pode ter
  // centenas de números e o arquivo, centenas de milhares de linhas.
  const permitidas = recorte === undefined ? null : new Set(recorte);

  const indice: number[] = [];
  for (let i = 0; i < estrutura.linhas.length; i++) {
    const linha = estrutura.linhas[i];
    if (permitidas && !permitidas.has(linha.nl)) continue;
    if (colunasReprovadas(linha, filtros).length > 0) continue;
    indice.push(i);
  }

  indiceFiltrado = indice;
  chaveDoIndice = chave;
  return indice;
}

function responderJanela(
  estrutura: EstruturaSped,
  msg: Extract<ParaWorker, { tipo: "JANELA" }>
): void {
  const indice = obterIndice(estrutura, msg.filtros, msg.linhas);
  const limite = Math.min(msg.limite, LIMITES.LINHAS_POR_JANELA);
  const offset = Math.max(0, msg.offset);

  const linhas: LinhaJanela[] = [];
  for (const posicao of indice.slice(offset, offset + limite)) {
    const linha = estrutura.linhas[posicao];
    linhas.push({ nl: linha.nl, campos: linha.campos });
  }

  responder({ tipo: "JANELA_OK", requisicao: msg.requisicao, offset, linhas, total: indice.length });
}

/**
 * Opções do menu de filtro de cada coluna.
 *
 * Cada coluna para no teto de opções: sem isso, COD_ITEM de um arquivo grande
 * devolvia centenas de milhares de valores distintos — uma segunda cópia do
 * conteúdo fiscal na main thread, e um menu que o navegador não consegue montar.
 */
function responderValores(
  estrutura: EstruturaSped,
  msg: Extract<ParaWorker, { tipo: "VALORES_TABELA" }>
): void {
  const pedidas = msg.colunas.length > 0 ? msg.colunas : [COLUNA_REGISTRO];
  const conjuntos = new Map<string, Set<string>>(pedidas.map((c) => [c, new Set<string>()]));
  const truncadas = new Set<string>();

  const acumular = (coluna: string, valor: string) => {
    const valores = conjuntos.get(coluna);
    if (!valores) return;
    if (valores.size >= LIMITES.OPCOES_POR_COLUNA) {
      truncadas.add(coluna);
      return;
    }
    valores.add(valor);
  };

  // O recorte por linha vale aqui também: sem ele o menu ofereceria valores
  // que a grade recortada não mostra, e uma coluna sem dado nenhum dentro do
  // recorte continuaria ocupando espaço por causa de linhas que estão fora.
  const permitidas = msg.linhas === undefined ? null : new Set(msg.linhas);

  for (const linha of estrutura.linhas) {
    if (permitidas && !permitidas.has(linha.nl)) continue;

    const falhas = colunasReprovadas(linha, msg.filtros);

    // Reprovou em duas ou mais colunas: não contribui para nenhuma opção. Se
    // reprovou em exatamente uma, contribui só com os valores DAQUELA — é o que
    // faz o menu nunca oferecer uma opção que zeraria a tabela.
    if (falhas.length > 1) continue;
    const somenteEsta = falhas.length === 1 ? falhas[0] : null;

    if (!somenteEsta || somenteEsta === COLUNA_REGISTRO) acumular(COLUNA_REGISTRO, linha.reg);

    /*
     * Percorre os campos DO REGISTRO desta linha, e não as colunas pedidas: o
     * planilhão tem uma coluna por informação do arquivo inteiro (mais de cem
     * num SPED completo), enquanto cada linha tem algumas dezenas de campos.
     * Pelo outro lado o laço custava mais de cem verificações por linha.
     */
    const def = definicaoDoRegistro(linha.reg);
    if (!def) continue;

    for (const campo of def.campos) {
      if (somenteEsta && somenteEsta !== campo.nome) continue;
      acumular(campo.nome, (linha.campos[campo.indice] ?? "").trim());
    }
  }

  const valores: Record<string, string[]> = {};
  for (const [coluna, conjunto] of conjuntos) {
    valores[coluna] = Array.from(conjunto).sort(compararValores);
  }

  responder({
    tipo: "VALORES_TABELA_OK",
    requisicao: msg.requisicao,
    valores,
    truncadas: Array.from(truncadas),
  });
}

/** Só dígitos: o nome do arquivo não pode carregar nada vindo do conteúdo. */
function mesDeReferencia(estrutura: EstruturaSped): string {
  const dtIni = (estrutura.cabecalho?.campos[CAMPO_0000.DT_INI] ?? "").replace(/\D/g, "");
  if (dtIni.length !== 8) return "sem-periodo";
  return `${dtIni.slice(2, 4)}-${dtIni.slice(4, 8)}`; // DDMMAAAA -> MM-AAAA
}

async function gerarTxt(
  estrutura: EstruturaSped,
  msg: Extract<ParaWorker, { tipo: "GERAR_TXT" }>
): Promise<void> {
  /*
   * ORDEM DO PIPELINE, e ela importa:
   *   1. correções aprovadas  — trocam campos e inserem linhas, numa cópia;
   *   2. totalizadores        — contam o arquivo JÁ corrigido: uma linha
   *                             inserida muda o QTD_LIN e o bloco 9;
   *   3. finalidade (COD_FIN) — no 0000 da cópia;
   *   4. serialização e hash  — do que vai ser entregue.
   * Inverter 1 e 2 entregaria totais do arquivo antigo num arquivo novo.
   */
  const aplicacao = aplicarCorrecoes(estrutura.linhas, msg.correcoes);
  const linhas = recalcularTotalizadores(aplicacao.linhas);

  // A finalidade é aplicada na CÓPIA. Escrever no registro 0000 em memória
  // adulterava o arquivo auditado: a grade e os achados passavam a mostrar algo
  // diferente do que o contador tinha carregado, e uma segunda exportação
  // partia de dados já alterados.
  const cabecalho = linhas.find((l) => l.reg === "0000");
  if (cabecalho) cabecalho.campos[CAMPO_0000.COD_FIN] = msg.codFin;

  /*
   * O arquivo tem de voltar com a MESMA forma com que chegou: mesmo charset,
   * mesma quebra de linha, com BOM se tinha BOM, e terminando em quebra apenas
   * se o original terminava. Qualquer diferença aqui é um byte a mais ou a
   * menos num arquivo que o PVA vai conferir.
   */
  const corpo = linhas.map(serializar).join(estrutura.fimDeLinha);
  const texto =
    (estrutura.temBom ? "\uFEFF" : "") + corpo + (estrutura.terminaComQuebra ? estrutura.fimDeLinha : "");
  const bytes =
    estrutura.encoding === "utf-8" ? new TextEncoder().encode(texto) : encodeCP1252(texto);

  // O hash do arquivo EXPORTADO é o par do hash de entrada: um prova o que foi
  // auditado, o outro o que foi entregue.
  const hasher = await createSHA256();
  hasher.init();
  hasher.update(bytes);

  const sufixo = msg.codFin === "1" ? "retificadora" : "original";
  responder({
    tipo: "TXT_OK",
    requisicao: msg.requisicao,
    blob: new Blob([bytes as BlobPart], { type: "text/plain" }),
    nomeSugerido: `SPED-ICMS_${mesDeReferencia(estrutura)}_${sufixo}.txt`,
    hash: hasher.digest("hex"),
    aplicadas: [...aplicacao.aplicadas],
    recusadas: [...aplicacao.recusadas],
  });
}

self.onmessage = async (evento: MessageEvent<ParaWorker>) => {
  const msg = evento.data;

  switch (msg.tipo) {
    case "INICIAR":
      await iniciar(msg.arquivo);
      return;

    case "CANCELAR":
      execucaoAtual++;
      limparTudo();
      responder({ tipo: "CANCELADO", execucao: execucaoAtual });
      return;

    case "LIMPAR":
      execucaoAtual++;
      limparTudo();
      return;

    case "JANELA":
      if (estruturaAtiva) responderJanela(estruturaAtiva, msg);
      return;

    case "VALORES_TABELA":
      if (estruturaAtiva) responderValores(estruturaAtiva, msg);
      return;

    case "GERAR_TXT": {
      if (!estruturaAtiva) return;
      try {
        await gerarTxt(estruturaAtiva, msg);
      } catch (erro) {
        responder({ tipo: "ERRO", execucao: execucaoAtual, ...descrever(erro) });
      }
      return;
    }
  }
};

export {};
