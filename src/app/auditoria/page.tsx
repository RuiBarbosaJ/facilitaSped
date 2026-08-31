"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, FileSpreadsheet, Loader2, RotateCcw, ShieldCheck } from "lucide-react";

import { Cabecalho } from "@/components/Cabecalho";
import { CampoBusca } from "@/components/CampoBusca";
import { Rodape } from "@/components/Rodape";
import { SeletorCst } from "@/components/SeletorCst";
import { BarraFiltros } from "@/components/BarraFiltros";
import { PainelInstrucoes } from "@/components/auditoria/PainelInstrucoes";
import { ZonaUpload } from "@/components/auditoria/ZonaUpload";
import { ResumoAuditoria, type FiltroAuditoria } from "@/components/auditoria/ResumoAuditoria";
import { TabelaAuditoria } from "@/components/auditoria/TabelaAuditoria";
import { useRegistrosSped } from "@/hooks/useRegistrosSped";
import { useTabelaNcm } from "@/hooks/useTabelaNcm";
import { useEstadoMemoria } from "@/hooks/useEstadoMemoria";
import { useFiltroCst, TODOS_CST } from "@/hooks/useFiltroCst";
import { useFiltrosColuna } from "@/hooks/useFiltrosColuna";
import { COLUNAS_AUDITORIA } from "@/lib/colunasAuditoria";
import {
  ERRO_LAYOUT,
  auditarLinha,
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
}

export default function Auditoria() {
  const { registros, carregando: carregandoSped, erro: erroSped } = useRegistrosSped();
  const ncm = useTabelaNcm();
  const { opcoes: opcoesCstBase } = useFiltroCst(registros, TODOS_CST);

  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useEstadoMemoria<string | null>("auditoria_erro", null);
  const [resultado, setResultado] = useEstadoMemoria<Resultado | null>("auditoria_resultado", null);
  const [filtro, setFiltro] = useEstadoMemoria<FiltroAuditoria>("auditoria_filtro", "todos");
  const [visiveis, setVisiveis] = useEstadoMemoria("auditoria_visiveis", PAGINA);
  const [exportando, setExportando] = useState(false);
  const [consulta, setConsulta] = useEstadoMemoria("auditoria_consulta", "");
  const [cstFiltro, setCstFiltro] = useEstadoMemoria("auditoria_cstFiltro", TODOS_CST);
  const [cfopFiltro, setCfopFiltro] = useEstadoMemoria("auditoria_cfopFiltro", "todos");

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
      setCstFiltro(TODOS_CST);
      setCfopFiltro("todos");

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
        setResultado({ arquivo: arquivo.name, aba: encontrada.aba.nome, linhas, colunasOriginais: cabecalhoOriginal });
      } catch (excecao) {
        setErro(descreverErroDeLeitura(excecao));
      } finally {
        setProcessando(false);
      }
    },
    [indiceBase, indiceSemNcm, indiceNcm, setErro, setResultado, setFiltro, setVisiveis, setConsulta, setCstFiltro, setCfopFiltro]
  );

  const resumo = useMemo(() => (resultado ? resumir(resultado.linhas) : null), [resultado]);

  const filtradas = useMemo(() => {
    if (!resultado) return [];
    switch (filtro) {
      case "beneficio":
      case "possivel":
      case "tributado":
      case "invalido":
        return resultado.linhas.filter((l) => l.situacao === filtro);
      case "divergencias":
        return resultado.linhas.filter((l) => l.destaque === "amarelo");
      case "coerente":
        return resultado.linhas.filter((l) => l.destaque === "nenhum" && l.situacao !== "invalido");
      default:
        return resultado.linhas;
    }
  }, [resultado, filtro]);

  const filtradasEBusca = useMemo(() => {
    return filtradas.filter((l) => {
      if (consulta) {
        const termo = consulta.toLowerCase();
        const textoLinha = `${l.nome} ${l.ncm} ${l.classificacaoOriginal} ${l.descricaoNcm || ""} ${l.observacoes.join(" ")}`.toLowerCase();
        if (!textoLinha.includes(termo)) return false;
      }
      
      if (cstFiltro !== TODOS_CST) {
        if (!l.regra?.cstsAceitos.includes(cstFiltro)) return false;
      }
      
      if (cfopFiltro !== "todos") {
        if (l.cfop !== cfopFiltro) return false;
      }

      return true;
    });
  }, [filtradas, consulta, cstFiltro, cfopFiltro]);

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

  function aoFiltrar(novo: FiltroAuditoria) {
    setFiltro(novo);
    setVisiveis(PAGINA);
  }

  function aoBuscar(valor: string) {
    setConsulta(valor);
    setVisiveis(PAGINA);
  }

  const opcoesCst = useMemo(() => {
    if (!resultado) return [];
    const csts = new Set<string>();
    resultado.linhas.forEach((l) => {
      if (l.regra?.cstsAceitos) {
        l.regra.cstsAceitos.forEach((c) => csts.add(c));
      }
    });
    return Array.from(csts).sort().map((c) => {
      const achou = opcoesCstBase.find((o) => o.cst === c);
      return achou ? achou : { cst: c, rotulo: `CST ${c}` };
    });
  }, [resultado, opcoesCstBase]);

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
      const linhas = resultado.linhas.map((l) => [
        ...colunasCliente.map((_, i) => {
          const celula = l.original[i];
          return celula === undefined || celula === null ? "" : celula;
        }),
        l.linha,
        l.ncm,
        l.rotulo,
        l.regra?.rotulo ?? "",
        l.regra?.tabela ?? "",
        l.regra?.cstsAceitos.join(" ou ") ?? "",
        l.regra?.naturezas.join(" ou ") ?? "",
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
      baixarArquivo(bytes, `auditoria-${base}.xlsx`);
    } finally {
      setExportando(false);
    }
  }

  function reiniciar() {
    setResultado(null);
    setErro(null);
    setFiltro("todos");
    setVisiveis(PAGINA);
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
                      {` · aba “${resultado.aba}”`}
                      {ncm.tabela ? ` · NCM conferido pela ${ncm.tabela.fonte}` : ""}
                    </p>
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
                    Exportar Planilha Auditada
                  </button>
                </div>
              </div>

              <ResumoAuditoria resumo={resumo} filtro={filtro} onFiltrar={aoFiltrar} />

              <div className="flex flex-col md:flex-row md:items-center gap-4 bg-surface-card border border-border-subtle p-4 rounded-xl shadow-(--shadow-card)">
                <div className="flex-1">
                  <CampoBusca valor={consulta} onChange={aoBuscar} />
                </div>
                <div className="flex flex-wrap md:flex-nowrap gap-4">
                  <SeletorCst 
                    valor={cstFiltro} 
                    opcoes={opcoesCst} 
                    onChange={(v) => { setCstFiltro(v); setVisiveis(PAGINA); }} 
                  />
                  
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
                <Banner tom="ok" titulo="Nenhuma divergência encontrada.">
                  Todos os CSTs e naturezas de receita batem com o que o SPED indica para cada NCM.
                  {resumo.possivel > 0 ? ` ${resumo.possivel} linha(s) com possível benefício pedem conferência manual.` : ""}
                </Banner>
              )}

              <p className="text-sm text-text-secondary" aria-live="polite">
                <strong className="font-semibold text-text-primary">{exibiveis.length.toLocaleString("pt-BR")}</strong>{" "}
                {exibiveis.length === 1 ? "linha" : "linhas"}
                {filtro !== "todos" || consulta || cstFiltro !== TODOS_CST || cfopFiltro !== "todos" || filtrosAtivos.length > 0 ? " neste filtro" : ""}
                {restantes > 0 ? ` — exibindo as primeiras ${exibidas.length}` : ""}
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
