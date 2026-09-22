"use client";

import { useMemo } from "react";
import { CheckCheck, Wrench } from "lucide-react";

import { TAMANHO_ICONE_FIXO } from "./colunasAchados";
import { idDaCorrecao, type Correcao } from "../regravacao/correcoes";

interface RevisaoCorrecoesProps {
  propostas: Correcao[];
  /** Ids aprovados — o que vai entrar no arquivo. */
  aprovadas: string[];
  onAlternar: (id: string, aprovada: boolean) => void;
  onAlternarCodigo: (codigo: string, aprovada: boolean) => void;
}

const ROTULO_CLASSE = {
  automatica: {
    texto: "automática",
    ajuda: "O valor certo é dedutível do próprio arquivo, sem decisão fiscal. Nasce aprovada; desmarque se quiser.",
    classe: "bg-success-soft text-success",
  },
  sugerida: {
    texto: "sugerida",
    ajuda: "Há uma decisão embutida. Nasce desmarcada; aprove só depois de conferir de → para.",
    classe: "bg-warning-soft text-warning",
  },
} as const;

/** O que a célula mostra quando o valor é o vazio ou o delimitador. */
function mostrar(valor: string, campo: string): string {
  if (campo === "(delimitador final)") return valor === "" ? "ausente" : valor;
  return valor === "" ? "(vazio)" : valor;
}

/**
 * Revisão das correções antes de gerar o arquivo.
 *
 * É o painel que a auditoria de planilhas tem e a de SPED não tinha: o
 * contador vê, item a item, o que vai mudar no arquivo que ele vai assinar —
 * linha, campo, de → para e o motivo — e decide. Nada entra no TXT sem passar
 * por aqui, e o TXT gerado volta com o relatório do que entrou.
 *
 * A diferença de meio é o que justifica o rigor: a planilha corrigida volta
 * ao ERP e passa por revisão humana; o TXT vai assinado à Receita. Gerar sem
 * ver o diff é assinar sem conferir.
 */
export function RevisaoCorrecoes({
  propostas,
  aprovadas,
  onAlternar,
  onAlternarCodigo,
}: RevisaoCorrecoesProps) {
  const marcadas = useMemo(() => new Set(aprovadas), [aprovadas]);

  const grupos = useMemo(() => {
    const porCodigo = new Map<string, Correcao[]>();
    for (const c of propostas) {
      const lista = porCodigo.get(c.codigo) ?? [];
      lista.push(c);
      porCodigo.set(c.codigo, lista);
    }
    return [...porCodigo.entries()].map(([codigo, itens]) => ({
      codigo,
      itens,
      classe: itens[0].classe,
      aprovadasNoGrupo: itens.filter((c) => marcadas.has(idDaCorrecao(c))).length,
    }));
  }, [propostas, marcadas]);

  if (propostas.length === 0) return null;

  const totalAprovadas = propostas.filter((c) => marcadas.has(idDaCorrecao(c))).length;
  const linhasNovas = propostas.filter((c) => c.tipo === "linha" && marcadas.has(idDaCorrecao(c))).length;

  return (
    <section
      aria-labelledby="titulo-revisao"
      className="flex flex-col gap-4 rounded-xl border border-border-subtle bg-surface-card p-4 shadow-(--shadow-card)"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
            <Wrench size={TAMANHO_ICONE_FIXO} className="shrink-0" aria-hidden />
          </span>
          <div>
            <h2 id="titulo-revisao" className="text-base font-semibold">
              Correções para o arquivo gerado
            </h2>
            <p className="mt-0.5 text-xs text-text-secondary">
              {totalAprovadas} de {propostas.length} aprovada{propostas.length === 1 ? "" : "s"}
              {linhasNovas > 0 && ` · ${linhasNovas} linha${linhasNovas === 1 ? "" : "s"} nova${linhasNovas === 1 ? "" : "s"}`}
              . Só o que está marcado entra no TXT; o resto sai como veio.
            </p>
          </div>
        </div>
      </div>

      <ul className="flex flex-col gap-3">
        {grupos.map((grupo) => {
          const rotulo = ROTULO_CLASSE[grupo.classe];
          const todas = grupo.aprovadasNoGrupo === grupo.itens.length;
          const nenhuma = grupo.aprovadasNoGrupo === 0;

          return (
            <li key={grupo.codigo} className="rounded-lg border border-border-subtle">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle bg-surface-page/60 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono text-xs font-semibold text-text-primary">{grupo.codigo}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${rotulo.classe}`}
                    title={rotulo.ajuda}
                  >
                    {rotulo.texto}
                  </span>
                  <span className="text-xs text-text-tertiary">
                    {grupo.aprovadasNoGrupo} de {grupo.itens.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onAlternarCodigo(grupo.codigo, !todas)}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <CheckCheck size={TAMANHO_ICONE_FIXO} className="shrink-0" aria-hidden />
                  {todas ? "Desmarcar todas" : nenhuma ? "Aprovar todas" : "Aprovar as restantes"}
                </button>
              </div>

              <p className="px-3 pt-2 text-xs text-text-secondary">{grupo.itens[0].motivo}</p>

              <ul className="flex max-h-64 flex-col overflow-y-auto px-1 py-1 text-xs">
                {grupo.itens.map((c) => {
                  const id = idDaCorrecao(c);
                  const marcada = marcadas.has(id);
                  return (
                    <li key={id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 hover:bg-surface-page">
                        <input
                          type="checkbox"
                          checked={marcada}
                          onChange={(e) => onAlternar(id, e.target.checked)}
                          className="shrink-0 rounded border-border-strong text-accent focus:ring-accent"
                        />
                        <span className="w-16 shrink-0 font-mono tabular-nums text-text-tertiary">
                          {c.tipo === "campo" ? `L ${c.nl.toLocaleString("pt-BR")}` : `após L ${c.apos.toLocaleString("pt-BR")}`}
                        </span>
                        <span className="w-12 shrink-0 font-mono text-text-secondary">{c.reg}</span>
                        {c.tipo === "campo" ? (
                          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2">
                            <span className="text-text-secondary">{c.campo}</span>
                            <span className="font-mono text-danger line-through decoration-danger/50">
                              {mostrar(c.de, c.campo)}
                            </span>
                            <span aria-hidden className="text-text-tertiary">→</span>
                            <span className="font-mono font-medium text-success">{mostrar(c.para, c.campo)}</span>
                          </span>
                        ) : (
                          <span className="min-w-0 flex-1 font-mono text-success">
                            + {c.campos.join("|")}
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
