"use client";

import { Check, Eraser, Wrench } from "lucide-react";

import type { Severidade } from "@/regras/nucleo/contrato";
import {
  SEVERIDADES,
  type RecorteDaGrade,
  type ResumoDoRecorte,
} from "../auditoria/recorte";
import { ESTILO_SEVERIDADE, ROTULO_SEVERIDADE } from "./colunasAchados";

interface FiltroDeLinhasProps {
  recorte: RecorteDaGrade;
  resumo: ResumoDoRecorte;
  onAlternarSeveridade: (severidade: Severidade, marcada: boolean) => void;
  onAlternarCorrigidas: (marcada: boolean) => void;
  onLimpar: () => void;
}

/**
 * O recorte da grade por apontamento e por correção.
 *
 * Cada marcação ACRESCENTA linhas à tela — "Erro" mais "Corrigidas" mostra as
 * duas coisas, e não a interseção. É a leitura que serve à conferência: quem
 * acabou de mandar corrigir quer reler aquelas linhas sem perder de vista os
 * erros que ainda não resolveu.
 *
 * O número de cada selo é de LINHAS, não de apontamentos: ele promete o tamanho
 * do recorte, e uma linha com três erros continua sendo uma linha na grade.
 *
 * Severidade sem nenhuma linha fica DESABILITADA em vez de sumir. Sumir mudaria
 * a largura e a ordem dos selos a cada arquivo, e o contador que procura "Erro"
 * onde ele estava ontem encontraria "Alerta" — some o controle e some também a
 * informação de que aquele arquivo não tem nenhum erro, que é uma boa notícia
 * que vale a pena dar.
 */
export function FiltroDeLinhas({
  recorte,
  resumo,
  onAlternarSeveridade,
  onAlternarCorrigidas,
  onLimpar,
}: FiltroDeLinhasProps) {
  const marcadas = new Set(recorte.severidades);
  const ativo = marcadas.size > 0 || recorte.corrigidas;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {/*
        DOIS EIXOS, e eles não são a mesma pergunta.

        As severidades dizem O QUE A AUDITORIA ACHOU; as correções dizem O QUE
        JÁ TEM CONSERTO. Enfileirados sob um rótulo só, os cinco selos liam-se
        como cinco severidades — e "Corrigidas" virava uma categoria de problema
        que não existe. O separador e o rótulo próprio são o que desfaz isso.
      */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium text-text-tertiary">Apontamentos</span>

        {SEVERIDADES.map((severidade) => {
          const linhas = resumo.linhasPorSeveridade[severidade];
          const { classe, Icone } = ESTILO_SEVERIDADE[severidade];
          const marcada = marcadas.has(severidade);
          const rotulo = ROTULO_SEVERIDADE[severidade];

          return (
            <button
              key={severidade}
              type="button"
              disabled={linhas === 0}
              aria-pressed={marcada}
              onClick={() => onAlternarSeveridade(severidade, !marcada)}
              title={
                linhas === 0
                  ? `Nenhuma linha com apontamento de severidade ${rotulo.toLowerCase()}`
                  : `${linhas.toLocaleString("pt-BR")} ${linhas === 1 ? "linha" : "linhas"} com apontamento ${rotulo.toLowerCase()}`
              }
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40 ${classe} ${
                marcada ? "ring-2 ring-accent ring-offset-1" : "opacity-90 hover:opacity-100"
              }`}
            >
              <Icone size={13} aria-hidden />
              {rotulo}
              <span className="tabular-nums">{linhas.toLocaleString("pt-BR")}</span>
            </button>
          );
        })}
      </div>

      <span className="hidden h-6 w-px shrink-0 bg-border-subtle sm:block" aria-hidden />

      <Correcoes
        resumo={resumo}
        marcada={recorte.corrigidas}
        onAlternar={onAlternarCorrigidas}
      />

      {ativo && (
        <button
          type="button"
          onClick={onLimpar}
          className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Eraser size={12} aria-hidden />
          Ver o arquivo inteiro
        </button>
      )}
    </div>
  );
}

/**
 * O estado das correções do arquivo, e o atalho para isolá-las.
 *
 * Mostra DOIS números porque são dois fatos, e o segundo é o que pede ação:
 * quantas linhas já vão para o arquivo gerado, e quantas ainda esperam sua
 * decisão. A versão anterior contava só as aprovadas — num arquivo com três
 * sugestões e nenhuma aprovada, ela dizia "Corrigidas 0", que se lê como "não
 * há correção nenhuma" quando havia três esperando.
 *
 * Não tem cor de severidade: correção não é problema. O verde é do que já está
 * resolvido; o azul, do que falta decidir.
 */
function Correcoes({
  resumo,
  marcada,
  onAlternar,
}: {
  resumo: ResumoDoRecorte;
  marcada: boolean;
  onAlternar: (marcada: boolean) => void;
}) {
  const aDecidir = Math.max(0, resumo.linhasComProposta - resumo.linhasAprovadas);
  const vazio = resumo.linhasComProposta === 0;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-text-tertiary">Correções</span>

      <button
        type="button"
        disabled={vazio}
        aria-pressed={marcada}
        onClick={() => onAlternar(!marcada)}
        title={
          vazio
            ? "Nenhuma linha deste arquivo tem correção proposta."
            : `${resumo.linhasAprovadas} de ${resumo.linhasComProposta} ${
                resumo.linhasComProposta === 1 ? "linha corrigível aprovada" : "linhas corrigíveis aprovadas"
              }. Clique para ver só estas linhas na grade.`
        }
        className={`inline-flex items-center gap-2 rounded-lg border px-2 py-1 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40 ${
          marcada
            ? "border-accent bg-accent-soft ring-2 ring-accent ring-offset-1"
            : "border-border-strong bg-surface-card hover:bg-surface-page"
        }`}
      >
        <Wrench size={13} className="shrink-0 text-text-tertiary" aria-hidden />

        {vazio ? (
          <span className="font-medium text-text-tertiary">nenhuma</span>
        ) : (
          <>
            <span className="inline-flex items-center gap-1 font-semibold text-success">
              <Check size={12} aria-hidden />
              <span className="tabular-nums">{resumo.linhasAprovadas.toLocaleString("pt-BR")}</span>
              aprovadas
            </span>

            {aDecidir > 0 && (
              <>
                <span className="text-border-strong" aria-hidden>
                  ·
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-accent">
                  <span className="tabular-nums">{aDecidir.toLocaleString("pt-BR")}</span>
                  a decidir
                </span>
              </>
            )}
          </>
        )}
      </button>
    </div>
  );
}
