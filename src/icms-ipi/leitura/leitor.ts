import { LIMITES } from "../limites";
import { ErroSped } from "./protocolo";

export type Encoding = "utf-8" | "windows-1252";

/**
 * Descobre o encoding pela amostra inicial.
 *
 * SPED sai da maioria dos ERPs em Windows-1252, mas há geradores que já gravam
 * em UTF-8. Sequência UTF-8 inválida na amostra é a prova de que não é UTF-8.
 */
export async function detectarEncoding(amostra: Uint8Array): Promise<Encoding> {
  if (amostra[0] === 0xef && amostra[1] === 0xbb && amostra[2] === 0xbf) return "utf-8";

  /*
   * UTF-8 só com EVIDÊNCIA POSITIVA. Na dúvida, windows-1252.
   *
   * A amostra tem 4 KB. Uma escrituração começa pelo 0000 e pelos cadastros, e
   * é comum que os primeiros milhares de bytes não tenham acento nenhum — nome
   * de empresa em caixa alta sem cedilha, CNPJ, datas, códigos. Essa amostra é
   * ASCII puro, e ASCII puro é UTF-8 VÁLIDO: o teste abaixo passava e o arquivo
   * inteiro era lido como UTF-8.
   *
   * O estrago aparecia lá adiante, no primeiro acento: em windows-1252 o "Á" é
   * o byte 0xC1, que sozinho é sequência UTF-8 inválida. O decodificador do
   * fluxo (não fatal) o substituía por U+FFFD, e a regravação gravava esses três
   * bytes de volta. Um nome de produto saía corrompido no arquivo entregue à
   * Receita, sem apontamento, sem aviso e sem ninguém ter aprovado nada.
   *
   * A assimetria decide o desempate: errar para windows-1252 NÃO corrompe. A
   * tabela cobre os 256 valores de byte e `encodeCP1252` desfaz o caminho, então
   * um arquivo UTF-8 lido como 1252 aparece com acento estranho na tela e volta
   * byte por byte igual. Errar para UTF-8 destrói o byte.
   */
  let primeiroByteAlto = -1;
  for (let i = 0; i < amostra.length; i++) {
    if (amostra[i] >= 0x80) {
      primeiroByteAlto = i;
      break;
    }
  }
  if (primeiroByteAlto === -1) return "windows-1252";

  /*
   * A amostra é um corte no meio do arquivo e pode partir uma sequência
   * multibyte ao fim. Sem aparar, um arquivo UTF-8 legítimo cujo último acento
   * caia na fronteira seria lido como 1252 — sem corromper, mas com acento
   * errado na tela. Três bytes é o maior resto possível de uma sequência.
   */
  const aparada = amostra.subarray(0, Math.max(primeiroByteAlto, amostra.length - 3));

  try {
    new TextDecoder("utf-8", { fatal: true }).decode(aparada);
    return "utf-8";
  } catch {
    return "windows-1252";
  }
}

/** CRLF é o padrão do SPED, mas arquivo gerado em Linux chega com LF puro. */
export function detectarFimDeLinha(amostra: Uint8Array): "\r\n" | "\n" {
  for (let i = 0; i < amostra.length - 1; i++) {
    if (amostra[i] === 0x0d && amostra[i + 1] === 0x0a) return "\r\n";
    if (amostra[i] === 0x0a) return "\n";
  }
  return "\r\n";
}

/**
 * Quebra o texto em linhas, com teto de tamanho.
 *
 * O teto não é preciosismo: um .txt de 150 MB sem nenhum 0x0A — um binário
 * renomeado serve — fazia o acumulador crescer até o arquivo inteiro, com a aba
 * travada antes de qualquer validação e com o botão "Cancelar" inútil, porque a
 * checagem de cancelamento só acontece entre uma linha e outra e nunca haveria
 * uma segunda linha.
 */
export class QuebraLinhas extends TransformStream<string, string> {
  constructor() {
    let resto = "";
    super({
      transform(chunk, ctrl) {
        const partes = (resto + chunk).split("\n");
        resto = partes.pop() ?? "";
        if (resto.length > LIMITES.CARACTERES_POR_LINHA) {
          ctrl.error(
            new ErroSped(
              "FORMATO",
              "O arquivo tem uma linha muito longa ou não tem quebras de linha — não parece uma escrituração EFD."
            )
          );
          return;
        }
        for (const parte of partes) {
          ctrl.enqueue(parte.endsWith("\r") ? parte.slice(0, -1) : parte);
        }
      },
      flush(ctrl) {
        if (resto) ctrl.enqueue(resto.endsWith("\r") ? resto.slice(0, -1) : resto);
      },
    });
  }
}

interface OpcoesDeLeitura {
  /**
   * Recebe cada bloco de bytes ANTES da decodificação.
   *
   * É o que permite hashear o arquivo como ele está no disco. Hashear a string
   * já decodificada produzia um SHA-256 que jamais bate com `sha256sum` para
   * qualquer arquivo Windows-1252 com acento — e esse hash é exibido ao
   * contador como prova de qual arquivo foi auditado.
   */
  aoLerBytes?: (bloco: Uint8Array) => void;
}

/** Lê o arquivo linha a linha, sem nunca materializá-lo inteiro na memória. */
export async function* lerLinhas(
  arquivo: Blob,
  encoding: Encoding,
  opcoes: OpcoesDeLeitura = {}
): AsyncGenerator<string> {
  const { aoLerBytes } = opcoes;

  const brutos = arquivo.stream() as unknown as ReadableStream<Uint8Array>;

  const observados: ReadableStream<Uint8Array> = aoLerBytes
    ? brutos.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(bloco, ctrl) {
            aoLerBytes(bloco);
            ctrl.enqueue(bloco);
          },
        })
      )
    : brutos;

  // O TextDecoderStream aceita qualquer BufferSource, mas a tipagem do lib.dom
  // não deixa um ReadableStream<Uint8Array> encaixar direto no par.
  const texto = (observados as unknown as ReadableStream<BufferSource>).pipeThrough(
    new TextDecoderStream(encoding)
  );
  const linhas = texto.pipeThrough(new QuebraLinhas());

  const leitor = linhas.getReader();
  try {
    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;
      if (value !== undefined) yield value;
    }
  } finally {
    leitor.releaseLock();
  }
}
