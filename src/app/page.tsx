"use client";

import { useMemo } from "react";
import { RefreshCw } from "lucide-react";

import { agruparRegras } from "@/consulta/agrupar";
import { useTabelasReceita } from "@/ganchos/useTabelasReceita";
import {
  useFiltroCst,
  CST_PADRAO,
  TODOS_CST,
} from "@/consulta/ui/useFiltroCst";
import { useBuscaRegras } from "@/consulta/ui/useBuscaRegras";
import { useSincronizacao } from "@/ganchos/useSincronizacao";
import { useEstadoMemoria } from "@/ganchos/useEstadoMemoria";
import { useFiltrosColuna } from "@/ganchos/useFiltrosColuna";
import { COLUNAS_CONSULTA } from "@/consulta/colunas";
import { Cabecalho } from "@/componentes/Cabecalho";
import { TituloDaTela } from "@/componentes/TituloDaTela";
import { BotoesExportar } from "@/consulta/ui/BotoesExportar";
import { ControlesConsulta } from "@/consulta/ui/ControlesConsulta";
import { TabelaRegistros } from "@/consulta/ui/TabelaRegistros";
import { Carregando, MensagemErro } from "@/consulta/ui/EstadoConsulta";
import { Rodape } from "@/componentes/Rodape";
import { BarraFiltros } from "@/componentes/BarraFiltros";

const PAGINA = 50;

export default function Home() {
  const { registros, carregando, erro } = useTabelasReceita();
  const { data: atualizadoEm, alteradoEm, versoes } = useSincronizacao();

  const [cst, setCst] = useEstadoMemoria("consulta_cst", CST_PADRAO);
  const [consulta, setConsulta] = useEstadoMemoria("consulta_texto", "");
  const [visiveis, setVisiveis] = useEstadoMemoria("consulta_visiveis", PAGINA);

  const { opcoes, regras } = useFiltroCst(registros, cst);
  const encontrados = useBuscaRegras(regras, consulta);
  const resultadosAgrupados = useMemo(
    () => agruparRegras(encontrados),
    [encontrados],
  );

  const {
    filtros,
    itensFiltrados: resultados,
    opcoesDe,
    definir: definirFiltro,
    limpar: limparFiltros,
  } = useFiltrosColuna(
    resultadosAgrupados,
    COLUNAS_CONSULTA,
    "consulta_filtrosColuna",
    () => setVisiveis(PAGINA),
  );

  // Descobre a versão da tabela sendo exibida agora
  const tabelaAtual = resultados[0]?.tabela;
  const versaoAtual = tabelaAtual && versoes ? versoes[tabelaAtual] : null;

  function aoBuscar(valor: string) {
    setConsulta(valor);
    setVisiveis(PAGINA);
  }

  function aoTrocarCst(valor: string) {
    setCst(valor);
    setVisiveis(PAGINA);
  }

  const filtrosAtivos = Object.entries(filtros).map(([id, valores]) => ({
    id,
    rotulo: COLUNAS_CONSULTA.find((c) => c.id === id)?.rotulo ?? id,
    valores,
    onRemover: () => definirFiltro(id, null),
  }));

  const exibidos = resultados.slice(0, visiveis);
  const restantes = resultados.length - exibidos.length;
  const rotuloCst = cst === TODOS_CST ? "todos os CSTs" : `CST ${cst}`;

  return (
    <div className="min-h-screen flex flex-col bg-surface-page text-text-primary font-sans">
      <Cabecalho>
        <ControlesConsulta
          cst={cst}
          opcoesCst={opcoes}
          onCstChange={aoTrocarCst}
          busca={consulta}
          onBuscaChange={aoBuscar}
        />
      </Cabecalho>

      <main
        id="conteudo-principal"
        className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <TituloDaTela
            titulo="Tabelas oficiais — consulta de NCM, CST e alíquota"
            versao={
              <>
                EFD-Contribuições
                {tabelaAtual && versaoAtual && ` · Tabela ${tabelaAtual} v${versaoAtual}`}
              </>
            }
          />
          {!carregando && !erro && <BotoesExportar regras={resultados} cst={cst} />}
        </div>

        {carregando ? (
          <Carregando />
        ) : erro ? (
          <MensagemErro mensagem={erro} />
        ) : (
          <>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-sm text-text-secondary" aria-live="polite">
                  <strong className="font-semibold text-text-primary">
                    {resultados.length.toLocaleString("pt-BR")}
                  </strong>{" "}
                  {resultados.length === 1 ? "regra" : "regras"} · {rotuloCst} ·
                  vigência mais recente
                  {consulta ? ` · busca por “${consulta}”` : ""}
                  {restantes > 0
                    ? ` — exibindo as primeiras ${exibidos.length}`
                    : ""}
                </p>
                {atualizadoEm && (
                  <p
                    className="text-xs text-text-tertiary flex items-center gap-1.5"
                    // A data é a da conferência diária com o portal do SPED; a
                    // da última mudança de conteúdo fica aqui, para quem
                    // precisa saber quando a Receita mexeu de fato.
                    title={
                      alteradoEm
                        ? `Última alteração publicada pela Receita: ${alteradoEm}. Conferido automaticamente todos os dias.`
                        : undefined
                    }
                  >
                    <RefreshCw size={12} aria-hidden />
                    Dados da Receita Federal atualizados em {atualizadoEm}
                  </p>
                )}
              </div>

              <BarraFiltros
                filtros={filtrosAtivos}
                onLimparTudo={limparFiltros}
              />
            </div>

            <TabelaRegistros
              regras={exibidos}
              colunas={COLUNAS_CONSULTA}
              filtros={filtros}
              opcoesDe={opcoesDe}
              onFiltrar={definirFiltro}
              consulta={consulta}
            />

            {restantes > 0 && (
              <div className="flex justify-center mt-2">
                <button
                  type="button"
                  onClick={() => setVisiveis((atual) => atual + PAGINA)}
                  className="px-5 py-2.5 text-sm font-medium text-accent bg-surface-card border border-border-subtle rounded-xl shadow-(--shadow-card) hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
                >
                  Mostrar mais {Math.min(PAGINA, restantes)} de{" "}
                  {restantes.toLocaleString("pt-BR")}
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
