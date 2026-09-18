/** As seções do documento, na ordem. O `id` é a âncora e a chave do `Secao`. */
export const SUMARIO = [
  { id: "visao-geral", numero: "01", titulo: "O que a ferramenta faz" },
  { id: "as-tres-telas", numero: "02", titulo: "As três telas, lado a lado" },
  { id: "tabelas", numero: "03", titulo: "Tabelas oficiais" },
  { id: "pis-cofins", numero: "04", titulo: "PIS/COFINS — a planilha" },
  { id: "icms-ipi", numero: "05", titulo: "ICMS/IPI — a escrituração" },
  { id: "regua", numero: "06", titulo: "A régua de correção" },
  { id: "regras", numero: "07", titulo: "As regras que rodam hoje" },
  { id: "limites", numero: "08", titulo: "O que ainda não é conferido" },
  { id: "glossario", numero: "09", titulo: "Glossário" },
] as const;

/**
 * Índice do documento, fixo ao lado do texto no desktop.
 *
 * Links puros, sem marcação da seção corrente. Um indicador de posição pediria
 * um observador de rolagem no navegador, e num índice de nove itens todos
 * visíveis de uma vez ele resolveria um problema que não existe.
 */
export function Sumario() {
  return (
    <nav
      aria-label="Seções desta página"
      className="hidden lg:block lg:sticky lg:top-[calc(var(--altura-cabecalho)+1.5rem)] lg:self-start"
    >
      <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-text-tertiary">
        Nesta página
      </p>
      <ol className="flex flex-col gap-0.5 border-l border-border-subtle">
        {SUMARIO.map(({ id, numero, titulo }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className="-ml-px flex gap-2.5 border-l border-transparent py-1.5 pl-3 text-sm text-text-secondary transition-colors hover:border-l-accent hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="font-mono text-[11px] text-text-tertiary tabular-nums">{numero}</span>
              <span className="min-w-0">{titulo}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
