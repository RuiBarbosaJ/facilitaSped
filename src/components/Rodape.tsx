/** Fonte dos dados e contato do desenvolvedor — igual em todas as páginas. */
export function Rodape() {
  return (
    <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 mt-2 border-t border-border-subtle text-xs text-text-tertiary flex flex-col sm:flex-row justify-between gap-1">
      <span>Fonte: Receita Federal — tabelas do SPED EFD-Contribuições, sincronizadas diariamente.</span>
      <div className="flex flex-col sm:items-end gap-0.5">
        <span>
          &copy; {new Date().getFullYear()} Rui Barbosa. Todos os direitos reservados.
        </span>
        <span className="flex items-center gap-1.5 flex-wrap">
          <a
            href="mailto:ruibarbosadev@gmail.com"
            className="hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded transition-colors"
          >
            ruibarbosadev@gmail.com
          </a>
          <span aria-hidden>·</span>
          <a
            href="https://wa.me/5599991722391"
            className="hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded transition-colors"
          >
            (99) 99172-2391
          </a>
        </span>
      </div>
    </footer>
  );
}
