"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, Download, FileSpreadsheet, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { Cabecalho } from "@/componentes/Cabecalho";
import { CampoBusca } from "@/componentes/CampoBusca";
import { Rodape } from "@/componentes/Rodape";
import { BarraFiltros } from "@/componentes/BarraFiltros";
import { PainelInstrucoes } from "@/pis-cofins/ui/PainelInstrucoes";
import { ZonaUpload } from "@/componentes/ZonaUpload";
import { ResumoAuditoria } from "@/pis-cofins/ui/ResumoAuditoria";
import { TabelaAuditoria } from "@/pis-cofins/ui/TabelaAuditoria";
import { CriterioCorrecao, SEM_CORRECAO } from "@/pis-cofins/ui/CriterioCorrecao";
import { useTabelasReceita } from "@/ganchos/useTabelasReceita";
import { useTabelaNcm } from "@/pis-cofins/ui/useTabelaNcm";
import { useSincronizacao } from "@/ganchos/useSincronizacao";
import { COLUNAS_AUDITORIA } from "@/pis-cofins/colunas";
import { useAuditoria, PAGINA } from "@/pis-cofins/ui/useAuditoria";

export default function Auditoria() {
  const { registros, carregando: carregandoSped, erro: erroSped } = useTabelasReceita();
  const ncm = useTabelaNcm();
  const { data: sincronizadoEm, alteradoEm, versoes: versoesSped } = useSincronizacao();

  const { estado, dados, acoes, colunas } = useAuditoria(registros, ncm, !carregandoSped && !erroSped);

  const zonaRef = useRef<HTMLDivElement>(null);
  const cartaoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (estado.resultado) cartaoRef.current?.focus();
  }, [estado.resultado]);


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

        {estado.erro && (
          <Banner tom="erro" titulo="Não deu para auditar este arquivo.">
            {estado.erro}
          </Banner>
        )}

        {!estado.resultado ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <PainelInstrucoes />
            </div>
            <div className="lg:col-span-3">
              <ZonaUpload
                ref={zonaRef}
                onArquivo={acoes.auditar}
                processando={estado.processando}
                desabilitada={!estado.pronto}
                mensagemDesabilitada={
                  erroSped ? "A base do SPED não carregou." : "Carregando as tabelas do SPED e a nomenclatura NCM…"
                }
              />
            </div>
          </div>
        ) : (
          dados.resumo && (
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
                    <p className="truncate font-medium" title={estado.resultado.arquivo}>
                      {estado.resultado.arquivo}
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {dados.resumo.total.toLocaleString("pt-BR")} {dados.resumo.total === 1 ? "linha auditada" : "linhas auditadas"}
                      {` · aba "${estado.resultado.aba}"`}
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
                    onClick={() => { acoes.reiniciar(); requestAnimationFrame(() => zonaRef.current?.focus()); }}
                    className="inline-flex items-center gap-2 rounded-lg border border-border-strong px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-page focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
                  >
                    <RotateCcw size={16} aria-hidden />
                    Nova auditoria
                  </button>
                  <button
                    type="button"
                    onClick={acoes.exportar}
                    disabled={estado.exportando}
                    className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-contrast hover:bg-accent-hover disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 transition-colors"
                  >
                    {estado.exportando ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Download size={16} aria-hidden />}
                    {estado.criterioCorrecao !== SEM_CORRECAO ? "Exportar Planilha Corrigida" : "Exportar Planilha Auditada"}
                  </button>
                </div>
              </div>

              <ResumoAuditoria resumo={dados.resumo} filtro={estado.filtro} onFiltrar={acoes.aoFiltrar} correcaoAtiva={dados.correcaoAtiva} />

              <CriterioCorrecao
                valor={estado.criterioCorrecao}
                onChange={(v) => {
                  acoes.setCriterioCorrecao(v);
                  colunas.definir("natureza", null);
                  acoes.setVisiveis(PAGINA);
                }}
                totalLinhas={dados.resumo.total}
                totalBeneficio={dados.totalBeneficio}
                totalTributado={dados.totalTributado}
                totalMantidas={dados.totalMantidas}
              />

              <div className="flex flex-col md:flex-row md:items-center gap-4 bg-surface-card border border-border-subtle p-4 rounded-xl shadow-(--shadow-card)">
                <div className="flex-1">
                  <CampoBusca valor={estado.consulta} onChange={acoes.aoBuscar} />
                </div>
                <div className="flex flex-wrap md:flex-nowrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-text-secondary w-full md:w-auto">
                    <span className="font-medium whitespace-nowrap">CFOP</span>
                    <select
                      value={estado.cfopFiltro}
                      onChange={(e) => { acoes.setCfopFiltro(e.target.value); acoes.setVisiveis(PAGINA); }}
                      className="block w-full py-2 pl-2.5 pr-8 text-sm rounded-lg border border-border-strong bg-surface-card text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                    >
                      <option value="todos">Todos os CFOPs</option>
                      {dados.opcoesCfop.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                </div>
              </div>

              <BarraFiltros filtros={colunas.filtrosAtivos} onLimparTudo={colunas.limpar} />

              {dados.resumo.divergencias === 0 && dados.resumo.invalido === 0 && (
                <Banner
                  tom="ok"
                  titulo={
                    dados.correcaoAtiva && dados.linhasQueDivergiam.size > 0
                      ? "As divergências já foram corrigidas pelo critério."
                      : "Nenhuma divergência encontrada."
                  }
                >
                  {dados.correcaoAtiva ? (
                    <>
                      {dados.linhasQueDivergiam.size > 0
                        ? `${dados.linhasQueDivergiam.size.toLocaleString("pt-BR")} ${
                            dados.linhasQueDivergiam.size === 1 ? "linha divergia" : "linhas divergiam"
                          } do SPED e já aparecem com o CST e a natureza corrigidos. `
                        : "Os CSTs e naturezas da planilha já batiam com o SPED. "}
                      {`O que está na tela é o resultado do critério CST ${estado.criterioCorrecao} — não o que veio no arquivo; escolha “Sem correção — exibir planilha original” para vê-lo como chegou.`}
                    </>
                  ) : (
                    "Todos os CSTs e naturezas de receita batem com o que o SPED indica para cada NCM."
                  )}
                  {dados.resumo.possivel > 0 ? ` ${dados.resumo.possivel} linha(s) com possível benefício pedem conferência manual.` : ""}
                </Banner>
              )}

              <p className="text-sm text-text-secondary" aria-live="polite">
                <strong className="font-semibold text-text-primary">{dados.totalExibiveis.toLocaleString("pt-BR")}</strong>{" "}
                {dados.totalExibiveis === 1 ? "linha" : "linhas"}
                {estado.filtro !== "todos" || estado.consulta || estado.cfopFiltro !== "todos" || colunas.filtrosAtivos.length > 0 ? " neste filtro" : ""}
                {dados.restantes > 0 ? ` — exibindo as primeiras ${dados.exibidas.length}` : ""}
                {estado.criterioCorrecao !== SEM_CORRECAO && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
                    Correção CST {estado.criterioCorrecao} ativa
                  </span>
                )}
                <span className="ml-3 inline-flex items-center gap-3 text-xs text-text-tertiary">
                  <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm bg-danger-soft border border-danger/40" /> NCM inválido</span>
                  <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-sm bg-warning-soft border border-warning/40" /> divergência</span>
                </span>
              </p>

              <TabelaAuditoria
                linhas={dados.exibidas}
                colunas={COLUNAS_AUDITORIA}
                filtros={colunas.filtros}
                opcoesDe={colunas.opcoesDe}
                onFiltrar={colunas.definir}
                criterioCorrecaoAtivo={estado.criterioCorrecao !== SEM_CORRECAO}
              />

              {dados.restantes > 0 && (
                <div className="flex justify-center mt-2">
                  <button
                    type="button"
                    onClick={() => acoes.setVisiveis((atual: number) => atual + PAGINA)}
                    className="px-5 py-2.5 text-sm font-medium text-accent bg-surface-card border border-border-subtle rounded-xl shadow-(--shadow-card) hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
                  >
                    Mostrar mais {Math.min(PAGINA, dados.restantes)} de {dados.restantes.toLocaleString("pt-BR")}
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
