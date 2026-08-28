import type { RegistroSped } from "@/types/sped";
import { BotaoCopiar } from "./BotaoCopiar";
import { Vigencia } from "./Vigencia";

interface LinhaRegistroProps {
  registro: RegistroSped;
}

/** Uma regra tributária na tabela de resultados. */
export function LinhaRegistro({ registro }: LinhaRegistroProps) {
  const { ncm, descricao, cst, aliquota, natureza_receita, data_inicio, data_fim } = registro;

  return (
    <tr className="hover:bg-blue-50/50 transition-colors">
      <td className="px-4 py-3 whitespace-nowrap">
        {ncm ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium text-gray-900 bg-gray-100 px-2 py-1 rounded">
              {ncm}
            </span>
            <BotaoCopiar valor={ncm} rotulo={`Copiar NCM ${ncm}`} />
          </div>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>

      <td className="px-4 py-3">
        <div className="text-sm text-gray-700 max-w-md line-clamp-3" title={descricao}>
          {descricao}
        </div>
      </td>

      <td className="px-4 py-3 whitespace-nowrap">
        {cst ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded">
              {cst}
            </span>
            <BotaoCopiar valor={cst} rotulo={`Copiar CST ${cst}`} />
          </div>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>

      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
        {aliquota ? `${aliquota}%` : <span className="text-gray-400">—</span>}
      </td>

      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
        {natureza_receita || <span className="text-gray-400">—</span>}
      </td>

      <td className="px-4 py-3">
        <Vigencia inicio={data_inicio} fim={data_fim} />
      </td>
    </tr>
  );
}
