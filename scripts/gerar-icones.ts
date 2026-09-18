import { Buffer } from "node:buffer";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

/**
 * Gera os ícones do sistema a partir da MESMA logo que o cabeçalho usa.
 *
 *   npm run icones
 *
 * Existe como script, e não como três arquivos commitados sem explicação,
 * porque a logo é a fonte: quando ela mudar, isto refaz os três derivados de
 * uma vez, com as mesmas margens e a mesma cor de fundo. Sem ele, a próxima
 * troca de logo deixaria o favicon antigo para trás, calado — e um favicon
 * desatualizado é o tipo de coisa que ninguém nota por meses.
 */

const RAIZ = process.cwd();
const LOGO = path.join(RAIZ, "public", "logo-sped-v2.png");
const APP = path.join(RAIZ, "src", "app");

/**
 * Fundo transparente — o símbolo sozinho, como no cabeçalho.
 *
 * RESSALVA MEDIDA: a logo é prateada (luminância média 166 de 255). Numa barra
 * de abas CLARA ela fica com contraste perto de 2:1 e se lê apagada; numa barra
 * escura, que é onde a maioria trabalha, ela salta. Uma placa de fundo resolvia
 * o caso claro, mas punha uma moldura que a marca não tem em lugar nenhum — e a
 * decisão foi manter o símbolo como ele é aplicado no resto do sistema.
 */
const FUNDO = { r: 0, g: 0, b: 0, alpha: 0 };

/**
 * Folga em volta do símbolo, em fração do lado.
 *
 * Pequena de propósito: sem placa atrás, o quadro do ícone é invisível, e toda
 * margem vira só desenho menor. A folga que sobra existe para o símbolo não
 * encostar na borda quando o navegador recorta o ícone em círculo.
 */
const FOLGA = 0.04;

/**
 * A logo aparada, encaixada e centrada num quadrado.
 *
 * O `trim` importa: o PNG de origem é 512×432 com margem transparente, e
 * redimensionar sem aparar deixaria a arte pequena e fora do centro óptico.
 */
async function quadrado(lado: number): Promise<Buffer> {
  const util = Math.round(lado * (1 - 2 * FOLGA));
  const logo = await sharp(LOGO)
    .trim({ threshold: 1 })
    .resize(util, util, { fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer({ resolveWithObject: true });

  return sharp({ create: { width: lado, height: lado, channels: 4, background: FUNDO } })
    .composite([
      {
        input: logo.data,
        top: Math.round((lado - logo.info.height) / 2),
        left: Math.round((lado - logo.info.width) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Empacota vários PNGs num único `.ico`.
 *
 * O formato aceita PNG dentro dos quadros desde o Windows Vista, e todo
 * navegador em uso hoje o lê. A alternativa — BMP sem compressão — triplicaria
 * o arquivo para o mesmo resultado.
 *
 * Vários tamanhos, e não só um grande: o navegador escolhe o quadro mais
 * próximo em vez de reduzir o de 48px para 16, que é onde a arte vira borrão.
 */
function empacotarIco(quadros: readonly { lado: number; png: Buffer }[]): Buffer {
  const CABECALHO = 6;
  const ENTRADA = 16;
  const cabecalho = Buffer.alloc(CABECALHO + ENTRADA * quadros.length);
  cabecalho.writeUInt16LE(0, 0); // reservado
  cabecalho.writeUInt16LE(1, 2); // 1 = ícone
  cabecalho.writeUInt16LE(quadros.length, 4);

  let deslocamento = cabecalho.length;
  quadros.forEach(({ lado, png }, i) => {
    const o = CABECALHO + i * ENTRADA;
    cabecalho.writeUInt8(lado >= 256 ? 0 : lado, o); // 0 quer dizer 256
    cabecalho.writeUInt8(lado >= 256 ? 0 : lado, o + 1);
    cabecalho.writeUInt8(0, o + 2); // paleta: nenhuma
    cabecalho.writeUInt8(0, o + 3); // reservado
    cabecalho.writeUInt16LE(1, o + 4); // planos
    cabecalho.writeUInt16LE(32, o + 6); // bits por pixel
    cabecalho.writeUInt32LE(png.length, o + 8);
    cabecalho.writeUInt32LE(deslocamento, o + 12);
    deslocamento += png.length;
  });

  return Buffer.concat([cabecalho, ...quadros.map((q) => q.png)]);
}

const TAMANHOS_DO_ICO = [16, 32, 48] as const;

async function principal() {
  /*
   * Os três arquivos são convenções do App Router: o Next descobre `icon` e
   * `apple-icon` pelo nome e escreve as tags sozinho. `favicon.ico` continua
   * porque navegador antigo e leitor de RSS pedem `/favicon.ico` direto, sem
   * olhar o HTML.
   */
  const quadros = await Promise.all(
    TAMANHOS_DO_ICO.map(async (lado) => ({ lado, png: await quadrado(lado) }))
  );
  await writeFile(path.join(APP, "favicon.ico"), empacotarIco(quadros));

  /*
   * 256px, e não 512: o ícone é baixado por toda visita e nunca é exibido
   * acima de ~180px (o atalho de tela inicial do Android). A 512 o arquivo
   * passava de 160 kB — mais que o HTML da página — sem nenhum ganho visível.
   */
  await writeFile(path.join(APP, "icon.png"), await quadrado(256));

  /*
   * O iOS compõe ícone transparente sobre PRETO e aplica o próprio
   * arredondamento. Para um símbolo prateado isso cai bem — é o mesmo contraste
   * da barra de abas escura —, então ele vai transparente como os outros, e não
   * com uma placa que só existiria aqui.
   */
  await writeFile(path.join(APP, "apple-icon.png"), await quadrado(180));

  console.log(`favicon.ico  ${TAMANHOS_DO_ICO.join("/")} px`);
  console.log("icon.png     256 px");
  console.log("apple-icon.png 180 px");
}

void principal();
