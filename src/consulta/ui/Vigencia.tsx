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
 *
 * A marca vai na EXCEÇÃO. O selo "vigente" aparecia em quatro de cada cinco
 * linhas e virava fundo; o que o contador precisa enxergar de longe é a regra
 * que tem data para acabar. Essa leva a cor de atenção e mostra o fim; o
 * período inteiro fica na dica.
 */
export function Vigencia({ inicio, fim }: VigenciaProps) {
  if (!inicio && !fim) {
    return <span className="text-text-tertiary">—</span>;
  }

  if (!fim) {
    return <span className="whitespace-nowrap text-sm text-text-secondary">desde {inicio}</span>;
  }

  return (
    <span
      className="whitespace-nowrap text-sm text-warning"
      title={`Vigência: ${inicio || "—"} a ${fim}`}
    >
      até {fim}
    </span>
  );
}
