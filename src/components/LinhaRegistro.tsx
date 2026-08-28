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
    <tr className="group/linha hover:bg-surface-hover transition-colors">
      <td className="px-4 py-2.5 whitespace-nowrap">
        {ncm ? (
          <div className="flex items-center gap-1">
            <span className="font-mono text-sm rounded bg-badge-ncm-bg px-1.5 py-0.5 text-badge-ncm-text">
              {ncm}
            </span>
            <BotaoCopiar valor={ncm} rotulo={`Copiar NCM ${ncm}`} />
          </div>
        ) : (
          <span className="text-text-tertiary">—</span>
        )}
      </td>

      <td className="px-4 py-2.5">
        <div className="text-sm text-text-secondary max-w-xl line-clamp-2" title={descricao}>
          {descricao}
        </div>
      </td>

      <td className="px-4 py-2.5 whitespace-nowrap">
        {cst ? (
          <div className="flex items-center gap-1">
            <span className="font-mono text-sm font-medium rounded bg-badge-cst-bg px-1.5 py-0.5 text-badge-cst-text">
              {cst}
            </span>
            <BotaoCopiar valor={cst} rotulo={`Copiar CST ${cst}`} />
          </div>
        ) : (
          <span className="text-text-tertiary">—</span>
        )}
      </td>

      <td className="px-4 py-2.5 whitespace-nowrap text-sm text-text-secondary text-right">
        {aliquota ? `${aliquota}%` : <span className="text-text-tertiary">—</span>}
      </td>

      <td className="px-4 py-2.5 whitespace-nowrap text-sm font-mono text-text-secondary">
        {natureza_receita || <span className="text-text-tertiary font-sans">—</span>}
      </td>

      <td className="px-4 py-2.5">
        <Vigencia inicio={data_inicio} fim={data_fim} />
      </td>
    </tr>
  );
}
