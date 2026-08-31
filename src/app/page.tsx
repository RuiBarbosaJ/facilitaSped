"use client";

import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import { agruparRegras } from "@/lib/agrupar";
import { useRegistrosSped } from "@/hooks/useRegistrosSped";
import { useFiltroCst, CST_PADRAO, TODOS_CST } from "@/hooks/useFiltroCst";
import { useBuscaSped } from "@/hooks/useBuscaSped";
import { useSincronizacao } from "@/hooks/useSincronizacao";
import { Cabecalho } from "@/components/Cabecalho";
import { CampoBusca } from "@/components/CampoBusca";
import { SeletorCst } from "@/components/SeletorCst";
import { TabelaRegistros } from "@/components/TabelaRegistros";
import { Carregando, MensagemErro } from "@/components/EstadoConsulta";
import { Rodape } from "@/components/Rodape";

/**
 * Quantos registros entram na tela por vez. As tabelas do SPED passam de mil
 * linhas; renderizar todas de uma vez travaria o primeiro paint sem necessidade,
 * já que a consulta útil quase sempre está nas primeiras dezenas de resultados.
 */
const PAGINA = 50;

export default function Home() {
  const { registros, carregando, erro } = useRegistrosSped();
  const { data: atualizadoEm, versoes } = useSincronizacao();
  const [cst, setCst] = useState(CST_PADRAO);
  const [consulta, setConsulta] = useState("");
  const [visiveis, setVisiveis] = useState(PAGINA);

  // Ordem do funil: CST + vigência mais recente → busca por NCM/descrição →
  // agrupamento → página. O agrupamento vem DEPOIS da busca de propósito: o
  // índice do Fuse continua indexando cada NCM separadamente.
  const [filtrosColuna, setFiltrosColuna] = useState<Record<string, string[]>>({});
  const { opcoes, regras } = useFiltroCst(registros, cst);
  const encontrados = useBuscaSped(regras, consulta);
  const resultadosAgrupados = useMemo(() => agruparRegras(encontrados), [encontrados]);

  // Função para aplicar os filtros de coluna na página de Consulta
  const resultados = useMemo(() => {
    if (Object.keys(filtrosColuna).length === 0) return resultadosAgrupados;
    return resultadosAgrupados.filter((regra) => {
      for (const [coluna, selecionados] of Object.entries(filtrosColuna)) {
        let valor = "";
        switch (coluna) {
          case "NCM":
            valor = regra.ncms.length > 0 ? regra.ncms.slice(0, 3).join(", ") + (regra.ncms.length > 3 ? "..." : "") : "";
            break;
          case "Descrição":
            valor = regra.descricao || "";
            break;
          case "CST":
            valor = regra.cst || "";
            break;
          case "Alíquota":
            valor = regra.aliquota || "";
            break;
          case "Nat. receita":
            valor = regra.natureza_receita || "";
            break;
          case "Vigência":
            valor = `${regra.data_inicio || ""} a ${regra.data_fim || ""}`;
            break;
        }
        if (!selecionados.includes(valor)) {
          return false;
        }
      }
      return true;
    });
  }, [resultadosAgrupados, filtrosColuna]);

  // Descobre a versão da tabela sendo exibida agora
  const tabelaAtual = resultados[0]?.tabela;
  const versaoAtual = tabelaAtual && versoes ? versoes[tabelaAtual] : null;

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
    setFiltrosColuna({});
  }

  function aoFiltrarColuna(coluna: string, valores: string[] | null) {
    setFiltrosColuna((atuais) => {
      const novos = { ...atuais };
      if (valores === null || valores.length === 0) {
        delete novos[coluna];
      } else {
        novos[coluna] = valores;
      }
      return novos;
    });
    setVisiveis(PAGINA);
  }

  const exibidos = resultados.slice(0, visiveis);
  const restantes = resultados.length - exibidos.length;
  const rotuloCst = cst === TODOS_CST ? "todos os CSTs" : `CST ${cst}`;

  return (
    <div className="min-h-screen bg-surface-page text-text-primary font-sans">
      <Cabecalho>
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <SeletorCst valor={cst} opcoes={opcoes} onChange={aoTrocarCst} />
          <CampoBusca valor={consulta} onChange={aoBuscar} />
        </div>
      </Cabecalho>

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
                  {versaoAtual && tabelaAtual && <> <span className="mx-1">•</span> Tabela {tabelaAtual} (Versão {versaoAtual})</>}
                </p>
              )}
            </div>

            <TabelaRegistros 
              regras={exibidos} 
              consulta={consulta} 
              filtrosColuna={filtrosColuna}
              onFiltrarColuna={aoFiltrarColuna}
              todasAsRegras={resultadosAgrupados}
            />

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

      <Rodape />
    </div>
  );
}
