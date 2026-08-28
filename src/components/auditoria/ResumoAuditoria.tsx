import type { ResumoAuditoria as Resumo } from "@/lib/auditoria";

export type FiltroAuditoria = "todos" | "beneficio" | "possivel" | "tributado" | "invalido" | "divergencias";

interface ResumoAuditoriaProps {
  resumo: Resumo;
  filtro: FiltroAuditoria;
  onFiltrar: (filtro: FiltroAuditoria) => void;
}

const TILES: { chave: FiltroAuditoria; rotulo: string; cor: string; valor: (r: Resumo) => number }[] = [
  { chave: "todos", rotulo: "Linhas auditadas", cor: "text-text-primary", valor: (r) => r.total },
  { chave: "beneficio", rotulo: "Alíquota zero / monofásico", cor: "text-success", valor: (r) => r.beneficio },
  { chave: "possivel", rotulo: "Possível benefício — conferir", cor: "text-accent", valor: (r) => r.possivel },
  { chave: "tributado", rotulo: "Tributado", cor: "text-text-secondary", valor: (r) => r.tributado },
  { chave: "divergencias", rotulo: "Divergências de CST/natureza", cor: "text-warning", valor: (r) => r.divergencias },
  { chave: "invalido", rotulo: "NCM inválido", cor: "text-danger", valor: (r) => r.invalido },
];

/** Contadores da auditoria; cada cartão também filtra a tabela. */
export function ResumoAuditoria({ resumo, filtro, onFiltrar }: ResumoAuditoriaProps) {
  return (
    <div role="group" aria-label="Resumo da auditoria" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {TILES.map(({ chave, rotulo, cor, valor }) => {
        const ativo = filtro === chave;
        return (
          <button
            key={chave}
            type="button"
            aria-pressed={ativo}
            onClick={() => onFiltrar(chave)}
            className={`rounded-xl border p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              ativo ? "border-accent bg-accent-soft" : "border-border-subtle bg-surface-card hover:border-border-strong"
            }`}
          >
            <p className={`text-2xl font-semibold tabular-nums ${cor}`}>{valor(resumo).toLocaleString("pt-BR")}</p>
            <p className="mt-0.5 text-xs font-medium text-text-tertiary">{rotulo}</p>
          </button>
        );
      })}
    </div>
  );
}
