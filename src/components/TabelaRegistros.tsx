import { Search } from "lucide-react";
import type { RegistroSped } from "@/types/sped";
import { LinhaRegistro } from "./LinhaRegistro";

interface TabelaRegistrosProps {
  registros: RegistroSped[];
  consulta: string;
}

const COLUNAS = ["NCM", "Descrição", "CST", "Alíquota", "Nat. Receita", "Vigência"];

/** Grade de resultados. Recebe apenas a fatia que deve ser exibida. */
export function TabelaRegistros({ registros, consulta }: TabelaRegistrosProps) {
  return (
    <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-left">
          <thead className="bg-gray-50">
            <tr>
              {COLUNAS.map((coluna) => (
                <th
                  key={coluna}
                  scope="col"
                  className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                >
                  {coluna}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
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
                <td colSpan={COLUNAS.length} className="px-6 py-12 text-center text-gray-500">
                  <Search className="mx-auto h-8 w-8 text-gray-300 mb-3" aria-hidden />
                  <p className="text-lg">
                    Nenhum resultado encontrado
                    {consulta ? ` para “${consulta}”` : ""}
                  </p>
                  <p className="text-sm mt-1">Tente buscar por outro termo.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
