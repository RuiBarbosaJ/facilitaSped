"use client";

import { useCallback, useMemo, useState } from "react";
import { AlertTriangle, Download, FileSpreadsheet, Loader2, RotateCcw, ShieldCheck } from "lucide-react";

import { Cabecalho } from "@/components/Cabecalho";
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
  localizarCabecalho,
  resumir,
  type LinhaAuditada,
} from "@/lib/auditoria";
import { TAMANHO_MAXIMO, baixarArquivo, gerarXlsx, lerPrimeiraAba } from "@/lib/planilha";

/** Linhas por página na tabela de resultados. */
const PAGINA = 100;

interface Resultado {
  arquivo: string;
  linhas: LinhaAuditada[];
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

  // Os índices são caros de montar (10 mil NCMs) e não mudam entre arquivos.
  const indiceBase = useMemo(() => indexarBase(registros), [registros]);
  const indiceNcm = useMemo(
    () => (ncm.tabela ? indexarNcm(ncm.tabela.codigos) : null),
    [ncm.tabela]
  );

  const pronto = !carregandoSped && !erroSped && !ncm.carregando;

  const auditar = useCallback(
    async (arquivo: File) => {
      setErro(null);
      setResultado(null);
      setFiltro("todos");
      setVisiveis(PAGINA);

      if (arquivo.size > TAMANHO_MAXIMO) {
        setErro(`O arquivo tem ${(arquivo.size / 1024 / 1024).toFixed(1)} MB; o limite é 25 MB.`);
        return;
      }

      setProcessando(true);
      try {
        const matriz = await lerPrimeiraAba(await arquivo.arrayBuffer());
        const cabecalho = localizarCabecalho(matriz);
        if (!cabecalho) {
          setErro(ERRO_LAYOUT);
          return;
        }

        const contexto = { base: indiceBase, ncm: indiceNcm, hoje: new Date() };
        const linhas = extrairLinhas(matriz, cabecalho).map((l) => auditarLinha(l, contexto));
        if (linhas.length === 0) {
          setErro("A planilha tem o cabeçalho certo, mas nenhuma linha de produto abaixo dele.");
          return;
        }
        setResultado({ arquivo: arquivo.name, linhas });
      } catch (excecao) {
        setErro(
          excecao instanceof Error
            ? `Não foi possível ler a planilha: ${excecao.message}`
            : "Não foi possível ler a planilha."
        );
      } finally {
        setProcessando(false);
      }
    },
    [indiceBase, indiceNcm]
  );

  const resumo = useMemo(() => (resultado ? resumir(resultado.linhas) : null), [resultado]);

  const filtradas = useMemo(() => {
    if (!resultado) return [];
    switch (filtro) {
      case "beneficio":
      case "tributado":
      case "invalido":
        return resultado.linhas.filter((l) => l.situacao === filtro);
      case "divergencias":
        return resultado.linhas.filter((l) => l.destaque === "amarelo");
      default:
        return resultado.linhas;
    }
  }, [resultado, filtro]);

  const exibidas = filtradas.slice(0, visiveis);
  const restantes = filtradas.length - exibidas.length;

  function aoFiltrar(novo: FiltroAuditoria) {
    setFiltro(novo);
    setVisiveis(PAGINA);
  }

  async function exportar() {
    if (!resultado) return;
    setExportando(true);
    try {
      const cabecalho = [
        "Linha",
        "Nome Produto",
        "Classificação",
        "NCM (8 dígitos)",
        "CST PIS",
        "CST COFINS",
        "Natureza da Receita de PIS",
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
      const linhas = resultado.linhas.map((l) => [
        l.linha,
        l.nome,
        l.classificacaoOriginal,
        l.ncm,
        l.cstPis,
        l.cstCofins,
        l.natureza,
        l.rotulo,
        l.regra?.rotulo ?? "",
        l.regra?.tabela ?? "",
        l.regra?.cstsAceitos.join(" ou ") ?? "",
        l.regra?.natureza ?? "",
        l.regra?.descricao ?? "",
        l.regra ? `${l.regra.inicio ?? ""}${l.regra.fim ? ` a ${l.regra.fim}` : l.regra.inicio ? " (vigente)" : ""}` : "",
        l.descricaoNcm ?? "",
        l.observacoes.join(" "),
      ]);
      const bytes = await gerarXlsx(
        [cabecalho, ...linhas],
        "Auditoria",
        [7, 40, 14, 14, 8, 10, 12, 18, 22, 10, 12, 12, 60, 22, 40, 70]
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
  }

  return (
    <div className="min-h-screen bg-surface-page text-text-primary font-sans">
      <Cabecalho />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
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
              <div className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface-card p-4 shadow-(--shadow-card) sm:flex-row sm:items-center sm:justify-between">
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

              {resumo.divergencias === 0 && resumo.invalido === 0 && (
                <Banner tom="ok" titulo="Nenhuma divergência encontrada.">
                  Todos os CSTs e naturezas de receita batem com o que o SPED indica para cada NCM.
                </Banner>
              )}

              <p className="text-sm text-text-secondary" aria-live="polite">
                <strong className="font-semibold text-text-primary">{filtradas.length.toLocaleString("pt-BR")}</strong>{" "}
                {filtradas.length === 1 ? "linha" : "linhas"}
                {filtro !== "todos" ? " neste filtro" : ""}
                {restantes > 0 ? ` — exibindo as primeiras ${exibidas.length}` : ""}
                <span className="ml-3 inline-flex items-center gap-3 text-xs text-text-tertiary">
                  <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm bg-danger-soft border border-danger/40" /> NCM inválido</span>
                  <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm bg-warning-soft border border-warning/40" /> divergência</span>
                </span>
              </p>

              <TabelaAuditoria linhas={exibidas} />

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
        <p className="mt-0.5 opacity-90">{children}</p>
      </div>
    </div>
  );
}
