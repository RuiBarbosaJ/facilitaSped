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

import type { RegistroSped } from '../src/types/sped';

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
 * em `\t`, mas não distingue os dois casos — células mescladas fazem linhas
 * vizinhas se fundirem. Por isso não usamos fatiamento fixo: a cada célula que é
 * um código puro começamos uma linha nova, o que ressincroniza a grade sozinho.
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

  const inicioDados = celulas.findIndex(
    (c, i) => i > inicioCabecalho && i < inicioCabecalho + 20 && /^(\d{2,4}|-)$/.test(c)
  );
  if (inicioDados < 0) return { cabecalho: [], linhas: [] };

  const colunas = inicioDados - inicioCabecalho;
  if (colunas < 2) return { cabecalho: [], linhas: [] };

  const cabecalho = celulas
    .slice(inicioCabecalho, inicioDados)
    .map((c, i) => (i === 0 ? 'Código' : c));

  const linhas: string[][] = [];
  let atual: string[] | null = null;
  for (let i = inicioDados; i < celulas.length; i++) {
    const celula = celulas[i];
    if (ehCodigo(celula)) {
      if (atual) linhas.push(atual);
      atual = [celula];
    } else if (atual && atual.length < colunas) {
      atual.push(celula);
    }
    // Células excedentes vindas de mesclagem são descartadas até o próximo código.
  }
  if (atual) linhas.push(atual);

  return {
    cabecalho,
    linhas: linhas.map((l) => {
      while (l.length < colunas) l.push('');
      return l;
    }),
  };
}

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

/** Índice da primeira coluna cujo cabeçalho casa com o padrão. */
const acharColuna = (cabecalho: string[], padrao: RegExp): number =>
  cabecalho.findIndex((c) => padrao.test(c));

/**
 * Extrai os NCMs de uma célula. O portal mistura formatos numa coluna só:
 * "1006.20", "02.01", "3002.30", "0713.33.19, 0713.33.29 e 1106.20",
 * "Capítulos 7 e 8" ou simplesmente "-".
 */
function extrairNcms(celula: string): string[] {
  if (!celula || celula === '-') return [];
  const achados = celula.match(/\b\d{2}\.?\d{2}(?:\.?\d{2}){0,2}\b/g) || [];
  const normalizados = achados.map((n) => n.replace(/\./g, '')).filter((n) => n.length >= 4);
  return Array.from(new Set(normalizados));
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

/**
 * Traduz uma tabela bruta em registros do app.
 *
 * Três formatos convivem no portal:
 *  - 4.3.3 / 4.3.4  -> [Código, Descrição]: o próprio Código é o CST.
 *  - 4.3.13 / 4.3.16 -> [Código, Descrição, NCM, Início, Término]: alíquota zero.
 *  - 4.3.10 / 4.3.17 -> acrescentam colunas de alíquota de PIS e COFINS.
 * Em todas elas o "Código" é a Natureza da Receita, e o CST vem do título.
 */
function mapearRegistros(tabela: TabelaBruta): RegistroSped[] {
  const { titulo, cabecalho, linhas } = tabela;
  const cstTabela = cstDoTitulo(titulo);
  const ehTabelaDeCst = /situa[çc][ãa]o\s+tribut[áa]ria/i.test(titulo);

  const iNcm = acharColuna(cabecalho, /^ncm/i);
  const iDescricao = acharColuna(cabecalho, /descri[çc][ãa]o/i);
  const iAliquota = acharColuna(cabecalho, /al[íi]quota.*pis/i);
  const iInicio = acharColuna(cabecalho, /in[íi]cio/i);
  const iTermino = acharColuna(cabecalho, /t[ée]rmino|fim/i);

  const registros: RegistroSped[] = [];

  for (const linha of linhas) {
    const codigo = (linha[0] || '').trim();
    const descricao = (linha[iDescricao > 0 ? iDescricao : 1] || '').trim();
    if (!codigo || !descricao) continue;

    // Tabelas 4.3.3/4.3.4: o código é o próprio CST e não há NCM.
    if (ehTabelaDeCst) {
      registros.push({ ncm: '', descricao, cst: codigo, aliquota: '' });
      continue;
    }

    // Linhas de cabeçalho de grupo ("100 INSUMOS E PRODUTOS AGROPECUÁRIOS") não
    // têm NCM nem vigência — são rótulos de seção, não registros consultáveis.
    const bruto = { ncm: iNcm > 0 ? linha[iNcm] || '' : '', inicio: iInicio > 0 ? linha[iInicio] || '' : '' };
    if (!bruto.ncm && !bruto.inicio) continue;

    const base = {
      descricao,
      cst: cstTabela,
      aliquota: iAliquota > 0 ? normalizarAliquota(linha[iAliquota] || '') : '',
      natureza_receita: codigo,
      data_inicio: bruto.inicio || undefined,
      data_fim: (iTermino > 0 ? linha[iTermino] : '') || undefined,
    };

    const ncms = extrairNcms(bruto.ncm);
    if (ncms.length === 0) {
      // Sem NCM explícito o registro continua útil: é pesquisável por descrição,
      // CST e natureza da receita.
      registros.push({ ncm: '', ...base });
    } else {
      // Uma célula pode listar vários NCMs; cada um vira um registro pesquisável.
      for (const ncm of ncms) registros.push({ ncm, ...base });
    }
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

/** Quantos registros o JSON publicado hoje tem (0 se ainda não existe ou está corrompido). */
function contarRegistrosAtuais(): number {
  try {
    const atual: unknown = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
    return Array.isArray(atual) ? atual.length : 0;
  } catch {
    return 0;
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

    for (const alvo of alvos) {
      const nome = alvo.titulo.slice(0, 60) || alvo.url;
      try {
        const buffer = await baixar(alvo.url);
        const tabelas = await converter(buffer, alvo.titulo, tmpDir);
        let novos = 0;
        for (const tabela of tabelas) {
          for (const registro of mapearRegistros(tabela)) {
            // NCM + CST + natureza da receita + vigência identificam a regra.
            const chave = [
              registro.ncm,
              registro.cst,
              registro.natureza_receita ?? '',
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

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(dados));
    console.log(`\n${dados.length} registros únicos salvos em ${OUTPUT_FILE}`);
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
