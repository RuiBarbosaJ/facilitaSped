"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet, RefreshCw } from "lucide-react";

import { agruparRegras } from "@/lib/agrupar";

import { useRegistrosSped } from "@/hooks/useRegistrosSped";
import { useFiltroCst, CST_PADRAO, TODOS_CST } from "@/hooks/useFiltroCst";
import { useBuscaSped } from "@/hooks/useBuscaSped";
import { useSincronizacao } from "@/hooks/useSincronizacao";
import { CampoBusca } from "@/components/CampoBusca";
import { SeletorCst } from "@/components/SeletorCst";
import { BotaoTema } from "@/components/BotaoTema";
import { TabelaRegistros } from "@/components/TabelaRegistros";
import { Carregando, MensagemErro } from "@/components/EstadoConsulta";

/**
 * Quantos registros entram na tela por vez. As tabelas do SPED passam de mil
 * linhas; renderizar todas de uma vez travaria o primeiro paint sem necessidade,
 * já que a consulta útil quase sempre está nas primeiras dezenas de resultados.
 */
const PAGINA = 50;

export default function Home() {
  const { registros, carregando, erro } = useRegistrosSped();
  const atualizadoEm = useSincronizacao();
  const [cst, setCst] = useState(CST_PADRAO);
  const [consulta, setConsulta] = useState("");
  const [visiveis, setVisiveis] = useState(PAGINA);

  // Ordem do funil: CST + vigência mais recente → busca por NCM/descrição →
  // agrupamento → página. O agrupamento vem DEPOIS da busca de propósito: o
  // índice do Fuse continua indexando cada NCM separadamente.
  const { opcoes, regras } = useFiltroCst(registros, cst);
  const encontrados = useBuscaSped(regras, consulta);
  const resultados = useMemo(() => agruparRegras(encontrados), [encontrados]);

  // Trocar o CST ou a busca recomeça a paginação do topo. Fazer isso nos
  // handlers, e não num efeito, evita o render em cascata (a lista chegaria a
  // pintar a página anterior antes do reset).
  function aoBuscar(valor: string) {
    setConsulta(valor);
    setVisiveis(PAGINA);
  }
  function aoTrocarCst(valor: string) {
    setCst(valor);
    setVisiveis(PAGINA);
  }

  const exibidos = resultados.slice(0, visiveis);
  const restantes = resultados.length - exibidos.length;
  const rotuloCst = cst === TODOS_CST ? "todos os CSTs" : `CST ${cst}`;

  return (
    <div className="min-h-screen bg-surface-page text-text-primary font-sans">
      <header className="bg-surface-card border-b border-border-subtle sticky top-0 z-10 shadow-(--shadow-header)">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="shrink-0 grid place-items-center size-10 rounded-xl bg-accent text-accent-contrast">
                <FileSpreadsheet size={20} aria-hidden />
              </span>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold tracking-tight truncate">Facilita Sped</h1>
                <p className="text-xs text-text-tertiary truncate">
                  Tabelas do EFD-Contribuições · NCM, CST, alíquotas e vigência
                </p>
              </div>
            </div>
            <BotaoTema />
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-3 pb-4">
            <SeletorCst valor={cst} opcoes={opcoes} onChange={aoTrocarCst} />
            <CampoBusca valor={consulta} onChange={aoBuscar} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {carregando ? (
          <Carregando />
        ) : erro ? (
          <MensagemErro mensagem={erro} />
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-3">
              <p className="text-sm text-text-secondary" aria-live="polite">
                <strong className="font-semibold text-text-primary">
                  {resultados.length.toLocaleString("pt-BR")}
                </strong>{" "}
                {resultados.length === 1 ? "regra" : "regras"} · {rotuloCst} · vigência mais recente
                {consulta ? ` · busca por “${consulta}”` : ""}
                {restantes > 0 ? ` — exibindo as primeiras ${exibidos.length}` : ""}
              </p>
              {atualizadoEm && (
                <p className="text-xs text-text-tertiary flex items-center gap-1.5">
                  <RefreshCw size={12} aria-hidden />
                  Dados da Receita Federal atualizados em {atualizadoEm}
                </p>
              )}
            </div>

            <TabelaRegistros regras={exibidos} consulta={consulta} />

            {restantes > 0 && (
              <div className="flex justify-center mt-6">
                <button
                  type="button"
                  onClick={() => setVisiveis((atual) => atual + PAGINA)}
                  className="px-5 py-2.5 text-sm font-medium text-accent bg-surface-card border border-border-subtle rounded-xl shadow-(--shadow-card) hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
                >
                  Mostrar mais {Math.min(PAGINA, restantes)} de {restantes.toLocaleString("pt-BR")}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 mt-2 border-t border-border-subtle text-xs text-text-tertiary flex flex-col sm:flex-row justify-between gap-1">
        <span>Fonte: Receita Federal — tabelas do SPED EFD-Contribuições, sincronizadas diariamente.</span>
        <span>
          Desenvolvido por Rui Barbosa ·{" "}
          <a
            href="https://wa.me/5599991722391"
            className="hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded transition-colors"
          >
            (99) 99172-2391
          </a>
        </span>
      </footer>
    </div>
  );
}
