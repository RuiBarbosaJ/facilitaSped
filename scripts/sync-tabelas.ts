/**
 * Robô de sincronização das Tabelas de Códigos do SPED EFD-Contribuições.
 *
 * O portal gov.br/sped é uma SPA (Plone 6 / Volto): o HTML servido pelo backend
 * tem menos de 800 caracteres de texto e os blocos de arquivos são injetados
 * depois, via JavaScript. Por isso a coleta usa Puppeteer (navegador real) em vez
 * de axios + cheerio, que enxergavam apenas o esqueleto da página.
 *
 * Fluxo: Puppeteer descobre as URLs -> fetch nativo baixa os binários ->
 * o conteúdo é convertido em linhas/colunas -> grava public/data/tabelas-sped.json.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import AdmZip from 'adm-zip';
import WordExtractor from 'word-extractor';

import type { NcmOficial, RegistroSped, SincronizacaoMeta, TabelaNcm } from '../src/types/sped';

const PAGE_URL =
  'https://www.gov.br/sped/pt-br/assuntos/escrituracoes-digitais/efd-contribuicoes/tabelas-de-codigos/';

/**
 * A página base do portal não renderiza listagem de filhos — ela contém apenas
 * título e descrição. As seções abaixo são o fallback usado quando a varredura
 * do DOM não encontra nenhum descendente.
 */
const SECOES_FALLBACK = [
  `${PAGE_URL}tabelas-utilizadas-na-apuracao-das-contribuicoes-para-o-pis-pasep-e-da-cofins`,
  `${PAGE_URL}tabelas-utilizadas-na-apuracao-da-contribuicao-previdenciaria-sobre-a-receita-bruta`,
];

const OUTPUT_DIR = path.join(process.cwd(), 'public', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'tabelas-sped.json');
const META_FILE = path.join(OUTPUT_DIR, 'sync-meta.json');
const NCM_FILE = path.join(OUTPUT_DIR, 'ncm.json');

/**
 * Nomenclatura Comum do Mercosul completa, publicada pelo Portal Único Siscomex.
 * As tabelas do SPED só listam NCMs beneficiados; para dizer se um código existe
 * ou foi revogado a auditoria de planilhas precisa da nomenclatura inteira.
 */
const NCM_URL = 'https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json';

const NAV_TIMEOUT = 60_000;
/** Recarregamentos de uma seção antes de recorrer à REST API. */
const TENTATIVAS_POR_SECAO = 3;
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';

/** Um arquivo de tabela localizado no portal. */
interface ArquivoAlvo {
  url: string;
  titulo: string;
}

/** Uma tabela já baixada e convertida em grade de células. */
interface TabelaBruta {
  titulo: string;
  cabecalho: string[];
  linhas: string[][];
}

/* -------------------------------------------------------------------------- */
/* 1. Descoberta das URLs com Puppeteer                                       */
/* -------------------------------------------------------------------------- */

/**
 * Sobe o Chrome headless. As flags --no-sandbox/--disable-setuid-sandbox são
 * obrigatórias em runners de CI, que rodam como root sem namespaces de usuário.
 *
 * Tenta primeiro o Chrome completo; se ele não estiver baixado (cenário comum em
 * máquina de desenvolvimento), cai para o chrome-headless-shell, bem mais leve.
 */
async function lancarNavegador(): Promise<Browser> {
  const args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
  try {
    return await puppeteer.launch({ headless: true, args });
  } catch (erro) {
    console.warn(
      `Chrome completo indisponível (${(erro as Error).message.split('\n')[0]}). Tentando chrome-headless-shell...`
    );
    return puppeteer.launch({ headless: 'shell', args });
  }
}

/** Coleta todos os links de arquivo (@@download / @@display-file / extensão) da página atual. */
function coletarArquivosDoDom(page: Page): Promise<ArquivoAlvo[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('a'))
      .map((a) => ({ url: a.href, titulo: (a.textContent || '').trim() }))
      .filter(({ url }) => /@@download|@@display-file|\.(zip|txt|docx?|xlsx?)(\?|$)/i.test(url))
  );
}

/**
 * Aguarda a listagem de arquivos ser injetada pelo JavaScript. O `networkidle2`
 * do goto() não basta: o bloco de listagem do Volto ainda exibe "Carregando"
 * quando a rede silencia.
 */
async function esperarListagem(page: Page): Promise<boolean> {
  try {
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll('a')).some((a) =>
          /@@download|@@display-file|\.(zip|txt|docx?|xlsx?)(\?|$)/i.test(a.href)
        ),
      { timeout: 30_000, polling: 500 }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Varre o portal e devolve os arquivos de tabela disponíveis.
 *
 * Prioridade 1: um pacote .zip/.txt na página base (formato histórico das
 * "Tabelas em formato txt"). Prioridade 2: os arquivos publicados dentro de cada
 * seção. Hoje o portal só oferece a segunda forma, mas a primeira é mantida para
 * que o robô aproveite o pacote automaticamente caso a Receita volte a publicá-lo.
 */
async function descobrirArquivos(page: Page): Promise<ArquivoAlvo[]> {
  console.log(`Abrindo a página do SPED: ${PAGE_URL}`);
  await page.goto(PAGE_URL, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT });

  const pacote = (await coletarArquivosDoDom(page)).filter(({ url, titulo }) =>
    /\.zip(\?|$)|\.txt(\?|$)/i.test(url) || /tabelas?\s+em\s+formato\s+txt/i.test(titulo)
  );
  if (pacote.length > 0) {
    console.log(`Pacote consolidado encontrado: ${pacote[0].url}`);
    return pacote;
  }

  // Nenhum pacote: desce para as seções e coleta arquivo por arquivo.
  const secoesDom = await page.evaluate(() => {
    const base = location.pathname.replace(/\/$/, '');
    return Array.from(document.querySelectorAll('a'))
      .map((a) => ({ href: a.getAttribute('href') || '', url: a.href }))
      .filter(({ href }) => href.startsWith(`${base}/`) && href.length > base.length + 1)
      .map(({ url }) => url);
  });

  const secoes = secoesDom.length > 0 ? Array.from(new Set(secoesDom)) : SECOES_FALLBACK;
  console.log(
    `Nenhum pacote .zip/.txt na página base. Varrendo ${secoes.length} seção(ões)` +
      `${secoesDom.length === 0 ? ' (lista de fallback)' : ''}.`
  );

  const alvos = new Map<string, ArquivoAlvo>();
  for (const secao of secoes) {
    const encontrados = await coletarSecao(page, secao);
    for (const alvo of encontrados) {
      // @@display-file abre o arquivo no navegador; @@download entrega o binário.
      const url = alvo.url.replace('/@@display-file/', '/@@download/');
      if (!alvos.has(url)) alvos.set(url, { url, titulo: alvo.titulo });
    }
  }
  return Array.from(alvos.values());
}

/**
 * Coleta os arquivos de uma seção, insistindo antes de desistir.
 *
 * O bloco de listagem do Volto depende de uma chamada XHR que o portal às vezes
 * demora ou nem responde; um recarregamento costuma resolver. Se nem assim a
 * página renderizar, consultamos a mesma REST API que o próprio portal usa para
 * montar a listagem — o conteúdo é idêntico, só muda o caminho até ele.
 */
async function coletarSecao(page: Page, secao: string): Promise<ArquivoAlvo[]> {
  const nome = secao.split('/').pop() ?? secao;

  for (let tentativa = 1; tentativa <= TENTATIVAS_POR_SECAO; tentativa++) {
    try {
      await page.goto(secao, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT });
      if (await esperarListagem(page)) {
        const encontrados = await coletarArquivosDoDom(page);
        console.log(`  • ${encontrados.length} arquivo(s) em ${nome}`);
        return encontrados;
      }
      console.warn(`  ! Listagem não renderizou em ${nome} (tentativa ${tentativa}/${TENTATIVAS_POR_SECAO}).`);
    } catch (erro) {
      console.warn(`  ! Falha ao abrir ${nome} (tentativa ${tentativa}/${TENTATIVAS_POR_SECAO}): ${(erro as Error).message}`);
    }
  }

  try {
    const encontrados = await coletarSecaoViaApi(secao);
    console.log(`  • ${encontrados.length} arquivo(s) em ${nome} (via REST API do portal)`);
    return encontrados;
  } catch (erro) {
    console.warn(`  ! ${nome} ignorada — nem a página nem a API responderam: ${(erro as Error).message}`);
    return [];
  }
}

/** Forma de um item da listagem no JSON do plone.restapi — só o que usamos. */
interface ItemPortal {
  '@id': string;
  '@type': string;
  title: string;
}

function ehItemPortal(valor: unknown): valor is ItemPortal {
  if (typeof valor !== 'object' || valor === null) return false;
  const item = valor as Record<string, unknown>;
  return typeof item['@id'] === 'string' && typeof item['@type'] === 'string' && typeof item.title === 'string';
}

/**
 * Plano B de descoberta: a REST API do Plone. Toda página do portal tem um
 * espelho JSON em `/sped/++api++/...` que lista os filhos com tipo e título.
 */
async function coletarSecaoViaApi(secao: string): Promise<ArquivoAlvo[]> {
  const urlApi = secao.replace('/sped/pt-br/', '/sped/++api++/pt-br/');
  const resposta = await fetch(urlApi, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
  });
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status} em ${urlApi}`);

  const corpo: unknown = await resposta.json();
  const itens =
    typeof corpo === 'object' && corpo !== null && Array.isArray((corpo as { items?: unknown }).items)
      ? ((corpo as { items: unknown[] }).items)
      : [];

  return itens
    .filter(ehItemPortal)
    .filter((item) => item['@type'] === 'File')
    .map((item) => ({ url: `${item['@id']}/@@download/file`, titulo: item.title }));
}

/* -------------------------------------------------------------------------- */
/* 2. Download                                                                */
/* -------------------------------------------------------------------------- */

/** Baixa a URL como Buffer usando o fetch nativo do Node. */
async function baixar(url: string): Promise<Buffer> {
  const resposta = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!resposta.ok) {
    throw new Error(`HTTP ${resposta.status} ao baixar ${url}`);
  }
  return Buffer.from(await resposta.arrayBuffer());
}

/* -------------------------------------------------------------------------- */
/* 3. Conversão dos formatos em grade de células                              */
/* -------------------------------------------------------------------------- */

/** Uma célula que contém apenas 2 a 4 dígitos é um código de registro. */
const ehCodigo = (celula: string): boolean => /^\d{2,4}$/.test(celula);

/**
 * Converte o texto de um .doc/.docx em linhas de tabela.
 *
 * O word-extractor traduz o marcador 0x07 do Word (fim de célula e fim de linha)
 * em `\t`, sem distinguir os dois casos. Uma linha nova começa numa célula que é
 * um código puro (2 a 4 dígitos) — mas só quando a célula anterior parece um fim
 * de linha (vazia, "-" ou uma data de término). Sem essa condição, um NCM curto
 * como "2203" ou um subitem "01" (tabela 4.3.11) abriria uma linha falsa e
 * deslocaria todas as colunas seguintes.
 */
function linhasDeDocumentoWord(texto: string): { cabecalho: string[]; linhas: string[][] } {
  const celulas = texto
    .replace(/\r/g, '\n')
    .split('\t')
    .map((c) => c.replace(/\s*\n+\s*/g, ' ').trim());

  // O cabeçalho começa na célula terminada em "Código" (o título do documento
  // costuma vir grudado nela, por isso o teste é por sufixo).
  const inicioCabecalho = celulas.findIndex((c) => /c[óo]digo\s*$/i.test(c));
  if (inicioCabecalho < 0) return { cabecalho: [], linhas: [] };

  // Cabeçalhos de duas linhas (4.3.11) empurram o primeiro código para longe;
  // 40 células cobrem o pior caso observado.
  const inicioDados = celulas.findIndex(
    (c, i) => i > inicioCabecalho && i < inicioCabecalho + 40 && /^(\d{2,4}|-)$/.test(c)
  );
  if (inicioDados < 0) return { cabecalho: [], linhas: [] };

  const cabecalho = celulas
    .slice(inicioCabecalho, inicioDados)
    .map((c, i) => (i === 0 ? 'Código' : c));

  // Com cabeçalho de uma linha só, o número de células dele é o número de
  // colunas — e uma linha "cheia" seguida de um código também é uma quebra.
  // Isso cobre as tabelas de 2 colunas (código + descrição), em que a célula
  // anterior a cada código é texto. Em cabeçalhos de duas linhas (4.3.11) a
  // conta sai inflada e esta regra simplesmente não dispara.
  const colunas = cabecalho.length;

  const linhas: string[][] = [];
  let atual: string[] | null = null;
  for (let i = inicioDados; i < celulas.length; i++) {
    const celula = celulas[i];
    const anterior = i === inicioDados ? '' : celulas[i - 1];
    const linhaCheia = atual !== null && atual.length >= colunas;
    if (ehCodigo(celula) && (ehFimDeLinha(anterior) || linhaCheia)) {
      if (atual) linhas.push(atual);
      atual = [celula];
    } else if (/^c[óo]digo$/i.test(celula) && i > inicioDados && /[A-Za-zÀ-ÿ]{3,}/.test(anterior)) {
      // Um novo cabeçalho no meio do documento (4.3.11 é dividida em "Tabela I",
      // "Tabela II"...) vem logo depois do título da seção. Esse título é a única
      // descrição que as linhas seguintes têm, então entra como linha-marcador.
      if (atual) linhas.push(atual);
      atual = null;
      linhas.push([MARCADOR_SECAO, anterior]);
    } else if (atual) {
      atual.push(celula);
    }
    // Células antes do primeiro código (títulos de seção) são descartadas.
  }
  if (atual) linhas.push(atual);

  return { cabecalho, linhas };
}

/** Primeira célula de uma linha-marcador de seção gerada pelo parser. */
const MARCADOR_SECAO = '#secao';

/** Uma célula que fecha uma linha: término vazio, "-" ou uma data. */
const ehFimDeLinha = (celula: string): boolean =>
  celula === '' || /^-+$/.test(celula) || normalizarData(celula) !== undefined;

/**
 * Lê um .txt delimitado por barra vertical em stream, como no layout oficial dos
 * arquivos do SPED. Linhas sem `|` (cabeçalhos soltos, rodapés) são ignoradas.
 */
async function linhasDeTexto(caminho: string): Promise<string[][]> {
  const linhas: string[][] = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(caminho, { encoding: 'latin1' }),
    crlfDelay: Infinity,
  });
  for await (const linha of rl) {
    if (!linha.includes('|')) continue;
    const campos = linha.split('|').map((c) => c.trim());
    // Descarta os campos vazios gerados pelas barras de início e fim de registro.
    if (campos[0] === '') campos.shift();
    if (campos[campos.length - 1] === '') campos.pop();
    if (campos.length >= 2) linhas.push(campos);
  }
  return linhas;
}

/** Erro de formato que o portal serve mas o robô não consome — não é falha de execução. */
class FormatoNaoSuportado extends Error {}

/** Converte um arquivo baixado na grade de células correspondente ao seu formato. */
async function converter(
  buffer: Buffer,
  titulo: string,
  tmpDir: string
): Promise<TabelaBruta[]> {
  const assinatura = buffer.subarray(0, 4);
  const ehZip = assinatura[0] === 0x50 && assinatura[1] === 0x4b; // "PK"
  const ehOle = buffer.subarray(0, 8).toString('hex') === 'd0cf11e0a1b11ae1'; // .doc/.xls
  const inicio = buffer.subarray(0, 1024).toString('latin1');

  // Alguns itens da listagem apontam para páginas, não para binários.
  if (/^\s*(<!doctype html|<html)/i.test(inicio)) {
    throw new FormatoNaoSuportado('a URL devolveu uma página HTML, não um arquivo');
  }

  // .xls é OLE como o .doc, mas o stream interno é uma planilha do Excel. O nome
  // do stream fica no diretório OLE, que costuma estar no fim do arquivo — daí a
  // varredura do buffer inteiro. Essas tabelas (CFOP, correlação Dacon,
  // 5.1.1 previdenciária) não têm colunas de NCM/CST e ficam fora do RegistroSped.
  if (ehOle && /W\x00o\x00r\x00k\x00b\x00o\x00o\x00k/.test(buffer.toString('latin1'))) {
    throw new FormatoNaoSuportado('planilha .xls sem colunas de NCM/CST');
  }

  // Um ZIP pode ser o pacote de tabelas OU um .docx (que também é um ZIP).
  if (ehZip && !/word\/document\.xml/.test(buffer.subarray(0, 4096).toString('latin1'))) {
    const zip = new AdmZip(buffer);
    const entradas = zip.getEntries().filter((e) => /\.txt$/i.test(e.entryName));
    if (entradas.length > 0) {
      const tabelas: TabelaBruta[] = [];
      for (const entrada of entradas) {
        const destino = path.join(tmpDir, path.basename(entrada.entryName));
        fs.writeFileSync(destino, entrada.getData());
        const linhas = await linhasDeTexto(destino);
        if (linhas.length > 0) {
          tabelas.push({ titulo: `${titulo} :: ${entrada.entryName}`, cabecalho: [], linhas });
        }
      }
      return tabelas;
    }
  }

  if (ehOle || ehZip) {
    // .doc (OLE) e .docx (ZIP) são tratados pelo mesmo extrator.
    const destino = path.join(tmpDir, `tabela-${Buffer.from(titulo).toString('hex').slice(0, 16)}`);
    fs.writeFileSync(destino, buffer);
    let documento;
    try {
      documento = await new WordExtractor().extract(destino);
    } catch (erro) {
      throw new FormatoNaoSuportado(
        `não é um documento do Word legível (${(erro as Error).message})`
      );
    }
    const { cabecalho, linhas } = linhasDeDocumentoWord(documento.getBody());
    return linhas.length > 0 ? [{ titulo, cabecalho, linhas }] : [];
  }

  // Texto puro delimitado por barras.
  const destino = path.join(tmpDir, 'tabela.txt');
  fs.writeFileSync(destino, buffer);
  const linhas = await linhasDeTexto(destino);
  return linhas.length > 0 ? [{ titulo, cabecalho: [], linhas }] : [];
}

/* -------------------------------------------------------------------------- */
/* 4. Mapeamento para RegistroSped                                            */
/* -------------------------------------------------------------------------- */

/**
 * Normaliza uma data de vigência para "MM/AAAA" ou "DD/MM/AAAA".
 *
 * O portal mistura "01/2011", "08/03/2013", "15/12/2011 *", "01.04.2026" e até
 * "01042026". Só o separador é padronizado; texto que não forma uma data válida
 * (alíquotas como "0,6512" caindo na coluna errada, por exemplo) vira undefined.
 */
function normalizarData(valor: string | undefined): string | undefined {
  if (!valor) return undefined;
  const digitos = valor.replace(/\D/g, '');
  const mesValido = (mes: number) => mes >= 1 && mes <= 12;
  const anoValido = (ano: number) => ano >= 1990 && ano <= 2100;

  if (digitos.length === 6) {
    const mes = Number(digitos.slice(0, 2));
    const ano = Number(digitos.slice(2));
    return mesValido(mes) && anoValido(ano) ? `${digitos.slice(0, 2)}/${digitos.slice(2)}` : undefined;
  }
  if (digitos.length === 8) {
    const dia = Number(digitos.slice(0, 2));
    const mes = Number(digitos.slice(2, 4));
    const ano = Number(digitos.slice(4));
    return dia >= 1 && dia <= 31 && mesValido(mes) && anoValido(ano)
      ? `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`
      : undefined;
  }
  return undefined;
}

/**
 * Extrai os NCMs de uma célula. O portal mistura formatos numa coluna só:
 * "1006.20", "02.01", "3002.30", "0713.33.19, 0713.33.29 e 1106.20",
 * "90.21.3", "10.01 a 10.08", "Capítulos 7 e 8" ou simplesmente "-".
 */
function extrairNcms(celula: string): string[] {
  if (!celula || celula === '-') return [];
  // Datas ("01.05.2015", "a partir de 01042026") também são dígitos com pontos;
  // saem antes para não virarem posições da TIPI.
  const semDatas = celula
    .replace(/\b\d{1,2}[./]\d{2}[./]\d{4}\b/g, ' ')
    .replace(/\b(?:em|de|até|desde|a partir de)\s+\d{8}\b/gi, ' ');

  // Formatos aceitos: "02.01", "0206.2", "0206.10", "0206.10.00", "05.11.10.00",
  // "90.21.3", "1006.20", "27101259". Posições de 4 dígitos só contam com o
  // ponto: um "2012" solto é quase sempre um ano, não a posição 20.12 da TIPI.
  const achados =
    semDatas.match(
      /\b(?:\d{2}\.\d{2}(?:\.\d{2}){0,2}(?:\.\d(?!\d))?|\d{4}\.\d{1,2}(?:\.\d{2})?|\d{6}|\d{8})\b/g
    ) || [];
  const normalizados = achados.map((n) => n.replace(/\./g, '')).filter((n) => n.length >= 4);

  return Array.from(new Set([...extrairCapitulos(semDatas), ...normalizados, ...expandirFaixas(semDatas)]));
}

/**
 * "10.01 a 10.08" cita todas as posições entre as duas; o texto não lista cada
 * uma, mas o benefício vale para elas ("milho 10.05" está dentro da faixa).
 */
function expandirFaixas(texto: string): string[] {
  const posicoes: string[] = [];
  for (const faixa of texto.matchAll(/\b(\d{2})\.(\d{2})\s+a\s+(\d{2})\.(\d{2})\b/g)) {
    const inicio = Number(faixa[1] + faixa[2]);
    const fim = Number(faixa[3] + faixa[4]);
    if (fim <= inicio || fim - inicio > 99) continue;
    for (let n = inicio + 1; n < fim; n++) posicoes.push(String(n).padStart(4, '0'));
  }
  return posicoes;
}

/**
 * "Capítulo 31", "Capítulos 39, 40, 63 e 94", "capítulos 8 a 12" → códigos de
 * 2 dígitos ("31", "08"..."12"). Um capítulo é o prefixo de todos os NCMs dele.
 */
function extrairCapitulos(texto: string): string[] {
  const capitulos = new Set<string>();
  for (const trecho of texto.matchAll(/cap[íi]tulos?\s+((?:\d{1,2}(?![\d.])(?:\s*(?:,|e|a|ou)\s*)?)+)/gi)) {
    const partes = trecho[1].match(/\d{1,2}|\ba\b/g) ?? [];
    for (let i = 0; i < partes.length; i++) {
      const anterior = partes[i - 1];
      const proximo = partes[i + 1];
      if (partes[i] === 'a' && anterior && proximo && anterior !== 'a' && proximo !== 'a') {
        for (let n = Number(anterior) + 1; n < Number(proximo); n++) capitulos.add(String(n).padStart(2, '0'));
      } else if (partes[i] !== 'a') {
        capitulos.add(partes[i].padStart(2, '0'));
      }
    }
  }
  return Array.from(capitulos);
}

/**
 * Descrições que não descrevem um produto vendido — valores recebidos,
 * receitas de intermediação — não geram NCM algum.
 */
const REGEX_DESCRICAO_SEM_PRODUTO = /^(valores? recebid|receitas? .{0,40}intermedia)/i;

/**
 * Onde a descrição deixa de falar do produto e passa a falar de quem compra ou
 * do que ele vira depois ("vendas a fabricante de veículos (NCM 8710.00.00)",
 * "destinados à industrialização de..."). Códigos citados dali em diante são de
 * outro produto e não podem virar regra deste.
 */
const REGEX_JUSANTE =
  /\bpessoas?\s+jur[íi]dicas?\s+(?:que|habilitad|produtor|sediad)|\bfabricantes?\s+de\b|\bdestinad[oa]s?\s+(?:à|a|ao|para)\s+(?:industrializa|elabora|produ|fabrica|uso)|\butilizad[oa]s?\s+(?:na|no|em)\s+(?:industrializa|elabora|fabrica)|\bquando\s+(?:adquirid|efetuad|utilizad)|\badquirid[oa]s?\s+(?:por|pel)|\bintermedia[çc][ãa]o\b|\bvendas?\s+(?:a|para)\s+(?:pessoa|empresa|fabricante|produtor)/i;

/**
 * Quando a coluna NCM está vazia, a regra costuma citar os códigos na própria
 * descrição ("Defensivos agropecuários classificados na posição 38.08",
 * "Adubos ... classificados no Capítulo 31, exceto ..."). Só o trecho que
 * define o produto conta: parênteses de exceção somem, e o texto é cortado no
 * primeiro "exceto" e no primeiro sinal de que passou a falar do comprador.
 */
function extrairNcmsDaDescricao(descricao: string): string[] {
  if (REGEX_DESCRICAO_SEM_PRODUTO.test(descricao)) return [];
  const semParentesesDeExcecao = descricao.replace(/\((?:exceto|exclu[ií]d[ao]s?|excetuad[ao]s?|salvo)[^()]*\)/gi, ' ');
  const inclusoes = semParentesesDeExcecao.split(/\bexceto\b|\bexclu[ií]d[ao]s?\b|\bexcetuad[ao]s?\b|com exce[çc][ãa]o|\bsalvo\b/i)[0] ?? '';
  const soProduto = inclusoes.split(REGEX_JUSANTE)[0] ?? '';
  return extrairNcms(soProduto);
}

/** Normaliza alíquotas do padrão brasileiro ("9,25") para o formato do JSON ("9.25"). */
function normalizarAliquota(valor: string): string {
  if (!valor || valor === '-') return '';
  const limpo = valor.replace(/%/g, '').replace(/\./g, '').replace(',', '.').trim();
  return /^\d+(\.\d+)?$/.test(limpo) ? limpo : '';
}

/** Descobre o CST a que a tabela se refere a partir do seu título. */
function cstDoTitulo(titulo: string): string {
  const achado = titulo.match(/CST\s*:?\s*(\d{2})/i);
  return achado ? achado[1] : '';
}

/** "Tabela 4.3.13 – Produtos..." → "4.3.13". */
function numeroDaTabela(titulo: string): string | undefined {
  const achado = titulo.match(/Tabela\s+(\d+\.\d+\.\d+)/i);
  return achado ? achado[1] : undefined;
}

/** Campos de uma linha de produto, localizados pelo conteúdo e não pela coluna. */
interface CamposLinha {
  descricao: string;
  /** Subitem numérico que a 4.3.11 usa no lugar da descrição ("831" | "01"). */
  grupo: string;
  ncm: string;
  aliquota: string;
  inicio?: string;
  fim?: string;
}

/**
 * Lê os campos de uma linha pelo que cada célula contém, não pela posição fixa.
 *
 * As tabelas do portal não têm um leiaute só: 4.3.13 tem 5 colunas, 4.3.10 tem
 * 7, 4.3.17 tem 9 e a 4.3.11 muda de leiaute no meio do documento, com
 * subitens numéricos e colunas de embalagem e volume. O que é estável em todas:
 * descrição vem logo após o código, o NCM logo após a descrição, e as datas de
 * vigência são as únicas células em formato de data.
 */
function lerCampos(linha: string[]): CamposLinha {
  const temTexto = (c: string | undefined) => c !== undefined && /[A-Za-zÀ-ÿ]{3,}/.test(c);

  const iDescricao = temTexto(linha[1]) ? 1 : -1;
  // Sem descrição, a célula seguinte ao código é um subitem ("831" | "01") e o
  // NCM fica uma casa adiante.
  const grupo = iDescricao < 0 && /^\d{1,2}$/.test(linha[1] ?? '') ? linha[1] : '';
  const iNcm = iDescricao >= 0 || grupo ? 2 : 1;

  const datas = linha
    .slice(iNcm + 1)
    .map(normalizarData)
    .filter((d): d is string => d !== undefined);

  const celulaAliquota = linha.find((c, i) => i > iNcm && /^\d+(,\d+)?$/.test(c));

  return {
    descricao: iDescricao >= 0 ? linha[iDescricao] : '',
    grupo,
    ncm: linha[iNcm] ?? '',
    aliquota: normalizarAliquota(celulaAliquota ?? ''),
    inicio: datas[0],
    fim: datas[1],
  };
}

/**
 * Traduz uma tabela bruta em registros do app.
 *
 * Dois tipos de tabela convivem no portal:
 *  - 4.3.3 / 4.3.4 -> [Código, Descrição]: o próprio Código é o CST.
 *  - as demais     -> linhas de produto, em que o Código é a Natureza da Receita
 *                     e o CST vem do título da tabela.
 */
function mapearRegistros(tabela: TabelaBruta): RegistroSped[] {
  const { titulo, cabecalho, linhas } = tabela;
  const cstTabela = cstDoTitulo(titulo);
  const numero = numeroDaTabela(titulo);
  const ehTabelaDeCst = /situa[çc][ãa]o\s+tribut[áa]ria/i.test(titulo);

  // Só alíquotas percentuais entram no JSON. A 4.3.11 publica R$ por unidade de
  // medida — um número que não faz sentido na coluna "Alíquota (%)" da tela.
  const aliquotaPercentual =
    cabecalho.some((c) => /al[íi]quota/i.test(c)) && !cabecalho.some((c) => /reais|r\$/i.test(c));

  const registros: RegistroSped[] = [];
  // Na 4.3.11 os subitens de um código herdam a descrição da linha de grupo ou,
  // na falta dela, o título da seção em que estão ("Tabela III - Águas e
  // Refrigerantes...") acrescido do número do grupo.
  const descricaoDoGrupo = new Map<string, string>();
  let tituloDaSecao = '';
  let semDescricao = 0;

  for (const linha of linhas) {
    const codigo = linha[0]?.trim() ?? '';
    if (!codigo) continue;

    if (codigo === MARCADOR_SECAO) {
      tituloDaSecao = linha[1] ?? '';
      continue;
    }

    if (ehTabelaDeCst) {
      const descricao = linha[1]?.trim() ?? '';
      if (descricao) registros.push({ ncm: '', descricao, cst: codigo, aliquota: '', tabela: numero });
      continue;
    }

    const campos = lerCampos(linha);
    if (campos.descricao) descricaoDoGrupo.set(codigo, campos.descricao);
    const descricao =
      campos.descricao ||
      descricaoDoGrupo.get(codigo) ||
      (tituloDaSecao && campos.grupo ? `${tituloDaSecao} — grupo ${campos.grupo}` : '');
    if (!descricao) {
      semDescricao++;
      continue;
    }

    // Linhas de cabeçalho de grupo ("100 INSUMOS E PRODUTOS AGROPECUÁRIOS") não
    // têm NCM nem vigência — são rótulos de seção, não registros consultáveis.
    if (!campos.ncm && !campos.inicio) continue;

    const base = {
      descricao,
      cst: cstTabela,
      aliquota: aliquotaPercentual ? campos.aliquota : '',
      natureza_receita: codigo,
      data_inicio: campos.inicio,
      data_fim: campos.fim,
      tabela: numero,
    };

    // Coluna NCM primeiro; se vazia, os códigos citados na descrição — marcados
    // como tal, porque um capítulo citado no texto localiza o produto sem defini-lo.
    const ncms = extrairNcms(campos.ncm);
    const daDescricao = ncms.length === 0 ? extrairNcmsDaDescricao(descricao) : [];
    const ncmsFinais = ncms.length > 0 ? ncms : daDescricao;
    if (ncmsFinais.length === 0) {
      // Sem NCM explícito o registro continua útil: é pesquisável por descrição.
      registros.push({ ncm: '', ...base });
    } else {
      // Uma célula pode listar vários NCMs; cada um vira um registro pesquisável.
      for (const ncm of ncmsFinais) {
        registros.push(ncms.length > 0 ? { ncm, ...base } : { ncm, ...base, origem: 'descricao' });
      }
    }
  }

  if (semDescricao > 0) {
    // Aparece no log do Actions: se esse número crescer de repente, o leiaute
    // do documento mudou e o parser precisa de atenção.
    console.warn(`    ${semDescricao} linha(s) sem descrição ignorada(s) em ${numero ?? titulo}`);
  }

  return registros;
}

/**
 * Ordena a saída de forma determinística.
 *
 * Registros com NCM vêm primeiro, porque a consulta por NCM é o caso de uso
 * principal do app — sem isso a tela inicial abriria nas tabelas de CST, que não
 * têm NCM, alíquota nem vigência. A ordem fixa também mantém o `git diff` diário
 * do GitHub Actions legível: só aparece o que a Receita realmente mudou.
 */
function ordenarRegistros(a: RegistroSped, b: RegistroSped): number {
  if (!a.ncm !== !b.ncm) return a.ncm ? -1 : 1;
  return (
    a.ncm.localeCompare(b.ncm) ||
    a.cst.localeCompare(b.cst) ||
    (a.natureza_receita ?? '').localeCompare(b.natureza_receita ?? '') ||
    (a.data_inicio ?? '').localeCompare(b.data_inicio ?? '') ||
    a.descricao.localeCompare(b.descricao)
  );
}

/** Fração da base anterior abaixo da qual a nova saída é considerada parcial. */
const LIMITE_ENCOLHIMENTO = 0.8;

/** Quantos códigos o ncm.json publicado hoje tem (0 se ainda não existe). */
function contarCodigosNcmAtuais(): number {
  try {
    const atual: unknown = JSON.parse(lerArquivo(NCM_FILE) ?? '');
    const codigos = typeof atual === 'object' && atual !== null ? (atual as { codigos?: unknown }).codigos : undefined;
    return Array.isArray(codigos) ? codigos.length : 0;
  } catch {
    return 0;
  }
}

/** Conteúdo de um arquivo, ou undefined se ele ainda não existe. */
function lerArquivo(caminho: string): string | undefined {
  try {
    return fs.readFileSync(caminho, 'utf8');
  } catch {
    return undefined;
  }
}

/** Quantos registros o JSON publicado hoje tem (0 se ainda não existe ou está corrompido). */
function contarRegistrosAtuais(): number {
  try {
    const atual: unknown = JSON.parse(lerArquivo(OUTPUT_FILE) ?? '');
    return Array.isArray(atual) ? atual.length : 0;
  } catch {
    return 0;
  }
}

/* -------------------------------------------------------------------------- */
/* 4b. Tabela NCM oficial (Siscomex)                                          */
/* -------------------------------------------------------------------------- */

/** Forma de um item do JSON do Siscomex — só os campos que usamos. */
interface ItemSiscomex {
  Codigo: string;
  Descricao: string;
  Data_Inicio: string;
  Data_Fim: string;
}

function ehItemSiscomex(valor: unknown): valor is ItemSiscomex {
  if (typeof valor !== 'object' || valor === null) return false;
  const item = valor as Record<string, unknown>;
  return (
    typeof item.Codigo === 'string' &&
    typeof item.Descricao === 'string' &&
    typeof item.Data_Inicio === 'string' &&
    typeof item.Data_Fim === 'string'
  );
}

/** "01/04/2022" → "2022-04-01". O Siscomex usa "31/12/9999" para "sem fim". */
function isoDeDataBr(valor: string): string | undefined {
  const partes = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!partes) return undefined;
  const [, dia, mes, ano] = partes;
  if (ano === '9999') return undefined;
  return `${ano}-${mes}-${dia}`;
}

/** As descrições vêm com tags e entidades HTML ("&lt;i&gt;", "&amp;"). */
function limparHtml(texto: string): string {
  return texto
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Baixa a nomenclatura completa e guarda só os códigos de 8 dígitos (o nível
 * que aparece nas notas fiscais), ordenados, sem o carimbo de data que o
 * Siscomex muda a cada download — assim o arquivo só muda quando a NCM muda.
 *
 * Nunca derruba a sincronização: se o portal falhar, a versão anterior fica.
 */
async function sincronizarNcm(): Promise<void> {
  console.log('\nSincronizando a tabela NCM (Siscomex)...');
  try {
    const resposta = await fetch(NCM_URL, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      redirect: 'follow',
    });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);

    const corpo: unknown = await resposta.json();
    const raiz = typeof corpo === 'object' && corpo !== null ? (corpo as Record<string, unknown>) : {};
    const itens = Array.isArray(raiz.Nomenclaturas) ? raiz.Nomenclaturas : [];

    const validos = itens.filter(ehItemSiscomex);

    // Um quarto das descrições de 8 dígitos é só "Outros"; o sentido está nos
    // níveis acima ("Cavalos › Reprodutores de raça pura › Outros"). Guardamos a
    // cadeia da posição (4 dígitos) até o código, sem repetições consecutivas.
    const descricaoPorNivel = new Map<string, string>();
    for (const item of validos) {
      descricaoPorNivel.set(item.Codigo.replace(/\D/g, ''), limparHtml(item.Descricao).replace(/^-+\s*/, ''));
    }
    const descricaoCompleta = (ncm: string): string => {
      const cadeia: string[] = [];
      for (const tamanho of [4, 5, 6, 7, 8]) {
        const texto = descricaoPorNivel.get(ncm.slice(0, tamanho));
        if (texto && texto !== cadeia[cadeia.length - 1]) cadeia.push(texto);
      }
      return cadeia.join(' › ');
    };

    const codigos: NcmOficial[] = validos
      .map((item) => ({
        ncm: item.Codigo.replace(/\D/g, ''),
        descricao: '',
        inicio: isoDeDataBr(item.Data_Inicio) ?? '1900-01-01',
        fim: isoDeDataBr(item.Data_Fim),
      }))
      .filter((c) => c.ncm.length === 8)
      .map((c) => ({ ...c, descricao: descricaoCompleta(c.ncm) }))
      .map((c) => (c.fim === undefined ? { ncm: c.ncm, descricao: c.descricao, inicio: c.inicio } : c))
      .sort((a, b) => a.ncm.localeCompare(b.ncm) || a.inicio.localeCompare(b.inicio));

    // A NCM tem cerca de dez mil códigos de 8 dígitos; bem menos que isso é
    // resposta truncada ou página de erro, não uma nomenclatura nova. E, como
    // nas tabelas do SPED, uma queda brusca frente à versão anterior é
    // instabilidade do portal, não a Receita revogando milhares de códigos.
    if (codigos.length < 5000) {
      throw new Error(`apenas ${codigos.length} códigos de 8 dígitos na resposta — descartada`);
    }
    const anteriores = contarCodigosNcmAtuais();
    if (anteriores > 0 && codigos.length < anteriores * LIMITE_ENCOLHIMENTO) {
      throw new Error(
        `a nomenclatura encolheu de ${anteriores} para ${codigos.length} códigos (abaixo de ${LIMITE_ENCOLHIMENTO * 100}%) — descartada`
      );
    }

    const tabela: TabelaNcm = {
      fonte: typeof raiz.Ato === 'string' ? raiz.Ato : 'Siscomex',
      codigos,
    };
    const conteudo = JSON.stringify(tabela);
    if (conteudo === lerArquivo(NCM_FILE)) {
      console.log(`  Tabela NCM inalterada (${codigos.length} códigos, ${tabela.fonte}).`);
      return;
    }
    fs.writeFileSync(NCM_FILE, conteudo);
    console.log(`  ${codigos.length} códigos NCM salvos em ${NCM_FILE} (${tabela.fonte}).`);
  } catch (erro) {
    const existe = lerArquivo(NCM_FILE) !== undefined;
    console.warn(
      `  ! Tabela NCM não atualizada: ${(erro as Error).message}. ` +
        (existe ? 'Mantida a versão anterior.' : 'Nenhuma versão anterior — a auditoria ficará sem checagem de NCM.')
    );
  }
}

/* -------------------------------------------------------------------------- */
/* 5. Orquestração                                                            */
/* -------------------------------------------------------------------------- */

async function syncTabelas(): Promise<void> {
  console.log('Iniciando coleta automatizada das tabelas SPED...');
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sped-'));

  let browser: Browser | null = null;
  try {
    browser = await lancarNavegador();
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    page.setDefaultNavigationTimeout(NAV_TIMEOUT);

    const alvos = await descobrirArquivos(page);
    if (alvos.length === 0) {
      throw new Error('Nenhum arquivo de tabela foi localizado no portal do SPED.');
    }
    console.log(`\n${alvos.length} arquivo(s) para processar.`);

    // O navegador já cumpriu seu papel; libera antes da fase de parsing.
    await browser.close();
    browser = null;

    const registros = new Map<string, RegistroSped>();
    const ignorados: string[] = [];
    const versoes: Record<string, string> = {};

    for (const alvo of alvos) {
      const nome = alvo.titulo.slice(0, 60) || alvo.url;
      const matchVersao = alvo.titulo.match(/Vers[ãa]o\s+([\d.A-C]+)/i);
      const numeroTab = numeroDaTabela(alvo.titulo);
      if (numeroTab && matchVersao) {
        versoes[numeroTab] = matchVersao[1];
      }
      
      try {
        const buffer = await baixar(alvo.url);
        const tabelas = await converter(buffer, alvo.titulo, tmpDir);
        let novos = 0;
        for (const tabela of tabelas) {
          for (const registro of mapearRegistros(tabela)) {
            // NCM + CST + natureza da receita + vigência identificam a regra.
            // Definições de CST (4.3.3 e 4.3.4 são idênticas) colapsam por código;
            // regras de produto são únicas por tabela + NCM + código + vigência.
            const chave =
              registro.natureza_receita === undefined
                ? `cst|${registro.cst}`
                : [
                    registro.tabela ?? '',
                    registro.ncm,
                    registro.cst,
                    registro.natureza_receita,
                    registro.data_inicio ?? '',
                  ].join('|');
            if (!registros.has(chave)) {
              registros.set(chave, registro);
              novos++;
            }
          }
        }
        if (novos > 0) {
          console.log(`  ✓ ${nome} — ${novos} registro(s)`);
        } else {
          // Tabelas auxiliares de 2 colunas (código + descrição) não têm NCM,
          // CST nem vigência, então não geram registros consultáveis.
          ignorados.push(`${nome} — nenhum registro no formato RegistroSped`);
        }
      } catch (erro) {
        // Um arquivo problemático não pode derrubar a sincronização inteira.
        const motivo =
          erro instanceof FormatoNaoSuportado
            ? erro.message
            : `falha ao processar (${(erro as Error).message})`;
        ignorados.push(`${nome} — ${motivo}`);
      }
    }

    if (ignorados.length > 0) {
      console.log(`\n${ignorados.length} arquivo(s) fora do escopo do JSON:`);
      for (const item of ignorados) console.log(`  – ${item}`);
    }

    const dados = Array.from(registros.values()).sort(ordenarRegistros);
    if (dados.length === 0) {
      throw new Error('Nenhum registro foi extraído — abortando para não sobrescrever o JSON atual.');
    }

    // Um arquivo que falhe no download some da saída sem derrubar o script. Se
    // isso encolher a base além do tolerável, é quase certo que foi instabilidade
    // do portal, não a Receita revogando centenas de regras de uma vez — e um
    // JSON pela metade chegaria ao ar via commit automático. Melhor abortar e
    // deixar o run do dia seguinte tentar de novo.
    const anterior = contarRegistrosAtuais();
    if (anterior > 0 && dados.length < anterior * LIMITE_ENCOLHIMENTO) {
      throw new Error(
        `Base encolheu de ${anterior} para ${dados.length} registros (abaixo de ` +
          `${LIMITE_ENCOLHIMENTO * 100}%) — abortando para não publicar dados parciais.`
      );
    }

    // O carimbo de tempo mora num arquivo à parte e só é reescrito quando os
    // dados de fato mudam. Se ele fosse gravado a cada execução, o
    // `git status` do workflow acusaria mudança todo dia e geraria um commit
    // (e um deploy) diário sem nenhuma alteração real da Receita.
    const conteudo = JSON.stringify(dados);
    const semMudanca = conteudo === lerArquivo(OUTPUT_FILE);
    // O carimbo também é criado quando ainda não existe: sem isso, uma base que
    // ficasse meses sem alteração nunca ganharia data para mostrar na tela.
    if (semMudanca && lerArquivo(META_FILE) !== undefined) {
      console.log(`\nNenhuma mudança: as ${dados.length} regras seguem iguais às publicadas.`);
    } else {
      if (!semMudanca) fs.writeFileSync(OUTPUT_FILE, conteudo);
      const meta: SincronizacaoMeta = {
        atualizado_em: new Date().toISOString(),
        registros: dados.length,
        versoes,
      };
      fs.writeFileSync(META_FILE, `${JSON.stringify(meta, null, 2)}\n`);
      if (semMudanca) {
        console.log(`\nRegras inalteradas (${dados.length}); carimbo de atualização criado.`);
      } else {
        console.log(`\n${dados.length} registros únicos salvos em ${OUTPUT_FILE}`);
      }
      console.log(`Carimbo gravado em ${META_FILE}`);
    }

    // A tabela NCM é independente das tabelas do SPED: falhar aqui não pode
    // desfazer o trabalho acima, por isso ela trata os próprios erros.
    await sincronizarNcm();
  } catch (erro) {
    console.error('Erro durante a sincronização:', erro);
    process.exitCode = 1;
  } finally {
    // Garante que o Chrome não fique órfão travando o runner do GitHub Actions.
    if (browser) {
      await browser.close().catch(() => undefined);
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

void syncTabelas();
