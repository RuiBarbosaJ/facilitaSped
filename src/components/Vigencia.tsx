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
    <span className="whitespace-nowrap text-sm text-text-secondary">
      {inicio || "—"}
      <span className="text-text-tertiary"> a </span>
      {fim ? (
        fim
      ) : (
        <span className="inline-flex items-center rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
          vigente
        </span>
      )}
    </span>
  );
}
