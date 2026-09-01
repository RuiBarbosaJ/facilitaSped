"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, FileSpreadsheet, Loader2, RotateCcw, ShieldCheck } from "lucide-react";

import { Cabecalho } from "@/components/Cabecalho";
import { CampoBusca } from "@/components/CampoBusca";
import { Rodape } from "@/components/Rodape";
import { BarraFiltros } from "@/components/BarraFiltros";
import { PainelInstrucoes } from "@/components/auditoria/PainelInstrucoes";
import { ZonaUpload } from "@/components/auditoria/ZonaUpload";
import { ResumoAuditoria, type FiltroAuditoria } from "@/components/auditoria/ResumoAuditoria";
import { TabelaAuditoria } from "@/components/auditoria/TabelaAuditoria";
import { CriterioCorrecao, SEM_CORRECAO } from "@/components/auditoria/CriterioCorrecao";
import { useRegistrosSped } from "@/hooks/useRegistrosSped";
import { useTabelaNcm } from "@/hooks/useTabelaNcm";
import { useEstadoMemoria } from "@/hooks/useEstadoMemoria";
import { useFiltrosColuna } from "@/hooks/useFiltrosColuna";
import { useSincronizacao } from "@/hooks/useSincronizacao";
import { COLUNAS_AUDITORIA } from "@/lib/colunasAuditoria";
import {
  ERRO_LAYOUT,
  auditarLinha,
  corrigirLinhas,
  extrairLinhas,
  indexarBase,
  indexarNcm,
  indexarRegrasSemNcm,
  localizarCabecalho,
  resumir,
  type LinhaAuditada,
} from "@/lib/auditoria";
import { TAMANHO_MAXIMO, baixarArquivo, descreverErroDeLeitura, gerarXlsx, lerAbas, tipoDeArquivo } from "@/lib/planilha";

/** Linhas por página na tabela de resultados. */
const PAGINA = 100;

interface Resultado {
  arquivo: string;
  aba: string;
  linhas: LinhaAuditada[];
  colunasOriginais: string[];
  /** Índices das colunas CST PIS e CST COFINS na planilha original (se existirem). */
  indiceCstPis?: number;
  indiceCstCofins?: number;
  indiceNatureza?: number;
}

export default function Auditoria() {
  const { registros, carregando: carregandoSped, erro: erroSped } = useRegistrosSped();
  const ncm = useTabelaNcm();
  // Quem vai exportar uma planilha corrigida precisa saber de quando é a base
  // do SPED que sustentou a correção.
  const { data: sincronizadoEm, alteradoEm, versoes: versoesSped } = useSincronizacao();

  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useEstadoMemoria<string | null>("auditoria_erro", null);
  const [resultado, setResultado] = useEstadoMemoria<Resultado | null>("auditoria_resultado", null);
  const [filtro, setFiltro] = useEstadoMemoria<FiltroAuditoria>("auditoria_filtro", "todos");
  const [visiveis, setVisiveis] = useEstadoMemoria("auditoria_visiveis", PAGINA);
  const [exportando, setExportando] = useState(false);
  const [consulta, setConsulta] = useEstadoMemoria("auditoria_consulta", "");
  const [cfopFiltro, setCfopFiltro] = useEstadoMemoria("auditoria_cfopFiltro", "todos");
  /** CST selecionado como critério de correção. SEM_CORRECAO = nenhuma correção ativa. */
  const [criterioCorrecao, setCriterioCorrecao] = useEstadoMemoria("auditoria_criterio", SEM_CORRECAO);

  const zonaRef = useRef<HTMLDivElement>(null);
  const cartaoRef = useRef<HTMLDivElement>(null);

  const indiceBase = useMemo(() => indexarBase(registros), [registros]);
  const indiceSemNcm = useMemo(() => indexarRegrasSemNcm(registros), [registros]);
  const indiceNcm = useMemo(() => (ncm.tabela ? indexarNcm(ncm.tabela.codigos) : null), [ncm.tabela]);

  const pronto = !carregandoSped && !erroSped && !ncm.carregando;

  useEffect(() => {
    if (resultado) cartaoRef.current?.focus();
  }, [resultado]);

  const auditar = useCallback(
    async (arquivo: File) => {
      setErro(null);
      setResultado(null);
      setFiltro("todos");
      setVisiveis(PAGINA);
      setConsulta("");
      setCfopFiltro("todos");
      setCriterioCorrecao(SEM_CORRECAO);

      if (arquivo.size === 0) {
        setErro("O arquivo está vazio (0 bytes).");
        return;
      }
      if (arquivo.size > TAMANHO_MAXIMO) {
        setErro(`O arquivo tem ${(arquivo.size / 1024 / 1024).toFixed(1)} MB; o limite é 25 MB.`);
        return;
      }

      setProcessando(true);
      try {
        const buffer = await arquivo.arrayBuffer();
        if (tipoDeArquivo(buffer) === "desconhecido") {
          setErro(
            `"${arquivo.name}" não é uma planilha do Excel de verdade — parece texto ou CSV com a extensão trocada. Exporte novamente em .xls ou .xlsx.`
          );
          return;
        }

        const abas = await lerAbas(buffer);
        const encontrada = abas
          .map((aba) => ({ aba, cabecalho: localizarCabecalho(aba.linhas) }))
          .find((x) => x.cabecalho !== null);
        if (!encontrada || !encontrada.cabecalho) {
          setErro(abas.length > 1 ? `${ERRO_LAYOUT} (Nenhuma das ${abas.length} abas tem esse cabeçalho.)` : ERRO_LAYOUT);
          return;
        }

        const contexto = { base: indiceBase, semNcm: indiceSemNcm, ncm: indiceNcm, hoje: new Date() };
        const linhas = extrairLinhas(encontrada.aba.linhas, encontrada.cabecalho).map((l) => auditarLinha(l, contexto));
        if (linhas.length === 0) {
          setErro("A planilha tem o cabeçalho certo, mas nenhuma linha de produto abaixo dele.");
          return;
        }
        const cabecalhoOriginal = (encontrada.aba.linhas[encontrada.cabecalho.indice] ?? []).map((c, i) =>
          String(c ?? "").trim() || `Coluna ${i + 1}`
        );

        // Guarda os índices das colunas para o export corrigido
        const { cstPis: indiceCstPis, cstCofins: indiceCstCofins, natureza: indiceNatureza } = encontrada.cabecalho.colunas;

        setResultado({
          arquivo: arquivo.name,
          aba: encontrada.aba.nome,
          linhas,
          colunasOriginais: cabecalhoOriginal,
          indiceCstPis,
          indiceCstCofins,
          indiceNatureza,
        });
      } catch (excecao) {
        setErro(descreverErroDeLeitura(excecao));
      } finally {
        setProcessando(false);
      }
    },
    [indiceBase, indiceSemNcm, indiceNcm, setErro, setResultado, setFiltro, setVisiveis, setConsulta, setCfopFiltro, setCriterioCorrecao]
  );

  /** Linhas com a correção aplicada (quando critério ativo) ou originais. */
  const linhasComCorrecao = useMemo(() => {
    if (!resultado) return [];
    if (criterioCorrecao === SEM_CORRECAO) return resultado.linhas;
    return corrigirLinhas(resultado.linhas, criterioCorrecao, "01");
  }, [resultado, criterioCorrecao]);

  const correcaoAtiva = criterioCorrecao !== SEM_CORRECAO;

  /**
   * As linhas que divergiam do SPED na planilha como ela chegou, pelo número da
   * linha. `corrigirLinhas` apaga o destaque de tudo que corrige, então depois
   * dela não há mais como saber o que estava errado — e é justamente isso que o
   * contador precisa conferir antes de exportar.
   */
  const linhasQueDivergiam = useMemo(
    () => new Set((resultado?.linhas ?? []).filter((l) => l.destaque === "amarelo").map((l) => l.linha)),
    [resultado]
  );

  /**
   * Resumo contado sobre as linhas já corrigidas — é o que a tabela mostra.
   *
   * Só que "Divergências" e "Coerente" são cartões de CONFERÊNCIA: eles
   * respondem "o que veio errado no arquivo?". Sobre as linhas corrigidas os
   * dois mentem juntos (0 divergências, tudo coerente), porque a correção já
   * limpou o destaque de todas elas. Com o critério ligado, então, esses dois
   * passam a contar a planilha original — e continuam somando o total.
   */
  const resumo = useMemo(() => {
    if (linhasComCorrecao.length === 0) return null;
    const contado = resumir(linhasComCorrecao);
    if (!correcaoAtiva) return contado;
    return {
      ...contado,
      divergencias: linhasQueDivergiam.size,
      coerente: linhasComCorrecao.filter(
        (l) => !linhasQueDivergiam.has(l.linha) && l.situacao !== "invalido"
      ).length,
    };
  }, [linhasComCorrecao, correcaoAtiva, linhasQueDivergiam]);

  const filtradas = useMemo(() => {
    switch (filtro) {
      case "beneficio":
      case "possivel":
      case "tributado":
      case "invalido":
        return linhasComCorrecao.filter((l) => l.situacao === filtro);
      case "divergencias":
        // Com o critério ligado, as linhas listadas são as que divergiam —
        // exibidas já corrigidas, que é a lista do que a correção mexeu.
        return linhasComCorrecao.filter((l) =>
          correcaoAtiva ? linhasQueDivergiam.has(l.linha) : l.destaque === "amarelo"
        );
      case "coerente":
        return linhasComCorrecao.filter(
          (l) =>
            l.situacao !== "invalido" &&
            (correcaoAtiva ? !linhasQueDivergiam.has(l.linha) : l.destaque === "nenhum")
        );
      default:
        return linhasComCorrecao;
    }
  }, [linhasComCorrecao, filtro, correcaoAtiva, linhasQueDivergiam]);

  const filtradasEBusca = useMemo(() => {
    return filtradas.filter((l) => {
      if (consulta) {
        const termo = consulta.toLowerCase();
        const textoLinha = `${l.nome} ${l.ncm} ${l.classificacaoOriginal} ${l.descricaoNcm || ""} ${l.observacoes.join(" ")}`.toLowerCase();
        if (!textoLinha.includes(termo)) return false;
      }

      if (cfopFiltro !== "todos") {
        if (l.cfop !== cfopFiltro) return false;
      }

      return true;
    });
  }, [filtradas, consulta, cfopFiltro]);

  const {
    filtros,
    itensFiltrados: exibiveis,
    opcoesDe,
    definir: definirFiltroColuna,
    limpar: limparFiltrosColuna,
  } = useFiltrosColuna(
    filtradasEBusca,
    COLUNAS_AUDITORIA,
    "auditoria_filtrosColuna",
    () => setVisiveis(PAGINA)
  );

  const exibidas = exibiveis.slice(0, visiveis);
  const restantes = exibiveis.length - exibidas.length;

  // Resumo da correção: contado sobre as próprias linhas corrigidas. Repetir aqui
  // o critério de corrigirLinhas já fez os números divergirem da tabela uma vez.
  const { totalBeneficio, totalTributado, totalMantidas } = useMemo(() => {
    if (criterioCorrecao === SEM_CORRECAO) return { totalBeneficio: 0, totalTributado: 0, totalMantidas: 0 };
    const beneficio = linhasComCorrecao.filter((l) => l.cstCorrigido === criterioCorrecao).length;
    const tributado = linhasComCorrecao.filter((l) => l.cstCorrigido === "01").length;
    // Sem cstCorrigido e com NCM válido: o critério deixou a linha intacta
    // porque ela já está amparada por outro regime vigente do próprio NCM.
    const mantidas = linhasComCorrecao.filter(
      (l) => l.cstCorrigido === undefined && l.situacao !== "invalido"
    ).length;
    return { totalBeneficio: beneficio, totalTributado: tributado, totalMantidas: mantidas };
  }, [criterioCorrecao, linhasComCorrecao]);

  function aoFiltrar(novo: FiltroAuditoria) {
    setFiltro(novo);
    setVisiveis(PAGINA);
  }

  function aoBuscar(valor: string) {
    setConsulta(valor);
    setVisiveis(PAGINA);
  }

  const opcoesCfop = useMemo(() => {
    if (!resultado) return [];
    const cfops = new Set<string>();
    resultado.linhas.forEach((l) => {
      if (l.cfop) cfops.add(l.cfop);
    });
    return Array.from(cfops).sort();
  }, [resultado]);

  const filtrosAtivos = Object.entries(filtros).map(([id, valores]) => ({
    id,
    rotulo: COLUNAS_AUDITORIA.find((c) => c.id === id)?.rotulo ?? id,
    valores,
    onRemover: () => definirFiltroColuna(id, null),
  }));

  async function exportar() {
    if (!resultado) return;
    setExportando(true);
    try {
      const colunasCliente = resultado.colunasOriginais;
      const correcaoAtiva = criterioCorrecao !== SEM_CORRECAO;
      const linhasParaExport = correcaoAtiva ? corrigirLinhas(resultado.linhas, criterioCorrecao, "01") : resultado.linhas;

      const COLUNAS_AUDITORIA_EXPORT = [
        "Linha",
        "NCM (8 dígitos)",
        "Situação",
        "Benefício SPED",
        "Tabela SPED",
        "CST sugerido",
        "Natureza sugerida",
        "Regra do SPED",
        "Vigência da regra",
        "Descrição NCM (Siscomex)",
        "Observações",
      ];

      const cabecalho = [...colunasCliente, ...COLUNAS_AUDITORIA_EXPORT];
      const linhas = linhasParaExport.map((l) => [
        ...colunasCliente.map((_, i) => {
          let celula = l.original[i];
          // Substitui os valores das colunas CST e Natureza na planilha original
          // quando a correção está ativa e a linha tem CST corrigido definido.
          if (
            correcaoAtiva &&
            l.cstCorrigido !== undefined &&
            l.cstCorrigido !== ""
          ) {
            if (i === resultado.indiceCstPis || i === resultado.indiceCstCofins) {
              celula = l.cstCorrigido;
            } else if (i === resultado.indiceNatureza && l.naturezaCorrigida !== undefined) {
              celula = l.naturezaCorrigida;
            }
          }
          return celula === undefined || celula === null ? "" : celula;
        }),
        l.linha,
        l.ncm,
        l.rotulo,
        l.regra?.rotulo ?? "",
        l.regra?.tabela ?? "",
        correcaoAtiva && l.cstCorrigido ? l.cstCorrigido : (l.regra?.cstsAceitos.join(" ou ") ?? ""),
        // Com a correção ligada vale a natureza aplicada — é ela que foi gravada
        // na coluna do cliente, e quando a planilha não tem coluna de natureza
        // esta é a única via de a correção chegar ao ERP.
        correcaoAtiva && l.naturezaCorrigida !== undefined && l.cstCorrigido
          ? l.naturezaCorrigida
          : (l.regra?.naturezas.join(" ou ") ?? ""),
        l.regra?.descricao ?? "",
        l.regra ? `${l.regra.inicio ?? ""}${l.regra.fim ? ` a ${l.regra.fim}` : l.regra.inicio ? " (vigente)" : ""}` : "",
        l.descricaoNcm ?? "",
        l.observacoes.join(" "),
      ]);
      const bytes = await gerarXlsx(
        [cabecalho, ...linhas],
        "Auditoria",
        [...colunasCliente.map(() => 22), 7, 14, 22, 22, 10, 12, 14, 60, 22, 50, 70]
      );
      const base = resultado.arquivo.replace(/\.(xlsx?|csv)$/i, "");
      const sufixo = correcaoAtiva ? `-cst${criterioCorrecao}` : "";
      baixarArquivo(bytes, `auditoria${sufixo}-${base}.xlsx`);
    } finally {
      setExportando(false);
    }
  }

  function reiniciar() {
    setResultado(null);
    setErro(null);
    setFiltro("todos");
    setVisiveis(PAGINA);
    setCriterioCorrecao(SEM_CORRECAO);
    setConsulta("");
    setCfopFiltro("todos");
    // Os menus de coluna guardam o TEXTO do valor e sobrevivem à troca de
    // arquivo: um NCM presente nas duas planilhas fazia a auditoria nova abrir
    // filtrada pela anterior — cartão dizendo 519 linhas, tabela mostrando 1.
    // A zona de upload só aparece sem resultado, então toda planilha nova
    // passa por aqui.
    limparFiltrosColuna();
    requestAnimationFrame(() => zonaRef.current?.focus());
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-page text-text-primary font-sans">
      <Cabecalho />

      <main id="conteudo-principal" className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">Auditoria de planilhas</p>
          <h1 className="text-2xl font-semibold tracking-tight">Confira o NCM do Alterdata contra o SPED</h1>
          <p className="max-w-3xl text-sm text-text-secondary">
            Solte o relatório de produtos e a auditoria cruza cada classificação com a nomenclatura NCM
            vigente e com as tabelas 4.3.x do EFD-Contribuições, apontando CST e natureza da receita
            divergentes. Tudo acontece no seu navegador.
          </p>
        </div>

        {erroSped && (
          <Banner tom="erro" titulo="A base do SPED não carregou.">
            {erroSped}. Sem ela não há com o que cruzar a planilha.
          </Banner>
        )}

        {!ncm.carregando && ncm.indisponivel && (
          <Banner tom="aviso" titulo="Tabela NCM oficial indisponível.">
            A auditoria vai conferir CST e natureza da receita normalmente, mas não consegue dizer se um
            NCM existe ou foi revogado — apenas se ele tem 8 dígitos.
          </Banner>
        )}

        {erro && (
          <Banner tom="erro" titulo="Não deu para auditar este arquivo.">
            {erro}
          </Banner>
        )}

        {!resultado ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <PainelInstrucoes />
            </div>
            <div className="lg:col-span-3">
              <ZonaUpload
                ref={zonaRef}
                onArquivo={auditar}
                processando={processando}
                desabilitada={!pronto}
                mensagemDesabilitada={
                  erroSped ? "A base do SPED não carregou." : "Carregando as tabelas do SPED e a nomenclatura NCM…"
                }
              />
            </div>
          </div>
        ) : (
          resumo && (
            <>
              {/* Cabeçalho do resultado */}
              <div
                ref={cartaoRef}
                tabIndex={-1}
                className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface-card p-4 shadow-(--shadow-card) sm:flex-row sm:items-center sm:justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                    <FileSpreadsheet size={20} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium" title={resultado.arquivo}>
                      {resultado.arquivo}
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {resumo.total.toLocaleString("pt-BR")} {resumo.total === 1 ? "linha auditada" : "linhas auditadas"}
                      {` · aba "${resultado.aba}"`}
                      {ncm.tabela ? ` · NCM conferido pela ${ncm.tabela.fonte}` : ""}
                    </p>
                    {sincronizadoEm && (
                      <p
                        className="text-xs text-text-tertiary"
                        title={alteradoEm ? `Última alteração publicada pela Receita: ${alteradoEm}. Conferido automaticamente todos os dias.` : undefined}
                      >
                        Dados da Receita Federal atualizados em {sincronizadoEm}
                        {versoesSped?.["4.3.13"] ? ` • Tabela 4.3.13 (Versão ${versoesSped["4.3.13"]})` : ""}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={reiniciar}
                    className="inline-flex items-center gap-2 rounded-lg border border-border-strong px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-page focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
                  >
                    <RotateCcw size={16} aria-hidden />
                    Nova auditoria
                  </button>
                  <button
                    type="button"
                    onClick={exportar}
                    disabled={exportando}
                    className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-contrast hover:bg-accent-hover disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 transition-colors"
                  >
                    {exportando ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Download size={16} aria-hidden />}
                    {criterioCorrecao !== SEM_CORRECAO ? "Exportar Planilha Corrigida" : "Exportar Planilha Auditada"}
                  </button>
                </div>
              </div>

              <ResumoAuditoria resumo={resumo} filtro={filtro} onFiltrar={aoFiltrar} correcaoAtiva={correcaoAtiva} />

              {/* Critério de Correção — principal novidade */}
              <CriterioCorrecao
                valor={criterioCorrecao}
                onChange={(v) => {
                  setCriterioCorrecao(v);
                  // Os selos de status da coluna Nat. receita só existem sob um
                  // critério. Sem zerar a seleção, ela fica guardada invisível e
                  // volta a filtrar sozinha quando a correção é religada.
                  definirFiltroColuna("natureza", null);
                  setVisiveis(PAGINA);
                }}
                totalLinhas={resumo.total}
                totalBeneficio={totalBeneficio}
                totalTributado={totalTributado}
                totalMantidas={totalMantidas}
              />

              {/* Barra de busca e filtro de CFOP */}
              <div className="flex flex-col md:flex-row md:items-center gap-4 bg-surface-card border border-border-subtle p-4 rounded-xl shadow-(--shadow-card)">
                <div className="flex-1">
                  <CampoBusca valor={consulta} onChange={aoBuscar} />
                </div>
                <div className="flex flex-wrap md:flex-nowrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-text-secondary w-full md:w-auto">
                    <span className="font-medium whitespace-nowrap">CFOP</span>
                    <select
                      value={cfopFiltro}
                      onChange={(e) => { setCfopFiltro(e.target.value); setVisiveis(PAGINA); }}
                      className="block w-full py-2 pl-2.5 pr-8 text-sm rounded-lg border border-border-strong bg-surface-card text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                    >
                      <option value="todos">Todos os CFOPs</option>
                      {opcoesCfop.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                </div>
              </div>

              <BarraFiltros filtros={filtrosAtivos} onLimparTudo={limparFiltrosColuna} />

              {resumo.divergencias === 0 && resumo.invalido === 0 && (
                <Banner
                  tom="ok"
                  titulo={
                    correcaoAtiva && linhasQueDivergiam.size > 0
                      ? "As divergências já foram corrigidas pelo critério."
                      : "Nenhuma divergência encontrada."
                  }
                >
                  {/* Com o critério ligado a tela não mostra mais a planilha do
                      cliente, e sim o resultado da correção. Dizer "está tudo
                      certo" aqui faria o contador entregar como conferido um
                      arquivo que ele ainda não exportou corrigido. */}
                  {correcaoAtiva ? (
                    <>
                      {linhasQueDivergiam.size > 0
                        ? `${linhasQueDivergiam.size.toLocaleString("pt-BR")} ${
                            linhasQueDivergiam.size === 1 ? "linha divergia" : "linhas divergiam"
                          } do SPED e já aparecem com o CST e a natureza corrigidos. `
                        : "Os CSTs e naturezas da planilha já batiam com o SPED. "}
                      {`O que está na tela é o resultado do critério CST ${criterioCorrecao} — não o que veio no arquivo; escolha “Sem correção — exibir planilha original” para vê-lo como chegou.`}
                    </>
                  ) : (
                    "Todos os CSTs e naturezas de receita batem com o que o SPED indica para cada NCM."
                  )}
                  {resumo.possivel > 0 ? ` ${resumo.possivel} linha(s) com possível benefício pedem conferência manual.` : ""}
                </Banner>
              )}

              <p className="text-sm text-text-secondary" aria-live="polite">
                <strong className="font-semibold text-text-primary">{exibiveis.length.toLocaleString("pt-BR")}</strong>{" "}
                {exibiveis.length === 1 ? "linha" : "linhas"}
                {filtro !== "todos" || consulta || cfopFiltro !== "todos" || filtrosAtivos.length > 0 ? " neste filtro" : ""}
                {restantes > 0 ? ` — exibindo as primeiras ${exibidas.length}` : ""}
                {criterioCorrecao !== SEM_CORRECAO && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
                    Correção CST {criterioCorrecao} ativa
                  </span>
                )}
                <span className="ml-3 inline-flex items-center gap-3 text-xs text-text-tertiary">
                  <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm bg-danger-soft border border-danger/40" /> NCM inválido</span>
                  <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm bg-warning-soft border border-warning/40" /> divergência</span>
                </span>
              </p>

              <TabelaAuditoria
                linhas={exibidas}
                colunas={COLUNAS_AUDITORIA}
                filtros={filtros}
                opcoesDe={opcoesDe}
                onFiltrar={definirFiltroColuna}
                criterioCorrecaoAtivo={criterioCorrecao !== SEM_CORRECAO}
              />

              {restantes > 0 && (
                <div className="flex justify-center mt-2">
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
          )
        )}
      </main>

      <Rodape />
    </div>
  );
}

interface BannerProps {
  tom: "erro" | "aviso" | "ok";
  titulo: string;
  children: React.ReactNode;
}

const ESTILO_BANNER: Record<BannerProps["tom"], { caixa: string; Icone: typeof AlertTriangle }> = {
  erro: { caixa: "bg-danger-soft text-danger border-danger/30", Icone: AlertTriangle },
  aviso: { caixa: "bg-warning-soft text-warning border-warning/30", Icone: AlertTriangle },
  ok: { caixa: "bg-success-soft text-success border-success/30", Icone: ShieldCheck },
};

function Banner({ tom, titulo, children }: BannerProps) {
  const { caixa, Icone } = ESTILO_BANNER[tom];
  return (
    <div role={tom === "erro" ? "alert" : "status"} className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${caixa}`}>
      <Icone size={18} className="mt-0.5 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">{titulo}</p>
        <p className="mt-0.5">{children}</p>
      </div>
    </div>
  );
}
