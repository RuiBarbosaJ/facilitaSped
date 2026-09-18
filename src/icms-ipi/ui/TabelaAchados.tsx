"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { SearchX, Wrench } from "lucide-react";

import { BarraFiltros, type FiltroAtivo } from "@/componentes/BarraFiltros";
import { CampoBusca } from "@/componentes/CampoBusca";
import { DescricaoExpandivel } from "@/componentes/DescricaoExpandivel";
import { NavegacaoLateral } from "@/componentes/NavegacaoLateral";
import { FiltroColuna } from "@/componentes/FiltroColuna";
import { useEstadoMemoria } from "@/ganchos/useEstadoMemoria";
import { useFiltrosColuna } from "@/ganchos/useFiltrosColuna";
import {
  COLUNAS_ACHADOS,
  ESTILO_SEVERIDADE,
  ORDEM_SEVERIDADE,
  ROTULO_SEVERIDADE,
  textoDoAchado,
} from "./colunasAchados";
import type { Achado, Severidade } from "@/regras/nucleo/contrato";

/**
 * Quantos apontamentos por página.
 *
 * A lista passou a paginar, como a tabela de consulta e a de PIS/COFINS, em vez
 * de virtualizar. A virtualização exigia altura FIXA por linha, e era ela que
 * cortava a mensagem — justamente a coluna que responde à pergunta do contador.
 * Com paginação a linha cresce conforme o texto, e o teto de apontamentos
 * (5.000) deixa de ser um problema de DOM: o navegador monta cem por vez.
 */
const PAGINA = 100;

/**
 * A severidade nunca é comunicada só pela cor: um auditor com daltonismo — ou
 * lendo o relatório impresso — precisa separar o que reprova a entrega do que é
 * informativo. Daí rótulo em texto e ícone próprio, além da cor.
 */
const SEVERIDADES: Severidade[] = ["critico", "erro", "alerta", "info"];

/** Colunas que nunca quebram linha: código, número, selo. */
const ESTREITAS = new Set(["severidade", "linha", "nota", "registro", "codigo", "correcao"]);

export function TabelaAchados({ achados }: { achados: Achado[] }) {
  const [busca, setBusca] = useState("");
  const [visiveisAteAqui, setVisiveisAteAqui] = useEstadoMemoria(
    "icms_ipi_achados_visiveis",
    PAGINA
  );

  const ordenados = useMemo(
    () =>
      [...achados].sort(
        (a, b) => ORDEM_SEVERIDADE[a.severidade] - ORDEM_SEVERIDADE[b.severidade] || a.nl - b.nl
      ),
    [achados]
  );

  // A busca vem antes dos filtros de coluna, como na auditoria de planilhas: as
  // opções do menu são calculadas sobre o que a busca deixou passar, então o
  // menu nunca oferece um valor que já não está na tela.
  const encontrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return ordenados;
    return ordenados.filter((achado) => textoDoAchado(achado).includes(termo));
  }, [ordenados, busca]);

  /*
   * Voltar à primeira página a cada mudança de filtro é o comportamento das
   * outras duas tabelas — e sem isso quem tinha pedido "mostrar mais" cinco
   * vezes e então filtrava recebia uma página que não pediu.
   */
  const voltarAoInicio = useCallback(() => setVisiveisAteAqui(PAGINA), [setVisiveisAteAqui]);

  const colunas = useFiltrosColuna(
    encontrados,
    COLUNAS_ACHADOS,
    "icms_ipi_achados_filtros",
    voltarAoInicio
  );
  const filtrados = colunas.itensFiltrados;
  const exibidos = useMemo(
    () => filtrados.slice(0, visiveisAteAqui),
    [filtrados, visiveisAteAqui]
  );
  const restantes = filtrados.length - exibidos.length;

  const contagemPorSeveridade = useMemo(() => {
    const contagem = new Map<Severidade, number>();
    for (const achado of achados) {
      contagem.set(achado.severidade, (contagem.get(achado.severidade) ?? 0) + 1);
    }
    return contagem;
  }, [achados]);

  /** Os atalhos de severidade escrevem no MESMO filtro de coluna do menu. */
  const alternarSeveridade = useCallback(
    (severidade: Severidade) => {
      const rotulo = ROTULO_SEVERIDADE[severidade];
      const atual = colunas.filtros.severidade ?? [];
      const jaSozinho = atual.length === 1 && atual[0] === rotulo;
      colunas.definir("severidade", jaSozinho ? null : [rotulo]);
    },
    [colunas]
  );

  const filtrosAtivos = useMemo(
    (): FiltroAtivo[] =>
      Object.entries(colunas.filtros).map(([id, valores]) => ({
        id,
        rotulo: COLUNAS_ACHADOS.find((c) => c.id === id)?.rotulo ?? id,
        valores,
        onRemover: () => colunas.definir(id, null),
      })),
    [colunas]
  );

  const areaRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <CampoBusca
          valor={busca}
          onChange={(valor) => {
            setBusca(valor);
            voltarAoInicio();
          }}
          placeholder="Busque por código, registro, regra ou mensagem…"
          rotulo="Buscar nos apontamentos da auditoria"
          atalhoGlobal
        />

        <div className="flex flex-wrap gap-2">
          {SEVERIDADES.map((severidade) => {
            const quantidade = contagemPorSeveridade.get(severidade) ?? 0;
            if (quantidade === 0) return null;

            const { classe, Icone } = ESTILO_SEVERIDADE[severidade];
            const marcada = colunas.filtros.severidade?.includes(ROTULO_SEVERIDADE[severidade]);

            return (
              <button
                key={severidade}
                type="button"
                onClick={() => alternarSeveridade(severidade)}
                aria-pressed={Boolean(marcada)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${classe} ${
                  marcada ? "ring-2 ring-accent ring-offset-1" : "opacity-90 hover:opacity-100"
                }`}
              >
                <Icone size={13} aria-hidden />
                {ROTULO_SEVERIDADE[severidade]}
                <span className="tabular-nums">{quantidade.toLocaleString("pt-BR")}</span>
              </button>
            );
          })}
        </div>
      </div>

      <BarraFiltros filtros={filtrosAtivos} onLimparTudo={colunas.limpar} />

      {/*
        Mesma anatomia da tabela de consulta: contêiner `relative` com a rolagem
        horizontal dentro e as setas por cima. A largura das colunas sai do
        CONTEÚDO, e não de uma grade fixa — era a grade que cortava a mensagem
        no meio da frase e deixava sobrando espaço nas colunas de código.
      */}
      <div className="relative overflow-hidden rounded-xl border border-border-subtle bg-surface-card shadow-(--shadow-card)">
        <div
          ref={areaRef}
          className="custom-scrollbar overflow-auto"
          style={{ maxHeight: "var(--altura-tabela)" }}
        >
          <table className="min-w-full text-left">
            <caption className="sr-only">
              Apontamentos da auditoria, do mais grave para o menos grave.
            </caption>

            <thead>
              <tr>
                {COLUNAS_ACHADOS.map((coluna, i) => (
                  <th
                    key={coluna.id}
                    scope="col"
                    className="sticky top-0 z-10 whitespace-nowrap bg-surface-head px-3 py-2 align-middle text-[11px] font-bold uppercase tracking-wider text-text-secondary shadow-(--shadow-header)"
                    style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                  >
                    <div className="flex items-center gap-1">
                      <span>{coluna.rotulo}</span>
                      {coluna.valores && (
                        <FiltroColuna
                          rotulo={coluna.rotulo}
                          opcoes={colunas.opcoesDe(coluna.id)}
                          selecionados={colunas.filtros[coluna.id]}
                          onChange={(valores) => colunas.definir(coluna.id, valores)}
                          alinharDireita={i >= COLUNAS_ACHADOS.length / 2}
                          descricao={DESCRICAO_DA_COLUNA[coluna.id]}
                        />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {exibidos.length > 0 ? (
                exibidos.map((achado) => (
                  <LinhaAchado key={achado.id} achado={achado} />
                ))
              ) : (
                <tr>
                  <td
                    colSpan={COLUNAS_ACHADOS.length}
                    className="h-[320px] px-6 text-center align-middle"
                  >
                    <SearchX className="mx-auto mb-3 h-8 w-8 text-text-tertiary" aria-hidden />
                    <p className="text-text-secondary">
                      Nenhum apontamento
                      {busca ? ` para “${busca}”` : " para este filtro"}
                    </p>
                    <p className="mt-1 text-sm text-text-tertiary">
                      Tente outro termo ou remova um filtro na barra acima.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <NavegacaoLateral area={areaRef} />
      </div>

      {restantes > 0 && (
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            onClick={() => setVisiveisAteAqui((atual) => atual + PAGINA)}
            className="rounded-xl border border-border-subtle bg-surface-card px-5 py-2.5 text-sm font-medium text-accent shadow-(--shadow-card) transition-colors hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Mostrar mais {Math.min(PAGINA, restantes)} de {restantes.toLocaleString("pt-BR")}
          </button>
        </div>
      )}

      <p className="text-xs text-text-tertiary" aria-live="polite">
        {filtrados.length.toLocaleString("pt-BR")} de {achados.length.toLocaleString("pt-BR")}{" "}
        {achados.length === 1 ? "apontamento" : "apontamentos"}
        {filtrados.length !== achados.length ? " com a busca e os filtros aplicados" : ""}
        {restantes > 0 ? ` — exibindo os primeiros ${exibidos.length.toLocaleString("pt-BR")}` : ""}.
      </p>
    </div>
  );
}

/**
 * Um apontamento na tabela.
 *
 * `align-top` porque a mensagem pode ocupar três linhas enquanto o resto ocupa
 * uma: alinhada ao meio, a severidade flutuaria longe do texto que ela
 * qualifica. É o mesmo alinhamento da tabela de consulta, pela mesma razão.
 */
function LinhaAchado({ achado }: { achado: Achado }) {
  const { classe, Icone } = ESTILO_SEVERIDADE[achado.severidade];

  return (
    <tr className="border-t border-border-subtle align-top transition-colors odd:bg-surface-page/50 hover:bg-surface-hover">
      <td className={celula("severidade")}>
        <span
          className={`inline-flex w-fit items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-bold ${classe}`}
        >
          <Icone size={12} aria-hidden />
          {ROTULO_SEVERIDADE[achado.severidade]}
        </span>
      </td>

      <td className={`${celula("linha")} font-mono text-xs text-text-tertiary tabular-nums`}>
        {achado.nl > 0 ? achado.nl.toLocaleString("pt-BR") : "—"}
      </td>

      {/*
        O número da nota é o que o contador leva para o ERP — o da linha só
        serve para abrir o .txt. Por isso ele vem em texto normal, e não
        esmaecido como a linha.
      */}
      <td
        className={`${celula("nota")} font-mono text-xs font-medium text-text-primary tabular-nums`}
        title={achado.documento ? `Documento nº ${achado.documento}` : undefined}
      >
        {achado.documento || "—"}
      </td>

      <td className={`${celula("registro")} font-mono text-xs font-medium text-text-secondary`}>
        {achado.reg || "—"}
      </td>

      <td className={`${celula("codigo")} font-mono text-xs font-semibold text-text-secondary`}>
        {achado.codigo}
      </td>

      <td className={`${celula("regra")} text-xs text-text-tertiary`}>{achado.regra}</td>

      <td className={`${celula("correcao")} text-xs`}>
        {achado.conserto === "automatica" ? (
          <span className="inline-flex items-center gap-1 rounded bg-success-soft px-2 py-0.5 font-medium text-success">
            <Wrench size={11} aria-hidden />
            Na regravação
          </span>
        ) : achado.conserto === "sugerida" ? (
          <span
            className="inline-flex items-center gap-1 rounded bg-warning-soft px-2 py-0.5 font-medium text-warning"
            title="A ferramenta calculou o valor, mas ele só entra no arquivo se você marcar a linha na grade acima."
          >
            <Wrench size={11} aria-hidden />
            Sugerida
          </span>
        ) : (
          <span
            className={`text-text-tertiary ${
              achado.motivoDoConserto ? "cursor-help underline decoration-dotted underline-offset-2" : ""
            }`}
            title={
              achado.motivoDoConserto ??
              "A auditoria não tem valor a propor para este apontamento: ele não sai de contar nem de somar o próprio arquivo. O conserto é no ERP, antes de gerar de novo."
            }
          >
            Manual, na origem
          </span>
        )}
      </td>

      {/*
        A mensagem é a única coluna que respira. Ela cresce até o limite e
        oferece "ver mais" — o mesmo componente da descrição na consulta. Antes
        ela era cortada numa altura fixa de linha, e o contador lia meia frase
        sobre o problema que veio conferir.
      */}
      <td className="min-w-[24rem] px-3 py-1.5 align-top">
        <DescricaoExpandivel
          texto={achado.mensagem}
          limiteCaracteres={180}
          className="text-sm text-text-secondary"
          /*
           * SEM realce de termos, e isto não é preferência estética.
           *
           * O destaque existe para o texto da Receita, onde "alíquota zero" e
           * "isenção" são benefícios — e os pinta com a pílula verde de
           * sucesso. Aqui a mesma palavra aparece dentro da acusação: "a
           * tributação 40 (Isenta) não comporta o ICMS próprio". Realçada de
           * verde, a palavra que nomeia o ERRO passa a parecer o benefício que
           * está tudo certo.
           */
          destacar={false}
        />
        {achado.esperado !== undefined && (
          <span className="mt-1 block text-xs text-text-tertiary">
            Informado <span className="font-mono">{achado.atual}</span> · calculado{" "}
            <span className="font-mono">{achado.esperado}</span>
          </span>
        )}
      </td>
    </tr>
  );
}

/** Padding de célula igual ao da consulta; as estreitas não quebram linha. */
function celula(id: string): string {
  return `px-3 py-1.5 align-top${ESTREITAS.has(id) ? " whitespace-nowrap" : ""}`;
}

const DESCRICAO_DA_COLUNA: Record<string, string> = {
  severidade:
    "Crítico e Erro reprovam a escrituração; Alerta pede conferência; Informativo só registra o que a auditoria não cobre.",
  nota: "Número do documento (NUM_DOC do C100) a que a linha pertence. Vazio nos registros que não pertencem a documento nenhum — cadastros, aberturas e fechamentos de bloco.",
  registro: "Registro do SPED em que o apontamento foi encontrado.",
  codigo:
    "Código estável da regra. EST são regras de estrutura, CAD de cadastro, FIS de classificação fiscal e AUD de falha do próprio motor.",
  regra: "Referência normativa ou o trecho do Guia Prático que sustenta o apontamento.",
  correcao:
    "Automática: a regravação do TXT já resolve. Sugerida: a ferramenta calculou o valor e espera sua aprovação na grade. Manual: precisa ser corrigido no sistema que gerou o arquivo.",
};
