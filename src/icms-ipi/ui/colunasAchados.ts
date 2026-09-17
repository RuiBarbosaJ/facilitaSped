import { AlertTriangle, Info, ShieldAlert } from "lucide-react";

import type { ColunaFiltravel } from "@/comum/filtrosColuna";
import type { Achado, ConsertoDoAchado, Severidade } from "@/regras/nucleo/contrato";

export type ColunaAchado = ColunaFiltravel<Achado>;

/** Rótulo de cada severidade. É por ele que o menu de filtro é lido e ordenado. */
export const ROTULO_SEVERIDADE: Record<Severidade, string> = {
  critico: "Crítico",
  erro: "Erro",
  alerta: "Alerta",
  info: "Informativo",
};

/**
 * Cor e ícone de cada severidade, compartilhados pela lista de apontamentos e
 * pelo recorte da grade.
 *
 * A severidade nunca é comunicada só pela cor: um auditor com daltonismo — ou
 * lendo o relatório impresso — precisa separar o que reprova a entrega do que é
 * informativo. Daí rótulo em texto e ícone próprio, além da cor.
 *
 * Mora aqui, e não em cada tela, porque as duas falam do mesmo fato: um selo
 * "Erro" vermelho na lista e um "Erro" de outra cor na grade fariam o contador
 * procurar a diferença que não existe.
 */
export const ESTILO_SEVERIDADE: Record<
  Severidade,
  { classe: string; Icone: typeof AlertTriangle }
> = {
  critico: { classe: "border-danger/30 bg-danger-soft text-danger", Icone: ShieldAlert },
  erro: { classe: "border-danger/30 bg-danger-soft text-danger", Icone: AlertTriangle },
  alerta: { classe: "border-warning/30 bg-warning-soft text-warning", Icone: AlertTriangle },
  info: { classe: "border-accent/30 bg-accent-soft text-accent", Icone: Info },
};

/**
 * Como a célula apontada é pintada na grade.
 *
 * Fundo sólido, e não transparência: a coluna do registro é `sticky` e o
 * conteúdo da grade passa por baixo dela — com fundo translúcido, a célula
 * pintada viraria um borrão em movimento durante a rolagem horizontal.
 *
 * A cor sozinha não basta, aqui como na lista: a célula pintada também ganha
 * `title` e entra no rótulo lido em voz alta.
 */
export const FUNDO_SEVERIDADE: Record<Severidade, { celula: string; texto: string }> = {
  critico: { celula: "bg-danger-soft", texto: "text-danger" },
  erro: { celula: "bg-danger-soft", texto: "text-danger" },
  alerta: { celula: "bg-warning-soft", texto: "text-warning" },
  info: { celula: "bg-accent-soft", texto: "text-accent" },
};

/**
 * Faixa lateral da linha apontada, na coluna do número.
 *
 * Classes completas, e não montadas por interpolação: o Tailwind lê o código
 * como texto para decidir o que gerar, e `border-l-${cor}` não existiria no CSS
 * final — a faixa simplesmente não apareceria, sem erro nenhum.
 */
export const BORDA_SEVERIDADE: Record<Severidade, string> = {
  critico: "border-l-danger",
  erro: "border-l-danger",
  alerta: "border-l-warning",
  info: "border-l-accent",
};

/**
 * Como cada tipo de conserto se apresenta.
 *
 * Os três estados são fiscalmente diferentes e a tela precisa separá-los:
 * "automática" entra no arquivo sem perguntar, "sugerida" espera um clique
 * consciente, e "manual" quer dizer que a ferramenta não tem valor a propor —
 * o conserto é no ERP, antes de gerar de novo.
 */
export const ROTULO_CONSERTO: Record<ConsertoDoAchado, string> = {
  automatica: "Automática na regravação",
  sugerida: "Sugerida — aprove na linha",
  manual: "Manual, na origem",
};

/** Da mais grave para a menos: é a ordem em que o contador quer resolver. */
export const ORDEM_SEVERIDADE: Record<Severidade, number> = {
  critico: 0,
  erro: 1,
  alerta: 2,
  info: 3,
};

/**
 * Colunas da lista de apontamentos e como filtrar cada uma.
 *
 * Coluna sem `valores` não ganha menu: o número da linha é único por definição
 * e a mensagem é texto livre que repete o valor da própria linha no meio da
 * frase — o menu viraria uma opção por apontamento. Para esses dois a busca
 * serve melhor, exatamente como na auditoria de planilhas.
 */
export const COLUNAS_ACHADOS: ColunaAchado[] = [
  {
    id: "severidade",
    rotulo: "Severidade",
    valores: (achado) => [ROTULO_SEVERIDADE[achado.severidade]],
  },
  { id: "linha", rotulo: "Linha" },
  {
    id: "nota",
    rotulo: "Nota",
    // Ganha menu: filtrar por uma nota é a pergunta natural depois de achar um
    // apontamento nela — "o que mais tem de errado neste documento?".
    valores: (achado) => [achado.documento || "—"],
  },
  {
    id: "registro",
    rotulo: "Registro",
    valores: (achado) => [achado.reg || "—"],
  },
  {
    id: "codigo",
    rotulo: "Código",
    valores: (achado) => [achado.codigo],
  },
  {
    id: "regra",
    rotulo: "Regra",
    valores: (achado) => [achado.regra],
  },
  {
    id: "correcao",
    rotulo: "Correção",
    valores: (achado) => [ROTULO_CONSERTO[achado.conserto ?? "manual"]],
  },
  { id: "mensagem", rotulo: "Mensagem" },
];

/** Texto sobre o qual a busca da lista de apontamentos trabalha. */
export function textoDoAchado(achado: Achado): string {
  return `${achado.codigo} ${achado.reg} ${achado.regra} ${achado.mensagem} ${achado.nl} ${achado.documento ?? ""}`.toLowerCase();
}
