import { gerarXlsx, sanitizarCelula } from "@/pis-cofins/planilha";
import type { RegraAgrupada } from "./agrupar";

/**
 * Levar a consulta para a planilha de conferência.
 *
 * É o passo que vem depois de toda busca nesta tela: o analista acha as regras
 * do NCM, e então precisa cruzá-las com a planilha de produtos do cliente. Sem
 * exportação, esse cruzamento vira cópia manual linha a linha — e é aí que
 * entra o erro de digitação que a ferramenta existe para evitar.
 *
 * Exporta o que está NA TELA, com a busca e os filtros aplicados. Exportar a
 * base inteira devolveria um arquivo que ninguém pediu e que não corresponde ao
 * que a pessoa estava olhando.
 */

const CABECALHO = [
  "NCM",
  "Descrição",
  "CST",
  "Alíquota",
  "Natureza da receita",
  "Início da vigência",
  "Fim da vigência",
  "Tabela",
] as const;

/** Larguras em caracteres, para a planilha abrir legível em vez de espremida. */
const LARGURAS = [22, 70, 8, 10, 20, 18, 18, 10];

function linhaDe(regra: RegraAgrupada): unknown[] {
  return [
    // Os NCMs de uma regra vão numa célula só, separados por espaço: uma linha
    // por NCM inflaria o arquivo e desfaria o agrupamento que a tela mostra.
    regra.ncms.join(" "),
    regra.descricao ?? "",
    regra.cst ?? "",
    regra.aliquota ?? "",
    regra.natureza_receita ?? "",
    regra.data_inicio ?? "",
    regra.data_fim ?? "",
    regra.tabela ?? "",
  ];
}

export function linhasParaExportacao(regras: readonly RegraAgrupada[]): unknown[][] {
  return [[...CABECALHO], ...regras.map(linhaDe)];
}

/** Nome do arquivo: só ASCII e dígitos — o termo buscado não entra. */
function nomeDoArquivo(extensao: string, cst: string): string {
  const recorte = cst && cst !== "todos" ? `-cst${cst.replace(/\D/g, "")}` : "";
  return `tabelas-sped${recorte}.${extensao}`;
}

export async function exportarXlsx(regras: readonly RegraAgrupada[], cst: string): Promise<void> {
  const { baixarArquivo } = await import("@/pis-cofins/planilha");
  const bytes = await gerarXlsx(linhasParaExportacao(regras), "Tabelas SPED", LARGURAS);
  baixarArquivo(bytes, nomeDoArquivo("xlsx", cst));
}

/**
 * CSV em ponto e vírgula, com BOM.
 *
 * O Excel em português lê vírgula como separador decimal, então um CSV separado
 * por vírgula abre com tudo numa coluna só. E sem o BOM ele decodifica o
 * arquivo como ANSI: "Alíquota" vira "AlÃ­quota" na primeira célula que o
 * analista olha.
 */
export function exportarCsv(regras: readonly RegraAgrupada[], cst: string): void {
  const escapar = (valor: unknown) => {
    const texto = String(sanitizarCelula(valor) ?? "");
    return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };

  const texto = linhasParaExportacao(regras)
    .map((linha) => linha.map(escapar).join(";"))
    .join("\r\n");

  const blob = new Blob([`﻿${texto}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const ancora = document.createElement("a");
  ancora.href = url;
  ancora.download = nomeDoArquivo("csv", cst);
  document.body.appendChild(ancora);
  ancora.click();
  ancora.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
