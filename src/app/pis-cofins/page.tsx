"use client";

import { useEffect, useRef } from "react";
import { Download, Loader2, RotateCcw } from "lucide-react";
import { Cabecalho } from "@/componentes/Cabecalho";
import { CampoBusca } from "@/componentes/CampoBusca";
import { Rodape } from "@/componentes/Rodape";
import { Banner } from "@/componentes/Banner";
import { BarraFiltros } from "@/componentes/BarraFiltros";
import { PainelInstrucoes } from "@/pis-cofins/ui/PainelInstrucoes";
import { ZonaUpload } from "@/componentes/ZonaUpload";
import { ResumoAuditoria } from "@/pis-cofins/ui/ResumoAuditoria";
import { TabelaAuditoria } from "@/pis-cofins/ui/TabelaAuditoria";
import { TituloDaTela } from "@/componentes/TituloDaTela";
import { CriterioCorrecao, SEM_CORRECAO } from "@/pis-cofins/ui/CriterioCorrecao";
import { SeletorSentido } from "@/pis-cofins/ui/SeletorSentido";
import { useTabelasReceita } from "@/ganchos/useTabelasReceita";
import { useTabelaNcm } from "@/pis-cofins/ui/useTabelaNcm";
import { useSincronizacao } from "@/ganchos/useSincronizacao";
import { COLUNAS_AUDITORIA } from "@/pis-cofins/colunas";
import { useAuditoria, PAGINA } from "@/pis-cofins/ui/useAuditoria";

const TITULO = "PIS/COFINS — conferência da planilha";

export default function Auditoria() {
  const { registros, carregando: carregandoSped, erro: erroSped } = useTabelasReceita();
  const ncm = useTabelaNcm();
  const { data: sincronizadoEm, alteradoEm } = useSincronizacao();

  const { estado, dados, acoes, colunas } = useAuditoria(registros, ncm, !carregandoSped && !erroSped);

  const zonaRef = useRef<HTMLDivElement>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);

  // O resultado substitui a tela de upload: o foco vai ao título, para o leitor
  // de tela anunciar a troca e o teclado não ficar preso onde a zona estava.
  useEffect(() => {
    if (estado.resultado) tituloRef.current?.focus();
  }, [estado.resultado]);

  const resultado = estado.resultado;
  const resumo = dados.resumo;

  /** Os avisos sobre as bases valem nos dois estados da tela. */
  const avisosDasBases = (
    <>
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
    </>
  );

  if (!resultado || !resumo) {
    return (
      <div className="flex min-h-screen flex-col bg-surface-page font-sans text-text-primary">
        <Cabecalho />

        <main
          id="conteudo-principal"
          className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8"
        >
          <TituloDaTela
            titulo={TITULO}
            versao="EFD-Contribuições"
            descricao="Cruza cada classificação com a nomenclatura vigente e com as tabelas de benefício do SPED. A planilha é lida no seu navegador — nada é enviado."
          />

          {avisosDasBases}

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-5 lg:gap-10">
            <div className="lg:col-span-2 lg:pt-2">
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
        </main>

        <Rodape />
      </div>
    );
  }

  const filtrando =
    estado.filtro !== "todos" || estado.consulta || estado.cfopFiltro !== "todos" || colunas.filtrosAtivos.length > 0;

  /*
   * De onde veio e contra o que foi conferido, numa linha só: o arquivo, a aba,
   * a nomenclatura e a data das tabelas. Era um cartão com ícone, três linhas de
   * texto e um anel de foco em volta.
   */
  const procedencia = [
    resultado.arquivo,
    `${resumo.total.toLocaleString("pt-BR")} ${resumo.total === 1 ? "linha" : "linhas"}`,
    `aba "${resultado.aba}"`,
    ncm.tabela ? `NCM conferido pela ${ncm.tabela.fonte}` : null,
    sincronizadoEm ? `tabelas do SPED conferidas com a Receita em ${sincronizadoEm}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex min-h-screen flex-col bg-surface-page font-sans text-text-primary">
      <Cabecalho>
        <CampoBusca
          valor={estado.consulta}
          onChange={acoes.aoBuscar}
          atalhoGlobal
          placeholder="Buscar por produto, NCM ou observação"
          rotulo="Buscar nas linhas auditadas"
          className="w-full"
        />
      </Cabecalho>

      <main
        id="conteudo-principal"
        className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 lg:px-8"
      >
        <section aria-labelledby="titulo-auditoria" className="flex min-w-0 flex-col gap-4">
          <TituloDaTela
            id="titulo-auditoria"
            refTitulo={tituloRef}
            titulo={TITULO}
            versao={
              <span
                title={
                  alteradoEm
                    ? `Última alteração publicada pela Receita: ${alteradoEm}. Conferido automaticamente todos os dias.`
                    : undefined
                }
              >
                {procedencia}
              </span>
            }
            acoes={
              <>
                <button
                  type="button"
                  onClick={() => {
                    acoes.reiniciar();
                    requestAnimationFrame(() => zonaRef.current?.focus());
                  }}
                  className="inline-flex items-center gap-2 rounded-md border border-border-strong bg-surface-card px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <RotateCcw size={15} aria-hidden />
                  Nova auditoria
                </button>
                <button
                  type="button"
                  onClick={acoes.exportar}
                  disabled={estado.exportando}
                  aria-busy={estado.exportando}
                  className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-60"
                >
                  {estado.exportando ? (
                    <Loader2 size={15} className="animate-spin" aria-hidden />
                  ) : (
                    <Download size={15} aria-hidden />
                  )}
                  {estado.criterioCorrecao !== SEM_CORRECAO ? "Exportar planilha corrigida" : "Exportar planilha auditada"}
                </button>
              </>
            }
          />

          {avisosDasBases}

          {/*
            As premissas da conferência, num painel só: de que ponta a planilha
            fala e se a tabela mostra a planilha original ou a corrigida. São as
            duas escolhas que mudam o resultado inteiro, e precisam estar à vista
            antes da primeira linha.
          */}
          <div className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-surface-card">
            <SeletorSentido
              sentido={estado.sentido}
              deteccao={resultado.deteccao}
              manual={estado.sentidoManual}
              onSentido={acoes.setSentido}
              regime={estado.regime}
              onRegime={acoes.setRegime}
            />
            <CriterioCorrecao
              valor={estado.criterioCorrecao}
              sentido={estado.sentido}
              cstTributado={estado.cstTributado}
              onChange={(v) => {
                acoes.setCriterioCorrecao(v);
                colunas.definir("natureza", null);
                acoes.setVisiveis(PAGINA);
              }}
              totalLinhas={resumo.total}
              totalBeneficio={dados.totalBeneficio}
              totalTributado={dados.totalTributado}
              totalMantidas={dados.totalMantidas}
            />
          </div>

          {resumo.divergencias === 0 && resumo.invalido === 0 && (
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
              {resumo.possivel > 0 ? ` ${resumo.possivel} linha(s) com possível benefício pedem conferência manual.` : ""}
            </Banner>
          )}

          <div className="flex flex-col gap-3">
            <ResumoAuditoria
              resumo={resumo}
              filtro={estado.filtro}
              onFiltrar={acoes.aoFiltrar}
              correcaoAtiva={dados.correcaoAtiva}
            />

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <p className="text-sm text-text-secondary" aria-live="polite">
                <strong className="font-semibold text-text-primary">
                  {dados.totalExibiveis.toLocaleString("pt-BR")}
                </strong>{" "}
                {dados.totalExibiveis === 1 ? "linha" : "linhas"}
                {filtrando ? " neste recorte" : ""}
                {dados.correcaoAtiva && (
                  <span className="text-accent"> · planilha corrigida pelo critério CST {estado.criterioCorrecao}</span>
                )}
              </p>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {/* A legenda das cores da tabela: só as duas que marcam linha. */}
                <span className="inline-flex items-center gap-3 text-xs text-text-tertiary">
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="h-3 w-0.5 rounded-full bg-danger" /> NCM inválido
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="h-3 w-0.5 rounded-full bg-warning" /> divergência
                  </span>
                </span>

                {dados.opcoesCfop.length > 0 && (
                  <label className="flex items-center gap-2 text-xs text-text-secondary">
                    <span className="font-medium">CFOP</span>
                    <select
                      value={estado.cfopFiltro}
                      onChange={(e) => {
                        acoes.setCfopFiltro(e.target.value);
                        acoes.setVisiveis(PAGINA);
                      }}
                      className="block rounded-md border border-border-strong bg-surface-card py-1 pr-7 pl-2 text-sm text-text-primary focus:border-accent focus:ring-2 focus:ring-accent focus:outline-none"
                    >
                      <option value="todos">Todos</option>
                      {dados.opcoesCfop.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </div>

            <BarraFiltros filtros={colunas.filtrosAtivos} onLimparTudo={colunas.limpar} />
          </div>

          <TabelaAuditoria
            linhas={dados.exibidas}
            colunas={COLUNAS_AUDITORIA}
            filtros={colunas.filtros}
            opcoesDe={colunas.opcoesDe}
            onFiltrar={colunas.definir}
            criterioCorrecaoAtivo={estado.criterioCorrecao !== SEM_CORRECAO}
            rodape={
              dados.restantes > 0 && (
                <div className="flex justify-center border-t border-border-subtle px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => acoes.setVisiveis((atual: number) => atual + PAGINA)}
                    className="rounded-md px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    Mostrar mais {Math.min(PAGINA, dados.restantes)} de {dados.restantes.toLocaleString("pt-BR")}
                  </button>
                </div>
              )
            }
          />
        </section>
      </main>

      <Rodape />
    </div>
  );
}
