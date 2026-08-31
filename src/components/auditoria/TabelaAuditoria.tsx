"use client";

import type { LinhaAuditada } from "@/lib/auditoria";
import type { ColunaAuditoria } from "@/lib/colunasAuditoria";
import type { FiltrosColuna } from "@/lib/filtrosColuna";
import { DescricaoExpandivel } from "../DescricaoExpandivel";
import { FiltroColuna } from "../FiltroColuna";

interface TabelaAuditoriaProps {
  /** Só a fatia que deve ser exibida. */
  linhas: LinhaAuditada[];
  colunas: ColunaAuditoria[];
  filtros: FiltrosColuna;
  opcoesDe: (id: string) => string[];
  onFiltrar: (id: string, valores: string[] | null) => void;
}

/**
 * Além do fundo, uma borda à esquerda: no tema escuro os tons suaves quase se
 * confundem com a superfície, e a borda garante que a linha se destaque.
 */
const ESTILO_LINHA: Record<LinhaAuditada["destaque"], string> = {
  nenhum: "border-l-4 border-l-transparent",
  amarelo: "bg-warning-soft border-l-4 border-l-warning",
  vermelho: "bg-danger-soft border-l-4 border-l-danger",
};

const ESTILO_SELO: Record<LinhaAuditada["situacao"], string> = {
  beneficio: "bg-success-soft text-success",
  possivel: "bg-accent-soft text-accent",
  tributado: "bg-badge-ncm-bg text-badge-ncm-text",
  invalido: "bg-danger text-accent-contrast",
};

function Codigo({ valor }: { valor: string }) {
  return valor ? <span className="font-mono">{valor}</span> : <span className="text-text-tertiary">—</span>;
}

/** Auditoria linha a linha. Vermelho = NCM inválido; amarelo = divergência. */
export function TabelaAuditoria({ linhas, colunas, filtros, opcoesDe, onFiltrar }: TabelaAuditoriaProps) {
  return (
    <div className="bg-surface-card rounded-xl shadow-(--shadow-card) overflow-hidden">
      <div
        className="overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
        role="region"
        aria-label="Resultado da auditoria"
        tabIndex={0}
      >
        <table className="min-w-full text-left text-sm">
          <caption className="sr-only">
            Auditoria linha a linha: linhas vermelhas têm NCM inválido; amarelas, divergência entre o informado e o SPED.
          </caption>
          <thead className="bg-surface-head">
            <tr>
              {colunas.map((coluna, i) => (
                <th
                  key={coluna.id}
                  scope="col"
                  className="px-3 py-3.5 text-left text-xs font-bold text-text-secondary uppercase tracking-widest whitespace-nowrap first:pl-4 align-middle"
                  style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                >
                  <div className="flex items-center gap-1">
                    <span>{coluna.rotulo}</span>
                    {coluna.valores && (
                      <FiltroColuna
                        rotulo={coluna.rotulo}
                        opcoes={opcoesDe(coluna.id)}
                        selecionados={filtros[coluna.id]}
                        onChange={(valores) => onFiltrar(coluna.id, valores)}
                        alinharDireita={i >= colunas.length / 2}
                      />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={colunas.length} className="h-[400px] px-6 text-center align-middle text-text-secondary">
                  <p className="text-base font-medium">Nenhuma linha neste filtro.</p>
                  <p className="text-sm text-text-tertiary mt-1">Remova um filtro na barra acima para ver os resultados.</p>
                </td>
              </tr>
            ) : (
              linhas.map((l) => (
                <tr key={l.linha} className={`align-top ${ESTILO_LINHA[l.destaque]}`}>
                  <td className="px-3 py-2.5 whitespace-nowrap font-mono text-text-tertiary">{l.linha}</td>

                  <td className="px-3 py-2.5 min-w-[200px] max-w-56 lg:max-w-md xl:max-w-xl 2xl:max-w-3xl">
                    <DescricaoExpandivel texto={l.nome} limiteCaracteres={100} className="text-text-primary" destacar={false} />
                    {l.descricaoNcm && (
                      <div className="mt-0.5">
                        <DescricaoExpandivel texto={`NCM: ${l.descricaoNcm}`} limiteCaracteres={100} className="text-xs text-text-tertiary" />
                      </div>
                    )}
                  </td>

                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="font-mono rounded bg-badge-ncm-bg px-1.5 py-0.5 text-badge-ncm-text">
                      {l.ncm || l.classificacaoOriginal || "—"}
                    </span>
                    {l.ncm && l.classificacaoOriginal.replace(/\D/g, "") !== l.ncm && (
                      <div className="mt-0.5 text-xs text-text-tertiary">de “{l.classificacaoOriginal}”</div>
                    )}
                  </td>

                  <td className="px-3 py-2.5 whitespace-nowrap text-text-secondary">
                    <div>
                      <span className="text-xs text-text-tertiary">CST </span>
                      <Codigo valor={l.cstPis} /> <span className="text-text-tertiary">/</span> <Codigo valor={l.cstCofins} />
                    </div>
                    <div>
                      <span className="text-xs text-text-tertiary">nat. </span>
                      <Codigo valor={l.natureza} />
                    </div>
                    {l.cfop && (
                      <div>
                        <span className="text-xs text-text-tertiary">CFOP </span>
                        <Codigo valor={l.cfop} />
                      </div>
                    )}
                  </td>

                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ESTILO_SELO[l.situacao]}`}>
                      {l.rotulo}
                    </span>
                  </td>

                  <td className="px-3 py-2.5 min-w-48 max-w-72">
                    {l.regra ? (
                      <div className="flex flex-col gap-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-text-tertiary">CST</span>
                          {l.regra.cstsAceitos.map((cst) => (
                            <span key={cst} className="font-mono rounded bg-badge-cst-bg px-1.5 py-0.5 text-xs font-medium text-badge-cst-text">
                              {cst}
                            </span>
                          ))}
                          {l.regra.naturezas.length > 0 && (
                            <>
                              <span className="text-xs text-text-tertiary">· nat.</span>
                              <span className="font-mono text-xs font-medium">{l.regra.naturezas.join(" / ")}</span>
                            </>
                          )}
                          <span className="text-xs text-text-tertiary">· tabela {l.regra.tabela}</span>
                        </div>
                        <div className="line-clamp-2 text-xs text-text-secondary" title={l.regra.descricao}>
                          {l.regra.descricao}
                        </div>
                      </div>
                    ) : (
                      <span className="text-text-tertiary">—</span>
                    )}
                  </td>

                  <td className="px-3 py-2.5 min-w-64 max-w-md">
                    {l.observacoes.length > 0 ? (
                      <ul className="flex flex-col gap-0.5 text-xs text-text-secondary">
                        {l.observacoes.map((o) => (
                          <li key={o}>{o}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-xs text-success">Coerente com o SPED</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
