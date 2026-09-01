"use client";

import {
  ROTULO_STATUS_NATUREZA,
  statusNatureza,
  type LinhaAuditada,
  type StatusNatureza,
} from "@/lib/auditoria";
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
  /** Quando true, a coluna "Informado" exibe o CST corrigido ao lado do original. */
  criterioCorrecaoAtivo?: boolean;
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

/** O selo da natureza repete o texto da opção de filtro — verde quando o
 *  critério resolveu a linha, vermelho quando invalidou a natureza informada. */
const ESTILO_STATUS_NATUREZA: Record<StatusNatureza, string> = {
  corrigida: "bg-success-soft text-success",
  coerente: "bg-success-soft text-success",
  invalida: "bg-danger-soft text-danger",
};

const ESTILO_SELO: Record<LinhaAuditada["situacao"], string> = {
  beneficio: "bg-success-soft text-success",
  possivel: "bg-accent-soft text-accent",
  tributado: "bg-badge-ncm-bg text-badge-ncm-text",
  invalido: "bg-danger text-accent-contrast",
};

function Codigo({ valor }: { valor: string }) {
  return valor ? (
    <span className="font-mono">{valor}</span>
  ) : (
    <span className="text-text-tertiary">—</span>
  );
}

/** Mostra o CST original e, quando a correção está ativa, o corrigido ao lado. */
function CelulaCst({
  cstPis,
  cstCofins,
  cfop,
  cstCorrigido,
  criterioAtivo,
}: {
  cstPis: string;
  cstCofins: string;
  cfop: string;
  cstCorrigido?: string;
  criterioAtivo: boolean;
}) {
  const mudou =
    criterioAtivo &&
    cstCorrigido !== undefined &&
    cstCorrigido !== "" &&
    (cstPis !== cstCorrigido || cstCofins !== cstCorrigido);

  return (
    <div className="flex flex-col gap-0.5">
      {/* CST PIS / COFINS */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-xs text-text-tertiary">CST </span>
        {mudou ? (
          <>
            <span className="font-mono line-through text-text-tertiary">
              {cstPis || "—"}
            </span>
            <span className="text-text-tertiary">/</span>
            <span className="font-mono line-through text-text-tertiary">
              {cstCofins || "—"}
            </span>
            <span className="mx-1 text-text-tertiary">→</span>
            <span className="font-mono font-semibold text-success">
              {cstCorrigido}
            </span>
          </>
        ) : (
          <>
            <Codigo valor={cstPis} />{" "}
            <span className="text-text-tertiary">/</span>{" "}
            <Codigo valor={cstCofins} />
          </>
        )}
      </div>

      {/* CFOP */}
      {cfop && (
        <div>
          <span className="text-xs text-text-tertiary">CFOP </span>
          <Codigo valor={cfop} />
        </div>
      )}

      {/* Badge de correção aplicada */}
      {mudou && (
        <span className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-full bg-success-soft px-1.5 py-0.5 text-[10px] font-medium text-success">
          ✓ corrigido
        </span>
      )}

      {/* NCM inválido não corrigido */}
      {criterioAtivo && cstCorrigido === "" && (
        <span className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-full bg-danger-soft px-1.5 py-0.5 text-[10px] font-medium text-danger">
          NCM inválido
        </span>
      )}
    </div>
  );
}

/**
 * A natureza da receita como a planilha trouxe, o que o SPED indica para o NCM
 * e, com o critério de correção ligado, o que ele fez com ela.
 *
 * A natureza sugerida vem junto porque é aqui que ela se compara com a
 * informada — na coluna "Sugestão do SPED" ela fica longe do número do cliente.
 * O selo usa o mesmo texto que o menu da coluna oferece como filtro, então
 * marcar "Natureza Corrigida" devolve exatamente as linhas que mostram o selo.
 */
function CelulaNatureza({
  natureza,
  naturezaCorrigida,
  sugeridas,
  status,
}: {
  natureza: string;
  naturezaCorrigida?: string;
  /** Naturezas que o SPED admite para o NCM — as mesmas da regra sugerida. */
  sugeridas: string[];
  status: StatusNatureza | null;
}) {
  // Só há transição a mostrar quando o valor mudou: "corrigida" troca o código,
  // "invalida" apaga o que a planilha trazia. "coerente" repetiria o mesmo
  // número dos dois lados da seta.
  const mudou = status === "corrigida" || status === "invalida";

  // Só o que a célula ainda não mostra: numa linha já coerente o SPED indica
  // justamente o número que está ali, e repeti-lo embaixo não diz nada.
  const naTela = new Set([natureza, naturezaCorrigida].filter(Boolean));
  const aIndicar = sugeridas.filter((n) => n && !naTela.has(n));

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1 flex-wrap">
        {mudou ? (
          <>
            <span className="font-mono line-through text-text-tertiary">
              {natureza || "—"}
            </span>
            <span className="text-text-tertiary">→</span>
            <span className={`font-mono font-semibold ${naturezaCorrigida ? "text-success" : "text-text-tertiary"}`}>
              {naturezaCorrigida || "vazia"}
            </span>
          </>
        ) : (
          <Codigo valor={natureza} />
        )}
      </div>

      {aIndicar.length > 0 && (
        <div className="text-[11px] text-text-tertiary">
          SPED: <span className="font-mono">{aIndicar.join(" / ")}</span>
        </div>
      )}

      {status && (
        <span
          className={`mt-0.5 inline-flex w-fit items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${ESTILO_STATUS_NATUREZA[status]}`}
        >
          {ROTULO_STATUS_NATUREZA[status]}
        </span>
      )}
    </div>
  );
}

/** Auditoria linha a linha. Vermelho = NCM inválido; amarelo = divergência. */
export function TabelaAuditoria({
  linhas,
  colunas,
  filtros,
  opcoesDe,
  onFiltrar,
  criterioCorrecaoAtivo = false,
}: TabelaAuditoriaProps) {
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
            Auditoria linha a linha: linhas vermelhas têm NCM inválido;
            amarelas, divergência entre o informado e o SPED.
          </caption>
          <thead className="bg-surface-head">
            <tr>
              {colunas.map((coluna, i) => (
                <th
                  key={coluna.id}
                  scope="col"
                  className="px-3 py-3.5 text-left text-xs font-bold text-text-secondary uppercase tracking-widest whitespace-nowrap first:pl-4 align-middle"
                  style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                >
                  <div className="flex items-center gap-1">
                    <span>
                      {coluna.rotulo === "Informado" && criterioCorrecaoAtivo
                        ? "Informado → Corrigido"
                        : coluna.rotulo}
                    </span>
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
                <td
                  colSpan={colunas.length}
                  className="h-[400px] px-6 text-center align-middle text-text-secondary"
                >
                  <p className="text-base font-medium">
                    Nenhuma linha neste filtro.
                  </p>
                  <p className="text-sm text-text-tertiary mt-1">
                    Remova um filtro na barra acima para ver os resultados.
                  </p>
                </td>
              </tr>
            ) : (
              linhas.map((l) => (
                <tr
                  key={l.linha}
                  className={`align-top ${ESTILO_LINHA[l.destaque]}`}
                >
                  <td className="px-3 py-2.5 whitespace-nowrap font-mono text-text-tertiary">
                    {l.linha}
                  </td>

                  <td className="px-3 py-2.5 min-w-[200px] max-w-56 lg:max-w-md xl:max-w-xl 2xl:max-w-3xl">
                    <DescricaoExpandivel
                      texto={l.nome}
                      limiteCaracteres={100}
                      className="text-text-primary"
                      destacar={false}
                    />
                    {l.descricaoNcm && (
                      <div className="mt-0.5">
                        <DescricaoExpandivel
                          texto={`NCM: ${l.descricaoNcm}`}
                          limiteCaracteres={100}
                          className="text-xs text-text-tertiary"
                        />
                      </div>
                    )}
                  </td>

                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="font-mono rounded bg-badge-ncm-bg px-1.5 py-0.5 text-badge-ncm-text">
                      {l.ncm || l.classificacaoOriginal || "—"}
                    </span>
                    {l.ncm &&
                      l.classificacaoOriginal.replace(/\D/g, "") !== l.ncm && (
                        <div className="mt-0.5 text-xs text-text-tertiary">
                          de "{l.classificacaoOriginal}"
                        </div>
                      )}
                  </td>

                  {/* Coluna "Informado → Corrigido" quando critério ativo */}
                  <td className="px-3 py-2.5 whitespace-nowrap text-text-secondary">
                    <CelulaCst
                      cstPis={l.cstPis}
                      cstCofins={l.cstCofins}
                      cfop={l.cfop}
                      cstCorrigido={l.cstCorrigido}
                      criterioAtivo={criterioCorrecaoAtivo}
                    />
                  </td>

                  {/* Coluna "Nat. Receita" */}
                  <td className="px-3 py-2.5 whitespace-nowrap text-text-secondary">
                    <CelulaNatureza
                      natureza={l.natureza}
                      naturezaCorrigida={l.naturezaCorrigida}
                      sugeridas={l.regra?.naturezas ?? []}
                      status={statusNatureza(l)}
                    />
                  </td>

                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ESTILO_SELO[l.situacao]}`}
                    >
                      {l.rotulo}
                    </span>
                    {/* Quando o critério está ativo e a linha tem um CST corrigido
                        (seja para o benefício ou para tributado), o status final
                        é "Coerente com o critério" — a decisão já foi tomada. */}
                    {criterioCorrecaoAtivo &&
                      l.cstCorrigido !== undefined &&
                      l.situacao !== "invalido" && (
                        <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-success-soft px-1.5 py-0.5 text-[10px] font-medium text-success">
                          <span>✓</span>
                          <span>Coerente com o critério</span>
                        </div>
                      )}
                  </td>

                  <td className="px-3 py-2.5 min-w-48 max-w-72">
                    {/* Com o critério ligado, a linha requalificada não mostra mais a
                        regra das outras tabelas: o critério mandou ignorá-las, e
                        exibir "CST 03/04" ao lado de um CST corrigido para 01 (ou 06)
                        só faz o contador duvidar da correção que ele mesmo pediu. */}
                    {criterioCorrecaoAtivo && l.cstCorrigido === "01" ? (
                      <span className="inline-flex w-fit items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-medium text-success">
                        Tratado como tributado (CST 01)
                      </span>
                    ) : l.regra ? (
                      <div className="flex flex-col gap-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-text-tertiary">
                            CST
                          </span>
                          {l.regra.cstsAceitos.map((cst) => (
                            <span
                              key={cst}
                              className="font-mono rounded bg-badge-cst-bg px-1.5 py-0.5 text-xs font-medium text-badge-cst-text"
                            >
                              {cst}
                            </span>
                          ))}
                          {l.regra.naturezas.length > 0 && (
                            <>
                              <span className="text-xs text-text-tertiary">
                                · nat.
                              </span>
                              <span className="font-mono text-xs font-medium">
                                {l.regra.naturezas.join(" / ")}
                              </span>
                            </>
                          )}
                          <span className="text-xs text-text-tertiary">
                            · tabela {l.regra.tabela}
                          </span>
                        </div>
                        <div
                          className="line-clamp-2 text-xs text-text-secondary"
                          title={l.regra.descricao}
                        >
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
                      <span className="text-xs text-success">
                        Coerente com o SPED
                      </span>
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
