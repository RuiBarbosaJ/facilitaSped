"use client";

import { Wand2 } from "lucide-react";

/** Valor especial que desliga o critério de correção. */
export const SEM_CORRECAO = "nenhum";

export interface OpcaoCorrecao {
  cst: string;
  rotulo: string;
  /** O regime do SPED, por extenso: é o que a descrição lê em voz alta. */
  regime: string;
  /** Ressalva própria daquele código, quando existe. */
  nota?: string;
}

/**
 * Os critérios de correção, um por regime de benefício do SPED — nas DUAS
 * pontas da operação.
 *
 * O usuário escolhe o regime-alvo; a ferramenta grava o CST daquele regime nos
 * NCMs que a tabela do SPED enquadra nele, e o CST de "sem benefício" nos
 * demais. A linha cujo NCM tem OUTRO regime vigente aceitando o CST informado é
 * mantida como veio — sem essa exceção, escolher "alíquota zero" tributava a
 * plena todos os medicamentos monofásicos da mesma planilha.
 *
 * As duas listas descrevem o MESMO conjunto de regimes. O que muda é o código:
 * a tabela 4.3.3/4.3.4 usa 01 a 49 para descrever a receita e 50 a 99 para
 * descrever a aquisição. Um NCM de alíquota zero sai com CST 06 e entra com 73.
 */
export const OPCOES_CORRECAO_SAIDA: OpcaoCorrecao[] = [
  { cst: "06", rotulo: "CST 06 — Alíquota Zero", regime: "alíquota zero" },
  { cst: "07", rotulo: "CST 07 — Isenção", regime: "isenção" },
  { cst: "05", rotulo: "CST 05 — Substituição Tributária", regime: "substituição tributária" },
  { cst: "02", rotulo: "CST 02 — Monofásico (alíquota diferenciada)", regime: "tributação monofásica" },
  { cst: "03", rotulo: "CST 03 — Monofásico (por unidade de medida)", regime: "tributação monofásica por unidade" },
  { cst: "04", rotulo: "CST 04 — Monofásico (revenda)", regime: "revenda monofásica" },
  { cst: "08", rotulo: "CST 08 — Sem Incidência", regime: "não incidência" },
  { cst: "09", rotulo: "CST 09 — Suspensão", regime: "suspensão" },
];

export const OPCOES_CORRECAO_ENTRADA: OpcaoCorrecao[] = [
  { cst: "73", rotulo: "CST 73 — Aquisição a Alíquota Zero", regime: "alíquota zero" },
  { cst: "71", rotulo: "CST 71 — Aquisição com Isenção", regime: "isenção" },
  { cst: "75", rotulo: "CST 75 — Aquisição por Substituição Tributária", regime: "substituição tributária" },
  {
    cst: "70",
    rotulo: "CST 70 — Aquisição sem Direito a Crédito",
    regime: "tributação monofásica",
    nota: "É o código da compra de produto monofásico para revenda, onde a lei veda o crédito.",
  },
  { cst: "72", rotulo: "CST 72 — Aquisição com Suspensão", regime: "suspensão" },
  { cst: "74", rotulo: "CST 74 — Aquisição sem Incidência", regime: "não incidência" },
];

export function opcoesDoSentido(sentido: "saida" | "entrada"): OpcaoCorrecao[] {
  return sentido === "entrada" ? OPCOES_CORRECAO_ENTRADA : OPCOES_CORRECAO_SAIDA;
}

/**
 * A descrição muda com a ponta porque a consequência muda.
 *
 * Na saída, o que sobra é tributação básica. Na entrada, o que sobra é crédito
 * tomado (50) ou crédito perdido (70), conforme o regime de apuração — e essa
 * frase é a única chance do usuário de perceber que escolheu o regime errado
 * antes de a planilha voltar ao ERP.
 */
export function descreverOpcao(opcao: OpcaoCorrecao, cstTributado: string): string {
  const sobra =
    cstTributado === "01"
      ? "CST 01 (tributado)"
      : cstTributado === "50"
        ? "CST 50 (aquisição com direito a crédito)"
        : "CST 70 (aquisição sem direito a crédito)";

  return (
    `NCMs com regra de ${opcao.regime} no SPED recebem CST ${opcao.cst}. ` +
    `Os demais recebem ${sobra} — quem já tem outro benefício vigente é mantido.` +
    (opcao.nota ? ` ${opcao.nota}` : "")
  );
}

interface CriterioCorrecaoProps {
  valor: string;
  onChange: (cst: string) => void;
  /** A ponta da operação: decide a lista de códigos e o texto. */
  sentido: "saida" | "entrada";
  /** O CST que as linhas sem benefício recebem nesta ponta. */
  cstTributado: string;
  /** Quantas linhas serão afetadas pela correção, para feedback imediato. */
  totalLinhas?: number;
  totalBeneficio?: number;
  totalTributado?: number;
  /** Linhas que o critério não tocou por terem benefício próprio vigente. */
  totalMantidas?: number;
}

/** Seletor de critério de correção estilo Alterdata, com descrição contextual. */
export function CriterioCorrecao({
  valor,
  onChange,
  sentido,
  cstTributado,
  totalLinhas = 0,
  totalBeneficio = 0,
  totalTributado = 0,
  totalMantidas = 0,
}: CriterioCorrecaoProps) {
  const opcoes = opcoesDoSentido(sentido);
  const opcaoAtiva = opcoes.find((o) => o.cst === valor);
  const ativo = valor !== SEM_CORRECAO;

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        ativo
          ? "border-accent bg-accent-soft"
          : "border-border-subtle bg-surface-card"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        {/* Ícone + título */}
        <span
          className={`grid size-9 shrink-0 place-items-center rounded-lg ${
            ativo ? "bg-accent text-accent-contrast" : "bg-surface-page text-text-tertiary"
          }`}
        >
          <Wand2 size={17} aria-hidden />
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary">
            Critério de Correção
          </p>
          <p className="text-xs text-text-secondary mt-0.5">
            {ativo && opcaoAtiva
              ? descreverOpcao(opcaoAtiva, cstTributado)
              : `Escolha um critério para o sistema corrigir os CSTs de ${
                  sentido === "entrada" ? "aquisição" : "receita"
                } seguindo as tabelas do SPED.`}
          </p>

          {/* Seletor */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              id="criterio-correcao"
              value={valor}
              onChange={(e) => onChange(e.target.value)}
              aria-label="Critério de correção de CST"
              className="block min-w-0 max-w-full py-2 pl-2.5 pr-8 text-sm rounded-lg border border-border-strong bg-surface-card text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
            >
              <option value={SEM_CORRECAO}>Sem correção — exibir planilha original</option>
              {opcoes.map((o) => (
                <option key={o.cst} value={o.cst}>
                  {o.rotulo}
                </option>
              ))}
            </select>

            {ativo && valor !== SEM_CORRECAO && (
              <button
                type="button"
                onClick={() => onChange(SEM_CORRECAO)}
                className="text-xs text-text-tertiary underline underline-offset-2 hover:text-text-secondary transition-colors"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Resumo da correção */}
          {ativo && totalLinhas > 0 && (
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded bg-success-soft px-2.5 py-1 font-medium text-success">
                <span className="size-1.5 rounded-full bg-success" />
                {totalBeneficio.toLocaleString("pt-BR")} linha
                {totalBeneficio !== 1 ? "s" : ""} → CST {valor}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded bg-badge-ncm-bg px-2.5 py-1 font-medium text-badge-ncm-text">
                <span className="size-1.5 rounded-full bg-text-tertiary" />
                {totalTributado.toLocaleString("pt-BR")} linha
                {totalTributado !== 1 ? "s" : ""} → CST {cstTributado}
              </span>
              {/* O critério não rebaixa quem já tem benefício próprio vigente:
                  o medicamento monofásico não vira tributado só porque o
                  critério do dia é alíquota zero. */}
              {totalMantidas > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded bg-badge-ncm-bg px-2.5 py-1 font-medium text-badge-ncm-text">
                  <span className="size-1.5 rounded-full bg-text-tertiary" />
                  {totalMantidas.toLocaleString("pt-BR")} mantida
                  {totalMantidas !== 1 ? "s" : ""} (benefício próprio)
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
