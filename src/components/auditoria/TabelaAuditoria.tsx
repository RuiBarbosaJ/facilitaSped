import { useState, useMemo, useRef, useEffect } from "react";
import { Filter } from "lucide-react";
import { valorColuna, type LinhaAuditada } from "@/lib/auditoria";

interface TabelaAuditoriaProps {
  linhas: LinhaAuditada[];
  todasAsLinhas: LinhaAuditada[];
  filtrosColuna: Record<string, string[]>;
  onFiltrarColuna: (coluna: string, valores: string[] | null) => void;
}

const COLUNAS = ["Linha", "Produto", "Classificação", "Informado", "Situação", "Sugestão do SPED", "Observações"];

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
export function TabelaAuditoria({ linhas, todasAsLinhas, filtrosColuna, onFiltrarColuna }: TabelaAuditoriaProps) {
  return (
    <div className="bg-surface-card rounded-xl border border-border-subtle shadow-(--shadow-card) overflow-hidden">
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
              {COLUNAS.map((coluna) => (
                <th
                  key={coluna}
                  scope="col"
                  className="px-3 py-2.5 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wider whitespace-nowrap first:pl-4 align-top"
                >
                  <div className="flex items-center gap-1">
                    <span>{coluna}</span>
                    <FiltroColunaExcel
                      coluna={coluna}
                      linhas={todasAsLinhas}
                      selecionados={filtrosColuna[coluna]}
                      onChange={(valores) => onFiltrarColuna(coluna, valores)}
                    />
                  </div>
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

function FiltroColunaExcel({
  coluna,
  linhas,
  selecionados,
  onChange,
}: {
  coluna: string;
  linhas: LinhaAuditada[];
  selecionados: string[] | undefined;
  onChange: (s: string[] | null) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const valoresUnicos = useMemo(() => {
    const valores = new Set<string>();
    linhas.forEach((l) => valores.add(valorColuna(l, coluna)));
    return Array.from(valores).sort();
  }, [linhas, coluna]);

  const filtradosBusca = useMemo(() => {
    if (!busca) return valoresUnicos;
    const b = busca.toLowerCase();
    return valoresUnicos.filter(v => v.toLowerCase().includes(b));
  }, [valoresUnicos, busca]);

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (aberto && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [aberto]);

  const selecionadosParaRenderizar = selecionados ?? valoresUnicos;
  
  const toggleAll = () => {
    if (selecionados === undefined || selecionados.length === valoresUnicos.length) {
      onChange([]);
    } else {
      onChange(null);
    }
  };

  const toggleUm = (valor: string) => {
    const atual = selecionados ?? valoresUnicos;
    if (atual.includes(valor)) {
      const novo = atual.filter((v) => v !== valor);
      onChange(novo);
    } else {
      const novo = [...atual, valor];
      if (novo.length === valoresUnicos.length) {
        onChange(null);
      } else {
        onChange(novo);
      }
    }
  };

  return (
    <div className="relative inline-flex items-center" ref={containerRef}>
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        className={`p-1 rounded hover:bg-surface-page transition-colors ${selecionados !== undefined ? "text-accent bg-accent-soft" : "text-text-tertiary"}`}
        aria-label={`Filtrar coluna ${coluna}`}
        title={`Filtrar coluna ${coluna}`}
      >
        <Filter size={14} />
      </button>

      {aberto && (
        <div className="absolute top-full left-0 z-10 mt-1 w-64 rounded-xl border border-border-strong bg-surface-card p-3 shadow-lg font-sans">
          <input
            type="text"
            placeholder="Buscar..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full rounded border border-border-strong bg-surface-page px-2 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none mb-2"
          />
          <div className="flex flex-col max-h-48 overflow-y-auto gap-0.5 text-xs font-normal normal-case tracking-normal">
            <label className="flex items-center gap-2 px-1 py-1 hover:bg-surface-page cursor-pointer rounded">
              <input
                type="checkbox"
                checked={selecionados === undefined || selecionados.length === valoresUnicos.length}
                onChange={toggleAll}
                className="rounded border-border-strong text-accent focus:ring-accent"
              />
              <span className="font-semibold">(Selecionar Tudo)</span>
            </label>
            {filtradosBusca.length === 0 ? (
              <span className="text-text-tertiary p-1">Nenhum valor encontrado</span>
            ) : (
              filtradosBusca.map((v) => (
                <label key={v} className="flex items-center gap-2 px-1 py-1 hover:bg-surface-page cursor-pointer rounded">
                  <input
                    type="checkbox"
                    checked={selecionadosParaRenderizar.includes(v)}
                    onChange={() => toggleUm(v)}
                    className="rounded border-border-strong text-accent focus:ring-accent shrink-0"
                  />
                  <span className="truncate" title={v}>{v || "(Vazio)"}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
