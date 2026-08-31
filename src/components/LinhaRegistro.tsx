import type { RegraAgrupada } from "@/lib/agrupar";
import { BotaoCopiar } from "./BotaoCopiar";
import { DescricaoExpandivel } from "./DescricaoExpandivel";
import { SelosNcm } from "./SelosNcm";
import { Vigencia } from "./Vigencia";

interface LinhaRegistroProps {
  regra: RegraAgrupada;
  mostrarAliquota?: boolean;
}

/** Uma regra tributária na tabela de resultados, com todos os seus NCMs. */
export function LinhaRegistro({ regra, mostrarAliquota = true }: LinhaRegistroProps) {
  const { ncms, descricao, cst, aliquota, natureza_receita, data_inicio, data_fim } = regra;

  return (
    <tr className="group/linha hover:bg-surface-hover transition-colors align-top">
      <td className="px-4 py-2.5 min-w-[240px] max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg">
        <SelosNcm ncms={ncms} />
      </td>

      <td className="px-4 py-2.5 min-w-[240px]">
        <DescricaoExpandivel texto={descricao || ""} limiteCaracteres={120} />
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

      {mostrarAliquota && (
        <td className="px-4 py-2.5 whitespace-nowrap text-sm text-text-secondary text-right">
          {aliquota ? `${aliquota}%` : <span className="text-text-tertiary">—</span>}
        </td>
      )}

      <td className="px-4 py-2.5 whitespace-nowrap text-sm font-mono text-text-secondary">
        {natureza_receita || <span className="text-text-tertiary font-sans">—</span>}
      </td>

      <td className="px-4 py-2.5">
        <Vigencia inicio={data_inicio} fim={data_fim} />
      </td>
    </tr>
  );
}
