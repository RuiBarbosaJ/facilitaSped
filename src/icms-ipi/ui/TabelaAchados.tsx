"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertTriangle, Info, ShieldAlert, Wrench } from "lucide-react";

import { BarraFiltros, type FiltroAtivo } from "@/componentes/BarraFiltros";
import { CampoBusca } from "@/componentes/CampoBusca";
import { NavegacaoLateral } from "@/componentes/NavegacaoLateral";
import { FiltroColuna } from "@/componentes/FiltroColuna";
import { useFiltrosColuna } from "@/ganchos/useFiltrosColuna";
import {
  COLUNAS_ACHADOS,
  ORDEM_SEVERIDADE,
  ROTULO_SEVERIDADE,
  textoDoAchado,
} from "./colunasAchados";
import type { Achado, Severidade } from "@/regras/nucleo/contrato";

const ALTURA_DA_LINHA = 60;

/**
 * A severidade nunca é comunicada só pela cor: um auditor com daltonismo — ou
 * lendo o relatório impresso — precisa separar o que reprova a entrega do que é
 * informativo. Daí rótulo em texto e ícone próprio, além da cor.
 */
const ESTILO: Record<Severidade, { classe: string; Icone: typeof AlertTriangle }> = {
  critico: { classe: "border-danger/30 bg-danger-soft text-danger", Icone: ShieldAlert },
  erro: { classe: "border-danger/30 bg-danger-soft text-danger", Icone: AlertTriangle },
  alerta: { classe: "border-warning/30 bg-warning-soft text-warning", Icone: AlertTriangle },
  info: { classe: "border-accent/30 bg-accent-soft text-accent", Icone: Info },
};

const SEVERIDADES: Severidade[] = ["critico", "erro", "alerta", "info"];

/** Larguras da grade — as mesmas no cabeçalho e nas linhas. */
const GRADE = "grid-cols-[9.5rem_5rem_6rem_7.5rem_11rem_10rem_minmax(20rem,1fr)]";

export function TabelaAchados({ achados }: { achados: Achado[] }) {
  const [busca, setBusca] = useState("");

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

  const colunas = useFiltrosColuna(encontrados, COLUNAS_ACHADOS, "icms_ipi_achados_filtros");
  const visiveis = colunas.itensFiltrados;

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
  const rolagemRef = useRef<HTMLDivElement>(null);
  const virtualizador = useVirtualizer({
    count: visiveis.length,
    getScrollElement: () => areaRef.current,
    estimateSize: () => ALTURA_DA_LINHA,
    overscan: 8,
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <CampoBusca
          valor={busca}
          onChange={setBusca}
          placeholder="Busque por código, registro, regra ou mensagem…"
          rotulo="Buscar nos apontamentos da auditoria"
        />

        <div className="flex flex-wrap gap-2">
          {SEVERIDADES.map((severidade) => {
            const quantidade = contagemPorSeveridade.get(severidade) ?? 0;
            if (quantidade === 0) return null;

            const { classe, Icone } = ESTILO[severidade];
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

      <div className="relative overflow-hidden rounded-xl border border-border-subtle bg-surface-card shadow-(--shadow-card)">
        <div ref={rolagemRef} className="overflow-x-auto">
          <div className="min-w-304">
            <div
              role="row"
              className={`grid ${GRADE} gap-3 border-b border-border-subtle bg-surface-head px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-text-secondary`}
            >
              {COLUNAS_ACHADOS.map((coluna) => (
                <div key={coluna.id} className="flex items-center gap-1.5">
                  <span className="truncate">{coluna.rotulo}</span>
                  {coluna.valores && (
                    <FiltroColuna
                      rotulo={coluna.rotulo}
                      opcoes={colunas.opcoesDe(coluna.id)}
                      selecionados={colunas.filtros[coluna.id]}
                      onChange={(valores) => colunas.definir(coluna.id, valores)}
                      alinharDireita={coluna.id === "correcao" || coluna.id === "regra"}
                      descricao={DESCRICAO_DA_COLUNA[coluna.id]}
                    />
                  )}
                </div>
              ))}
            </div>

            <div
              ref={areaRef}
              role="region"
              aria-label="Apontamentos da auditoria"
              tabIndex={0}
              className="custom-scrollbar max-h-120 overflow-y-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
            >
              {visiveis.length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-text-secondary">
                  Nenhum apontamento corresponde à busca e aos filtros.
                </p>
              ) : (
                <ul
                  className="relative m-0 list-none p-0"
                  style={{ height: `${virtualizador.getTotalSize()}px` }}
                >
                  {virtualizador.getVirtualItems().map((item) => {
                    const achado = visiveis[item.index];
                    const { classe, Icone } = ESTILO[achado.severidade];

                    return (
                      <li
                        key={achado.id}
                        className={`absolute left-0 top-0 grid w-full ${GRADE} items-start gap-3 border-b border-border-subtle px-4 py-3 text-sm`}
                        style={{ height: `${item.size}px`, transform: `translateY(${item.start}px)` }}
                      >
                        <span
                          className={`inline-flex h-fit w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold ${classe}`}
                        >
                          <Icone size={12} aria-hidden />
                          {ROTULO_SEVERIDADE[achado.severidade]}
                        </span>

                        <span className="font-mono text-xs text-text-tertiary tabular-nums">
                          {achado.nl > 0 ? achado.nl.toLocaleString("pt-BR") : "—"}
                        </span>

                        <span className="font-mono text-xs font-medium text-text-secondary">
                          {achado.reg || "—"}
                        </span>

                        <span className="font-mono text-xs font-semibold text-text-secondary">
                          {achado.codigo}
                        </span>

                        <span className="truncate text-xs text-text-tertiary" title={achado.regra}>
                          {achado.regra}
                        </span>

                        <span className="text-xs">
                          {achado.corrigivel ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 font-medium text-success">
                              <Wrench size={11} aria-hidden />
                              Na regravação
                            </span>
                          ) : (
                            <span className="text-text-tertiary">Manual, na origem</span>
                          )}
                        </span>

                        <span className="text-text-secondary">
                          {achado.mensagem}
                          {achado.esperado !== undefined && (
                            <span className="mt-0.5 block text-xs text-text-tertiary">
                              Informado <span className="font-mono">{achado.atual}</span> · calculado{" "}
                              <span className="font-mono">{achado.esperado}</span>
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        <NavegacaoLateral area={rolagemRef} />
      </div>

      <p className="text-xs text-text-tertiary" aria-live="polite">
        {visiveis.length.toLocaleString("pt-BR")} de {achados.length.toLocaleString("pt-BR")}{" "}
        {achados.length === 1 ? "apontamento" : "apontamentos"}
        {visiveis.length !== achados.length ? " com a busca e os filtros aplicados" : ""}.
      </p>
    </div>
  );
}

const DESCRICAO_DA_COLUNA: Record<string, string> = {
  severidade:
    "Crítico e Erro reprovam a escrituração; Alerta pede conferência; Informativo só registra o que a auditoria não cobre.",
  registro: "Registro do SPED em que o apontamento foi encontrado.",
  codigo:
    "Código estável da regra. EST são regras de estrutura, CAD de cadastro, FIS de classificação fiscal e AUD de falha do próprio motor.",
  regra: "Referência normativa ou o trecho do Guia Prático que sustenta o apontamento.",
  correcao:
    "Automática: a regravação do TXT já resolve. Manual: precisa ser corrigido no sistema que gerou o arquivo.",
};
