import { SearchX } from "lucide-react";
import type { RegistroSped } from "@/types/sped";
import { LinhaRegistro } from "./LinhaRegistro";

interface TabelaRegistrosProps {
  registros: RegistroSped[];
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

/** Grade de resultados. Recebe apenas a fatia que deve ser exibida. */
export function TabelaRegistros({ registros, consulta }: TabelaRegistrosProps) {
  return (
    <div className="bg-surface-card rounded-xl border border-border-subtle shadow-[var(--shadow-card)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead className="bg-surface-head">
            <tr>
              {COLUNAS.map(({ rotulo, alinhamento }) => (
                <th
                  key={rotulo}
                  scope="col"
                  className={`px-4 py-2.5 text-xs font-semibold text-text-tertiary uppercase tracking-wider whitespace-nowrap ${alinhamento}`}
                >
                  {rotulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {registros.length > 0 ? (
              registros.map((registro, indice) => (
                <LinhaRegistro
                  // NCM + CST + natureza + vigência identificam a regra; o índice
                  // desempata registros que compartilham todos esses campos.
                  key={`${registro.ncm}-${registro.cst}-${registro.natureza_receita ?? ""}-${registro.data_inicio ?? ""}-${indice}`}
                  registro={registro}
                />
              ))
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
