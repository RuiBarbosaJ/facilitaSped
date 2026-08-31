"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, FileSpreadsheet, Loader2, RotateCcw, ShieldCheck } from "lucide-react";

import { Cabecalho } from "@/components/Cabecalho";
import { CampoBusca } from "@/components/CampoBusca";
import { Rodape } from "@/components/Rodape";
import { PainelInstrucoes } from "@/components/auditoria/PainelInstrucoes";
import { ZonaUpload } from "@/components/auditoria/ZonaUpload";
import { ResumoAuditoria, type FiltroAuditoria } from "@/components/auditoria/ResumoAuditoria";
import { TabelaAuditoria } from "@/components/auditoria/TabelaAuditoria";
import { useRegistrosSped } from "@/hooks/useRegistrosSped";
import { useTabelaNcm } from "@/hooks/useTabelaNcm";
import {
  ERRO_LAYOUT,
  auditarLinha,
  extrairLinhas,
  indexarBase,
  indexarNcm,
  indexarRegrasSemNcm,
  localizarCabecalho,
  resumir,
  valorColuna,
  type LinhaAuditada,
} from "@/lib/auditoria";
import { TAMANHO_MAXIMO, baixarArquivo, descreverErroDeLeitura, gerarXlsx, lerAbas, tipoDeArquivo } from "@/lib/planilha";

/** Linhas por página na tabela de resultados. */
const PAGINA = 100;

interface Resultado {
  arquivo: string;
  aba: string;
  linhas: LinhaAuditada[];
  /** Cabeçalho como veio do cliente — o export devolve essas colunas intactas. */
  colunasOriginais: string[];
}

export default function Auditoria() {
  const { registros, carregando: carregandoSped, erro: erroSped } = useRegistrosSped();
  const ncm = useTabelaNcm();

  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [filtro, setFiltro] = useState<FiltroAuditoria>("todos");
  const [visiveis, setVisiveis] = useState(PAGINA);
  const [exportando, setExportando] = useState(false);
  const [consulta, setConsulta] = useState("");
  const [cstFiltro, setCstFiltro] = useState("todos");
  const [cfopFiltro, setCfopFiltro] = useState("todos");
  const [filtrosColuna, setFiltrosColuna] = useState<Record<string, string[]>>({});

  const zonaRef = useRef<HTMLDivElement>(null);
  const cartaoRef = useRef<HTMLDivElement>(null);

  // Os índices são caros de montar (10 mil NCMs) e não mudam entre arquivos.
  const indiceBase = useMemo(() => indexarBase(registros), [registros]);
  const indiceSemNcm = useMemo(() => indexarRegrasSemNcm(registros), [registros]);
  const indiceNcm = useMemo(() => (ncm.tabela ? indexarNcm(ncm.tabela.codigos) : null), [ncm.tabela]);

  const pronto = !carregandoSped && !erroSped && !ncm.carregando;

  // Quem usa teclado ou leitor de tela precisa ser levado ao que mudou: o
  // cartão de resultado ao terminar, a zona de upload ao recomeçar.
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
      setCstFiltro("todos");
      setCfopFiltro("todos");
      setFiltrosColuna({});

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
        // O relatório costuma estar na primeira aba, mas há exports com uma aba
        // de capa vazia na frente: usamos a primeira aba que tenha o cabeçalho.
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
    [indiceBase, indiceSemNcm, indiceNcm]
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
      // Filtro global de texto (nome do produto, NCM, etc)
      if (consulta) {
        const termo = consulta.toLowerCase();
        const textoLinha = `${l.nome} ${l.ncm} ${l.classificacaoOriginal} ${l.descricaoNcm || ""} ${l.observacoes.join(" ")}`.toLowerCase();
        if (!textoLinha.includes(termo)) return false;
      }
      
      // Filtro de CST
      if (cstFiltro !== "todos") {
        if (l.cstPis !== cstFiltro && l.cstCofins !== cstFiltro) return false;
      }
      
      // Filtro de CFOP
      if (cfopFiltro !== "todos") {
        if (l.cfop !== cfopFiltro) return false;
      }

      // Filtros de coluna do Excel
      for (const col of Object.keys(filtrosColuna)) {
        const selecionados = filtrosColuna[col];
        if (selecionados) {
          const valor = valorColuna(l, col);
          if (!selecionados.includes(valor)) return false;
        }
      }

      return true;
    });
  }, [filtradas, consulta, cstFiltro, cfopFiltro, filtrosColuna]);

  const exibidas = filtradasEBusca.slice(0, visiveis);
  const restantes = filtradasEBusca.length - exibidas.length;

  function aoFiltrar(novo: FiltroAuditoria) {
    setFiltro(novo);
    setVisiveis(PAGINA);
  }

  function aoBuscar(valor: string) {
    setConsulta(valor);
    setVisiveis(PAGINA);
  }

  function aoFiltrarColuna(coluna: string, valores: string[] | null) {
    setFiltrosColuna((atuais) => {
      const novos = { ...atuais };
      if (valores === null) {
        delete novos[coluna];
      } else {
        novos[coluna] = valores;
      }
      return novos;
    });
    setVisiveis(PAGINA);
  }

  // Extrair opções únicas para os selects
  const opcoesCst = useMemo(() => {
    if (!resultado) return [];
    const csts = new Set<string>();
    resultado.linhas.forEach((l) => {
      if (l.cstPis) csts.add(l.cstPis);
      if (l.cstCofins) csts.add(l.cstCofins);
    });
    return Array.from(csts).sort();
  }, [resultado]);

  const opcoesCfop = useMemo(() => {
    if (!resultado) return [];
    const cfops = new Set<string>();
    resultado.linhas.forEach((l) => {
      if (l.cfop) cfops.add(l.cfop);
    });
    return Array.from(cfops).sort();
  }, [resultado]);

  async function exportar() {
    if (!resultado) return;
    setExportando(true);
    try {
      // As colunas do cliente saem intactas, na ordem original — o contador
      // precisa do código interno dele para reimportar no ERP. A auditoria é
      // acrescentada depois delas.
      const colunasCliente = resultado.colunasOriginais;
      const COLUNAS_AUDITORIA = [
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
      const cabecalho = [...colunasCliente, ...COLUNAS_AUDITORIA];
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
    // A zona só volta ao DOM no próximo render.
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
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-text-secondary">
                    <span className="font-medium whitespace-nowrap">CST</span>
                    <select
                      value={cstFiltro}
                      onChange={(e) => { setCstFiltro(e.target.value); setVisiveis(PAGINA); }}
                      className="block w-full py-1.5 pl-2 pr-8 text-sm rounded-lg border border-border-strong bg-surface-card text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                    >
                      <option value="todos">Todos os CSTs</option>
                      {opcoesCst.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  
                  <label className="flex items-center gap-2 text-sm text-text-secondary">
                    <span className="font-medium whitespace-nowrap">CFOP</span>
                    <select
                      value={cfopFiltro}
                      onChange={(e) => { setCfopFiltro(e.target.value); setVisiveis(PAGINA); }}
                      className="block w-full py-1.5 pl-2 pr-8 text-sm rounded-lg border border-border-strong bg-surface-card text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                    >
                      <option value="todos">Todos os CFOPs</option>
                      {opcoesCfop.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                </div>
              </div>

              {resumo.divergencias === 0 && resumo.invalido === 0 && (
                <Banner tom="ok" titulo="Nenhuma divergência encontrada.">
                  Todos os CSTs e naturezas de receita batem com o que o SPED indica para cada NCM.
                  {resumo.possivel > 0 ? ` ${resumo.possivel} linha(s) com possível benefício pedem conferência manual.` : ""}
                </Banner>
              )}

              <p className="text-sm text-text-secondary" aria-live="polite">
                <strong className="font-semibold text-text-primary">{filtradasEBusca.length.toLocaleString("pt-BR")}</strong>{" "}
                {filtradasEBusca.length === 1 ? "linha" : "linhas"}
                {filtro !== "todos" || consulta || cstFiltro !== "todos" || cfopFiltro !== "todos" ? " neste filtro" : ""}
                {restantes > 0 ? ` — exibindo as primeiras ${exibidas.length}` : ""}
                <span className="ml-3 inline-flex items-center gap-3 text-xs text-text-tertiary">
                  <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm bg-danger-soft border border-danger/40" /> NCM inválido</span>
                  <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm bg-warning-soft border border-warning/40" /> divergência</span>
                </span>
              </p>

              <TabelaAuditoria
                linhas={exibidas}
                todasAsLinhas={filtradas} // Precisamos das linhas filtradas globalmente para gerar os valores únicos de cada coluna
                filtrosColuna={filtrosColuna}
                onFiltrarColuna={aoFiltrarColuna}
              />

              {restantes > 0 && (
                <div className="flex justify-center">
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
