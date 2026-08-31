import { SearchX } from "lucide-react";
import type { RegraAgrupada } from "@/lib/agrupar";
import { LinhaRegistro } from "./LinhaRegistro";
import { FiltroColunaExcel } from "./FiltroColunaExcel";

interface TabelaRegistrosProps {
  regras: RegraAgrupada[];
  todasAsRegras: RegraAgrupada[];
  filtrosColuna: Record<string, string[]>;
  onFiltrarColuna: (coluna: string, valores: string[] | null) => void;
  consulta: string;
}

const COLUNAS = [
  { rotulo: "NCM", alinhamento: "text-left" },
  { rotulo: "Descrição", alinhamento: "text-left" },
  { rotulo: "CST", alinhamento: "text-left" },
  { rotulo: "Alíquota", alinhamento: "text-right" },
  { rotulo: "Nat. receita", alinhamento: "text-left" },
  { rotulo: "Vigência", alinhamento: "text-left" },
];

function valorColuna(regra: RegraAgrupada, coluna: string): string {
  switch (coluna) {
    case "NCM":
      return regra.ncms.length > 0 ? regra.ncms.slice(0, 3).join(", ") + (regra.ncms.length > 3 ? "..." : "") : "";
    case "Descrição":
      return regra.descricao || "";
    case "CST":
      return regra.cst || "";
    case "Alíquota":
      return regra.aliquota || "";
    case "Nat. receita":
      return regra.natureza_receita || "";
    case "Vigência":
      return `${regra.data_inicio || ""} a ${regra.data_fim || ""}`;
    default:
      return "";
  }
}

/** Grade de resultados. Recebe apenas a fatia que deve ser exibida. */
export function TabelaRegistros({ 
  regras, 
  todasAsRegras,
  filtrosColuna,
  onFiltrarColuna,
  consulta 
}: TabelaRegistrosProps) {

  return (
    <div className="bg-surface-card rounded-xl border border-border-subtle shadow-(--shadow-card) overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead className="bg-surface-head">
            <tr>
              {COLUNAS.map(({ rotulo, alinhamento }) => {
                const valoresUnicos = Array.from(new Set(todasAsRegras.map(r => valorColuna(r, rotulo)))).sort();
                
                return (
                  <th
                    key={rotulo}
                    scope="col"
                    className={`px-4 py-2.5 text-xs font-semibold text-text-tertiary uppercase tracking-wider whitespace-nowrap align-top ${alinhamento}`}
                  >
                    <div className={`flex items-center gap-1 ${alinhamento === "text-right" ? "justify-end" : ""}`}>
                      <span>{rotulo}</span>
                      <FiltroColunaExcel
                        coluna={rotulo}
                        valoresUnicos={valoresUnicos}
                        selecionados={filtrosColuna[rotulo]}
                        onChange={(valores) => onFiltrarColuna(rotulo, valores)}
                      />
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {regras.length > 0 ? (
              regras.map((regra) => <LinhaRegistro key={regra.chave} regra={regra} />)
            ) : (
              <tr>
                <td colSpan={COLUNAS.length} className="px-6 py-16 text-center">
                  <SearchX className="mx-auto h-8 w-8 text-text-tertiary mb-3" aria-hidden />
                  <p className="text-text-secondary">
                    Nenhum resultado
                    {consulta ? ` para “${consulta}”` : " para este filtro"}
                  </p>
                  <p className="text-sm text-text-tertiary mt-1">
                    Tente outro termo ou troque o CST.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
