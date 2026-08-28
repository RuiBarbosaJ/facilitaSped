/** Fonte dos dados e contato do desenvolvedor — igual em todas as páginas. */
export function Rodape() {
  return (
    <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 mt-2 border-t border-border-subtle text-xs text-text-tertiary flex flex-col sm:flex-row justify-between gap-1">
      <span>Fonte: Receita Federal — tabelas do SPED EFD-Contribuições, sincronizadas diariamente.</span>
      <span>
        Desenvolvido por Rui Barbosa ·{" "}
        <a
          href="https://wa.me/5599991722391"
          className="hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded transition-colors"
        >
          (99) 99172-2391
        </a>
      </span>
    </footer>
  );
}
