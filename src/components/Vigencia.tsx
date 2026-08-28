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
    return <span className="text-gray-400">—</span>;
  }

  return (
    <span className="whitespace-nowrap text-sm">
      <span className="text-gray-700">{inicio || "—"}</span>
      <span className="text-gray-400"> a </span>
      {fim ? (
        <span className="text-gray-700">{fim}</span>
      ) : (
        <span className="text-green-700 font-medium">vigente</span>
      )}
    </span>
  );
}
