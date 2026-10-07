"use client";

import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

import { LinhaDeAjuste } from "@/componentes/LinhaDeAjuste";
import { Segmentado, type OpcaoSegmentada } from "@/componentes/Segmentado";
import type { RegimeDeApuracao, Sentido, SentidoDetectado } from "@/pis-cofins/auditoria";

interface SeletorSentidoProps {
  sentido: Sentido;
  /** Como a ferramenta chegou nessa ponta sozinha. */
  deteccao: SentidoDetectado;
  /** Verdadeiro quando a ponta atual veio de uma escolha do usuário. */
  manual: boolean;
  onSentido: (sentido: Sentido | null) => void;
  regime: RegimeDeApuracao;
  onRegime: (regime: RegimeDeApuracao) => void;
}

const PONTAS: OpcaoSegmentada<Sentido>[] = [
  {
    valor: "saida",
    rotulo: "Saída (vendas)",
    dica: "CST de receita, faixa 01 a 49 das tabelas 4.3.3 e 4.3.4",
    Icone: ArrowUpRight,
  },
  {
    valor: "entrada",
    rotulo: "Entrada (compras)",
    dica: "CST de aquisição, faixa 50 a 99 das mesmas tabelas",
    Icone: ArrowDownLeft,
  },
];

const REGIMES: (OpcaoSegmentada<RegimeDeApuracao> & { consequencia: string })[] = [
  {
    valor: "nao-cumulativo",
    rotulo: "Não cumulativo",
    consequencia: "Compra sem benefício recebe CST 50 — com direito a crédito",
  },
  {
    valor: "cumulativo",
    rotulo: "Cumulativo",
    consequencia: "Compra sem benefício recebe CST 70 — sem direito a crédito",
  },
];

/**
 * De que ponta da operação a planilha fala, e o que isso muda.
 *
 * A mesma tabela do SPED governa compra e venda, e o código muda: o NCM de
 * alíquota zero sai com CST 06 e entra com 73. Auditar uma planilha de compras
 * contra a coluna de saída reprova todas as linhas e oferece, como correção,
 * trocar o código certo pelo da outra ponta — erro que chega pronto, com cara
 * de conserto.
 *
 * Por isso a ponta detectada aparece SEMPRE, com o motivo à vista, e não só
 * quando a ferramenta está em dúvida: quem confere precisa poder discordar
 * antes de olhar a lista, e não depois de exportar.
 */
export function SeletorSentido({
  sentido,
  deteccao,
  manual,
  onSentido,
  regime,
  onRegime,
}: SeletorSentidoProps) {
  return (
    <>
      <LinhaDeAjuste rotulo="Ponta da operação">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Segmentado rotulo="Ponta da operação" opcoes={PONTAS} valor={sentido} onChange={onSentido} />
          <p className="min-w-0 flex-1 text-xs text-text-secondary">
            {manual ? (
              <>
                Definida por você.{" "}
                <button
                  type="button"
                  onClick={() => onSentido(null)}
                  className="rounded-sm text-accent underline underline-offset-2 hover:text-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Voltar ao que a planilha indica
                </button>
                .
              </>
            ) : (
              deteccao.motivo
            )}
          </p>
        </div>

        {!deteccao.confiante && !manual && (
          <p className="rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
            Nada na planilha disse de que ponta ela fala — nem o título da coluna de CST, nem CFOP, nem
            os códigos informados. A auditoria está lendo como <strong>saída</strong>, que é o padrão.
            Se for uma planilha de compras, troque acima antes de conferir a lista.
          </p>
        )}
      </LinhaDeAjuste>

      {sentido === "entrada" && (
        <LinhaDeAjuste rotulo="Regime de apuração">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Segmentado rotulo="Regime de apuração" opcoes={REGIMES} valor={regime} onChange={onRegime} />
            <p className="min-w-0 flex-1 text-xs text-text-secondary">
              {REGIMES.find((r) => r.valor === regime)?.consequencia}. A planilha não diz qual é o
              caso, e a diferença entre os dois códigos é crédito tomado ou crédito perdido.
            </p>
          </div>
        </LinhaDeAjuste>
      )}
    </>
  );
}
