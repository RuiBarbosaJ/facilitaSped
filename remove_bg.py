"""Remove o fundo da logo mantendo as partes claras do símbolo.

A versão anterior comparava cada pixel com a cor de fundo isoladamente, então
apagava também o interior da esfera (o degradê passa pelo mesmo cinza do fundo)
e o símbolo saía cortado pela metade. Aqui o fundo é detectado por região
conectada às bordas da imagem: só some o cinza que chega até a moldura.
"""

import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

# Distância máxima de cor (por canal) para um pixel entrar na região de fundo.
TOL_FUNDO = 16
# Faixa da transição suave: <= OPACO_ATE vira transparente, >= TRANSP_APOS opaco.
OPACO_ATE = 8
TRANSP_APOS = 20


def remove_background(input_path, output_path):
    rgb = np.asarray(Image.open(input_path).convert("RGB")).astype(np.float32)

    # Cor do fundo: mediana da moldura de 1px (robusta a ruído de JPEG).
    moldura = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    fundo = np.median(moldura, axis=0)
    dist = np.abs(rgb - fundo).max(axis=2)

    # Só é fundo o cinza ligado às bordas — o interior do símbolo fica intacto.
    rotulos, _ = ndi.label(dist <= TOL_FUNDO)
    das_bordas = set(rotulos[0]) | set(rotulos[-1]) | set(rotulos[:, 0]) | set(rotulos[:, -1])
    das_bordas.discard(0)
    mascara_fundo = np.isin(rotulos, list(das_bordas))

    alfa = np.ones(dist.shape, np.float32)
    alfa[mascara_fundo] = np.clip(
        (dist[mascara_fundo] - OPACO_ATE) / (TRANSP_APOS - OPACO_ATE), 0, 1
    )
    alfa[alfa < 0.10] = 0.0  # descarta o chuvisco do JPEG no fundo

    # Suaviza apenas a faixa de transição, para a borda não ficar serrilhada.
    faixa = ndi.binary_dilation((alfa > 0) & (alfa < 1), iterations=2)
    alfa = np.where(faixa, ndi.gaussian_filter(alfa, 0.8), alfa)
    alfa[alfa < 0.04] = 0.0

    # Tira o halo cinza da borda: desfaz a mistura com o fundo antigo.
    parcial = (alfa > 0.15) & (alfa < 1)
    cor = rgb.copy()
    cor[parcial] = np.clip(fundo + (rgb[parcial] - fundo) / alfa[parcial][:, None], 0, 255)

    saida = np.dstack([cor.round().astype(np.uint8), (alfa * 255).round().astype(np.uint8)])
    Image.fromarray(saida, "RGBA").save(output_path, "PNG", optimize=True)
    print("Saved to", output_path)


if __name__ == "__main__":
    entrada = sys.argv[1] if len(sys.argv) > 1 else "public/logo-sped.jpeg"
    saida = sys.argv[2] if len(sys.argv) > 2 else "public/logo-sped-v2.png"
    remove_background(entrada, saida)
