import type { LinhaAuditada } from "@/lib/auditoria";

interface TabelaAuditoriaProps {
  linhas: LinhaAuditada[];
}

const COLUNAS = ["Linha", "Produto", "Classificação", "Informado", "Situação", "Sugestão do SPED", "Observações"];

const ESTILO_LINHA: Record<LinhaAuditada["destaque"], string> = {
  nenhum: "",
  amarelo: "bg-warning-soft",
  vermelho: "bg-danger-soft",
};

const ESTILO_SELO: Record<LinhaAuditada["situacao"], string> = {
  beneficio: "bg-success-soft text-success",
  tributado: "bg-badge-ncm-bg text-badge-ncm-text",
  invalido: "bg-danger text-accent-contrast",
};

function Codigo({ valor }: { valor: string }) {
  return valor ? <span className="font-mono">{valor}</span> : <span className="text-text-tertiary">—</span>;
}

/** Auditoria linha a linha. Vermelho = NCM inválido; amarelo = divergência. */
export function TabelaAuditoria({ linhas }: TabelaAuditoriaProps) {
  return (
    <div className="bg-surface-card rounded-xl border border-border-subtle shadow-(--shadow-card) overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-surface-head">
            <tr>
              {COLUNAS.map((coluna) => (
                <th
                  key={coluna}
                  scope="col"
                  className="px-3 py-2.5 text-xs font-semibold text-text-tertiary uppercase tracking-wider whitespace-nowrap"
                >
                  {coluna}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={COLUNAS.length} className="px-6 py-12 text-center text-text-secondary">
                  Nenhuma linha neste filtro.
                </td>
              </tr>
            ) : (
              linhas.map((l) => (
                <tr key={l.linha} className={`align-top ${ESTILO_LINHA[l.destaque]}`}>
                  <td className="px-3 py-2.5 whitespace-nowrap font-mono text-text-tertiary">{l.linha}</td>

                  <td className="px-3 py-2.5 min-w-40 max-w-56">
                    <div className="line-clamp-2 text-text-primary" title={l.nome}>
                      {l.nome || <span className="text-text-tertiary">—</span>}
                    </div>
                    {l.descricaoNcm && (
                      <div className="mt-0.5 line-clamp-1 text-xs text-text-tertiary" title={l.descricaoNcm}>
                        NCM: {l.descricaoNcm}
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
                          {l.regra.natureza && (
                            <>
                              <span className="text-xs text-text-tertiary">· nat.</span>
                              <span className="font-mono text-xs font-medium">{l.regra.natureza}</span>
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
