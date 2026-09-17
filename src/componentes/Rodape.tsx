/**
 * Fonte dos dados e contato do desenvolvedor — igual em todas as páginas.
 *
 * Sem vidro e sem brilho. A versão anterior punha um padrão animado no fundo e
 * cobria cada frase com uma placa translúcida de `backdrop-blur`, apoiada num
 * halo (`box-shadow` de deslocamento zero e raio largo). Eram três efeitos para
 * resolver um problema que os efeitos tinham criado: o texto ficava ilegível
 * sobre o padrão, então precisava de uma placa; a placa sumia no fundo, então
 * precisava de um halo.
 *
 * Aqui o rodapé é uma superfície chapada com a borda de sempre. A separação vem
 * da borda e do espaço, que é o que separa as outras seções do projeto.
 */
export function Rodape() {
  return (
    <footer className="mt-2 border-t border-border-subtle bg-surface-card text-xs text-text-tertiary">
      <div className="mx-auto flex min-h-32 max-w-[1600px] flex-col items-center justify-center gap-2 px-4 py-7 text-center sm:px-6 lg:px-8">
        <span>
          Fonte: Receita Federal — tabelas do SPED EFD-Contribuições, sincronizadas diariamente.
        </span>

        <div className="flex flex-col items-center gap-0.5">
          <span>&copy; {new Date().getFullYear()} Rui Barbosa. Todos os direitos reservados.</span>

          <span className="flex flex-wrap items-center justify-center gap-1.5">
            <a
              href="mailto:ruibarbosadev@gmail.com"
              className="rounded-sm transition-colors hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              ruibarbosadev@gmail.com
            </a>
            <span aria-hidden>·</span>
            <a
              href="https://wa.me/5599991722391"
              className="rounded-sm transition-colors hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              (99) 99172-2391
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
