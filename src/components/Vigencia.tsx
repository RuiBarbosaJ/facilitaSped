interface VigenciaProps {
  inicio?: string;
  fim?: string;
}

/**
 * Mostra a vigência da regra tributária.
 *
 * O portal publica as datas em formatos mistos ("01/2011" e "08/03/2013"), então
 * elas são exibidas como vieram da fonte — reescrevê-las arriscaria inverter
 * dia/mês. A ausência de data final significa regra ainda em vigor.
 */
export function Vigencia({ inicio, fim }: VigenciaProps) {
  if (!inicio && !fim) {
    return <span className="text-text-tertiary">—</span>;
  }

  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-text-secondary">
      <span className="inline-block w-[90px] text-left">
        {inicio || "—"}
      </span>
      <span className={`text-text-tertiary ${fim ? "" : "invisible"}`}>a</span>
      <span className="inline-flex items-center justify-start w-[90px]">
        {fim ? (
          fim
        ) : (
          <span className="inline-flex items-center rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success uppercase tracking-wider">
            vigente
          </span>
        )}
      </span>
    </span>
  );
}
