import { useMemo } from "react";

import type { RegraAgrupada } from "@/consulta/agrupar";
import { formatarAliquota } from "@/consulta/colunas";
import { ncmsDestacados } from "@/consulta/destaque";
import { CodigoCopiavel } from "./CodigoCopiavel";
import { DescricaoRegra } from "./DescricaoRegra";
import { SelosNcm } from "./SelosNcm";
import { Vigencia } from "./Vigencia";

interface LinhaRegistroProps {
  regra: RegraAgrupada;
  /** Os `id`s das colunas que a tabela está mostrando. */
  colunas: Set<string>;
  /** O termo buscado, para marcar o que casou. */
  termo: string;
}

/** Célula: folga de tabela no desktop; no celular a linha vira um bloco. */
const CELULA = "px-3 py-2 align-top max-md:p-0";

/** O nome da coluna, que no celular — sem cabeçalho — acompanha o valor. */
function Rotulo({ children }: { children: string }) {
  return <span className="mr-1 text-xs text-text-tertiary md:hidden">{children}</span>;
}

/**
 * Uma regra tributária na tabela de resultados, com todos os seus NCMs.
 *
 * No celular a linha se reorganiza em bloco — NCMs, descrição e, embaixo, os
 * códigos e a vigência —, em vez de rolar de lado: na tabela larga, a natureza
 * e a vigência ficavam fora da tela, que é justamente o que se veio buscar.
 */
export function LinhaRegistro({ regra, colunas, termo }: LinhaRegistroProps) {
  const { ncms, descricao, cst, aliquota, natureza_receita, tabela, data_inicio, data_fim } = regra;
  const destacados = useMemo(() => ncmsDestacados(ncms, termo), [ncms, termo]);

  return (
    <tr className="border-b border-border-subtle transition-colors last:border-b-0 hover:bg-surface-hover/60 max-md:flex max-md:flex-wrap max-md:items-baseline max-md:gap-x-4 max-md:gap-y-1.5 max-md:px-4 max-md:py-3">
      <td className={`${CELULA} max-md:order-1 max-md:basis-full`}>
        <SelosNcm ncms={ncms} destacados={destacados} />
      </td>

      {colunas.has("cst") && (
        <td className={`${CELULA} max-md:order-3`}>
          <Rotulo>CST</Rotulo>
          {cst ? (
            <CodigoCopiavel valor={cst} tipo="CST" className="-mx-1 text-text-primary" />
          ) : (
            <span className="text-text-tertiary">—</span>
          )}
          {tabela && (
            <span className="block text-xs text-text-tertiary max-md:inline max-md:ml-1" title={`Tabela ${tabela} do SPED`}>
              {tabela}
            </span>
          )}
        </td>
      )}

      <td className={`${CELULA} whitespace-nowrap max-md:order-3`}>
        <Rotulo>Natureza</Rotulo>
        {natureza_receita ? (
          <CodigoCopiavel
            valor={natureza_receita}
            tipo="natureza da receita"
            className="-mx-1 font-medium text-text-primary"
          />
        ) : (
          <span className="text-text-tertiary">—</span>
        )}
      </td>

      {colunas.has("aliquota") && (
        <td className={`${CELULA} whitespace-nowrap text-right font-mono text-[13px] leading-6 text-text-secondary max-md:order-3`}>
          <Rotulo>Alíquota</Rotulo>
          {aliquota ? formatarAliquota(aliquota) : <span className="font-sans text-text-tertiary">—</span>}
        </td>
      )}

      <td className={`${CELULA} md:min-w-[18rem] max-md:order-2 max-md:basis-full`}>
        <DescricaoRegra texto={descricao} termo={termo} />
      </td>

      <td className={`${CELULA} leading-6 max-md:order-3`}>
        <Vigencia inicio={data_inicio} fim={data_fim} />
      </td>
    </tr>
  );
}
