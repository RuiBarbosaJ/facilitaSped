"use client";

import { useDeferredValue, useMemo } from "react";
import { RefreshCw } from "lucide-react";

import { agruparRegras, type RegraAgrupada } from "@/consulta/agrupar";
import { digitosDoNcm } from "@/consulta/buscar";
import { COLUNAS_CONSULTA, colunasVisiveis } from "@/consulta/colunas";
import { formatarNcm } from "@/comum/ncm";
import { useTabelasReceita } from "@/ganchos/useTabelasReceita";
import { useFiltroCst, CST_PADRAO, TODOS_CST } from "@/consulta/ui/useFiltroCst";
import { useBuscaRegras } from "@/consulta/ui/useBuscaRegras";
import { useSincronizacao } from "@/ganchos/useSincronizacao";
import { useEstadoMemoria } from "@/ganchos/useEstadoMemoria";
import { useFiltrosColuna } from "@/ganchos/useFiltrosColuna";
import { Cabecalho } from "@/componentes/Cabecalho";
import { CampoBusca } from "@/componentes/CampoBusca";
import { BarraFiltros } from "@/componentes/BarraFiltros";
import { Rodape } from "@/componentes/Rodape";
import { TituloDaTela } from "@/componentes/TituloDaTela";
import { BotoesExportar } from "@/consulta/ui/BotoesExportar";
import { SeletorCst, nomeDoCst } from "@/consulta/ui/SeletorCst";
import { TabelaRegistros } from "@/consulta/ui/TabelaRegistros";
import {
  Carregando,
  EsqueletoSeletor,
  MensagemErro,
  SemResultados,
  type OutroRecorte,
} from "@/consulta/ui/EstadoConsulta";

const PAGINA = 50;

/** "4.3.9" antes de "4.3.10": a ordem do portal, não a do texto. */
const COLLATOR = new Intl.Collator("pt-BR", { numeric: true });

/** Quantas regras a busca encontrou em cada CST. */
function contarPorCst(regras: RegraAgrupada[]): Map<string, number> {
  const contagem = new Map<string, number>();
  for (const regra of regras) contagem.set(regra.cst, (contagem.get(regra.cst) ?? 0) + 1);
  return contagem;
}

/**
 * CONTRA O QUÊ se está conferindo: "Tabela 4.3.13, versão 1.36C".
 *
 * Quem audita escrituração precisa saber a versão da tabela antes de olhar o
 * primeiro dado. A tela antiga mostrava a versão da tabela da PRIMEIRA linha —
 * no CST 02, que junta a 4.3.10 e a 4.3.17, metade das regras ficava sem a sua.
 */
function descreverTabelas(tabelas: string[], versoes: Record<string, string> | null): string {
  if (tabelas.length === 0) return "";
  if (tabelas.length === 1) {
    const [tabela] = tabelas;
    return versoes?.[tabela] ? `Tabela ${tabela}, versão ${versoes[tabela]}` : `Tabela ${tabela}`;
  }
  const cada = tabelas.map((tabela) => (versoes?.[tabela] ? `${tabela} (versão ${versoes[tabela]})` : tabela));
  return `Tabelas ${cada.slice(0, -1).join(", ")} e ${cada[cada.length - 1]}`;
}

/**
 * Como o resumo e o estado vazio chamam o que foi buscado: o código digitado
 * vira NCM com pontos ("o NCM 1006.40.00"), que é como o contador o confere;
 * o resto vai entre aspas, como foi escrito.
 */
function descreverBusca(termo: string): string {
  const digitos = digitosDoNcm(termo);
  return digitos && digitos.length >= 4 ? `o NCM ${formatarNcm(digitos)}` : `“${termo}”`;
}

export default function Home() {
  const { registros, carregando, erro } = useTabelasReceita();
  const { data: conferidoEm, alteradoEm, versoes } = useSincronizacao();

  const [cst, setCst] = useEstadoMemoria("consulta_cst", CST_PADRAO);
  const [consulta, setConsulta] = useEstadoMemoria("consulta_texto", "");
  const [visiveis, setVisiveis] = useEstadoMemoria("consulta_visiveis", PAGINA);

  // A lista: o caminho de sempre — recorte por CST, vigência mais recente,
  // busca e agrupamento.
  const { opcoes, regras } = useFiltroCst(registros, cst);
  const encontrados = useBuscaRegras(regras, consulta);
  const doRecorte = useMemo(() => agruparRegras(encontrados), [encontrados]);

  // As contagens ao lado de cada CST: a mesma busca, sobre todas as tabelas.
  // Só conta; o que a tabela mostra continua vindo do caminho acima.
  const { regras: todasAsRegras } = useFiltroCst(registros, TODOS_CST);
  const encontradosEmTodas = useBuscaRegras(todasAsRegras, consulta);
  const emTodas = useMemo(() => agruparRegras(encontradosEmTodas), [encontradosEmTodas]);
  const contagem = useMemo(() => contarPorCst(emTodas), [emTodas]);

  const todas = cst === TODOS_CST;
  const temAliquota = doRecorte.some((regra) => regra.aliquota);
  const colunas = useMemo(() => colunasVisiveis(todas, temAliquota), [todas, temAliquota]);

  const {
    filtros,
    itensFiltrados: resultados,
    opcoesDe,
    definir: definirFiltro,
    limpar: limparFiltros,
  } = useFiltrosColuna(doRecorte, colunas, "consulta_filtrosColuna", () => setVisiveis(PAGINA));

  // O mesmo termo adiado que filtrou a lista: o destaque nunca marca outra coisa.
  const termo = useDeferredValue(consulta).trim();

  const opcaoAtual = opcoes.find((opcao) => opcao.cst === cst);
  const titulo = todas ? "Todas as tabelas" : nomeDoCst(cst, opcaoAtual);
  const tabelas = useMemo(
    () =>
      Array.from(new Set(regras.map((regra) => regra.tabela).filter((tabela): tabela is string => !!tabela))).sort(
        COLLATOR.compare,
      ),
    [regras],
  );
  const contexto = todas
    ? `Todos os CSTs${tabelas.length ? ` · ${tabelas.length} tabelas do SPED` : ""}`
    : [`CST ${cst}`, descreverTabelas(tabelas, versoes)].filter(Boolean).join(" · ");

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

  // Onde mais a mesma busca encontra regras, quando aqui não encontra nada.
  const outrosRecortes: OutroRecorte[] =
    termo && doRecorte.length === 0
      ? [
          ...opcoes
            .filter((opcao) => opcao.cst !== cst && (contagem.get(opcao.cst) ?? 0) > 0)
            .map((opcao) => ({
              cst: opcao.cst,
              nome: nomeDoCst(opcao.cst, opcao),
              total: contagem.get(opcao.cst) ?? 0,
            })),
          ...(!todas && emTodas.length > 0
            ? [{ cst: TODOS_CST, nome: "Todas as tabelas", total: emTodas.length }]
            : []),
        ]
      : [];

  return (
    <div className="flex min-h-screen flex-col bg-surface-page font-sans text-text-primary">
      <Cabecalho>
        <CampoBusca
          valor={consulta}
          onChange={aoBuscar}
          atalhoGlobal
          placeholder="NCM (ex.: 1006.40.00) ou descrição"
          className="w-full"
        />
      </Cabecalho>

      <main
        id="conteudo-principal"
        className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[14.5rem_minmax(0,1fr)] lg:items-start lg:gap-8 lg:px-8"
      >
        <aside className="mb-5 lg:sticky lg:top-[calc(var(--altura-cabecalho)+1.5rem)] lg:mb-0">
          {carregando ? (
            <>
              <p className="mb-2 hidden px-2.5 text-xs font-medium text-text-tertiary lg:block">CST</p>
              <EsqueletoSeletor />
            </>
          ) : (
            !erro && (
              <SeletorCst
                valor={cst}
                opcoes={opcoes}
                contagem={contagem}
                total={emTodas.length}
                onChange={aoTrocarCst}
              />
            )
          )}
        </aside>

        <section aria-labelledby="titulo-recorte" className="flex min-w-0 flex-col gap-4">
          <TituloDaTela
            id="titulo-recorte"
            titulo={titulo}
            versao={contexto}
            acoes={!carregando && !erro && <BotoesExportar regras={resultados} cst={cst} />}
          />

          {carregando ? (
            <Carregando />
          ) : erro ? (
            <MensagemErro mensagem={erro} />
          ) : (
            <>
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-sm text-text-secondary" aria-live="polite">
                    <strong className="font-semibold text-text-primary">
                      {resultados.length.toLocaleString("pt-BR")}
                    </strong>{" "}
                    {filtrosAtivos.length > 0 && `de ${doRecorte.length.toLocaleString("pt-BR")} `}
                    {resultados.length === 1 ? "regra" : "regras"}
                    {termo && ` para ${descreverBusca(termo)}`} · vigência mais recente
                  </p>
                  {conferidoEm && (
                    <p
                      className="flex items-center gap-1.5 text-xs text-text-tertiary"
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
                      Conferido com a Receita em {conferidoEm}
                    </p>
                  )}
                </div>

                <BarraFiltros filtros={filtrosAtivos} onLimparTudo={limparFiltros} />
              </div>

              {termo && doRecorte.length === 0 ? (
                <SemResultados
                  busca={descreverBusca(termo)}
                  onde={todas ? "em nenhuma tabela" : `no CST ${cst}`}
                  outros={outrosRecortes}
                  ehCodigo={digitosDoNcm(termo) !== null}
                  onTrocar={aoTrocarCst}
                />
              ) : (
                <TabelaRegistros
                  regras={exibidos}
                  colunas={colunas}
                  filtros={filtros}
                  opcoesDe={opcoesDe}
                  onFiltrar={definirFiltro}
                  termo={termo}
                  rodape={
                    restantes > 0 && (
                      <div className="flex justify-center border-t border-border-subtle px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => setVisiveis((atual) => atual + PAGINA)}
                          className="rounded-md px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          Mostrar mais {Math.min(PAGINA, restantes)} de {restantes.toLocaleString("pt-BR")}
                        </button>
                      </div>
                    )
                  }
                />
              )}
            </>
          )}
        </section>
      </main>

      <Rodape />
    </div>
  );
}
