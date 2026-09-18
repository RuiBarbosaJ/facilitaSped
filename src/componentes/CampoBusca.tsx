"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { Search } from "lucide-react";

interface CampoBuscaProps {
  valor: string;
  onChange: (valor: string) => void;
  /** Textos próprios de quem reaproveita o campo; o padrão é a busca do SPED. */
  placeholder?: string;
  rotulo?: string;
  className?: string;
  /**
   * Este campo responde ao atalho global.
   *
   * Só UM campo por tela pode responder — duas buscas disputando a mesma tecla
   * roubariam o foco uma da outra. A busca principal da página liga; a que vive
   * dentro de um menu, não.
   */
  atalhoGlobal?: boolean;
}

/** Como o sistema operacional chama a tecla de comando. */
function ehMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

/**
 * Campo de busca padrão do sistema.
 *
 * Nasceu como um círculo que virava campo ao clicar — um gesto de landing page.
 * Numa ferramenta de consulta a busca é o controle mais usado da tela: ela fica
 * aberta, mostra o atalho que a alcança e some do caminho.
 */
export function CampoBusca({
  valor,
  onChange,
  placeholder = "Buscar por NCM, código ou descrição",
  rotulo = "Buscar nas tabelas do SPED",
  className,
  atalhoGlobal = false,
}: CampoBuscaProps) {
  const campoRef = useRef<HTMLInputElement>(null);

  /*
   * O rótulo da tecla depende do sistema, que só existe no navegador.
   *
   * Lido direto no render, ele faria o HTML do servidor divergir do cliente.
   * `useSyncExternalStore` com um snapshot de servidor é a forma de declarar
   * "isto é um valor só do cliente" sem `setState` dentro de efeito, que
   * encadearia um render a cada montagem do campo.
   */
  const comMac = useSyncExternalStore(
    () => () => {}, // o sistema não muda durante a visita: nada a assinar
    ehMac,
    () => false
  );

  useEffect(() => {
    if (!atalhoGlobal) return;

    function aoTeclar(evento: KeyboardEvent) {
      const alvo = evento.target as HTMLElement | null;
      const digitando =
        alvo?.tagName === "INPUT" ||
        alvo?.tagName === "TEXTAREA" ||
        alvo?.tagName === "SELECT" ||
        alvo?.isContentEditable;

      // Ctrl+K / ⌘K funciona de qualquer lugar; a barra, não — senão quem
      // escreve "0709.60" num outro campo perde o que digitou para o foco.
      const comando = (evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === "k";
      const barra = evento.key === "/" && !digitando && !evento.ctrlKey && !evento.metaKey;
      if (!comando && !barra) return;

      evento.preventDefault();
      campoRef.current?.focus();
      campoRef.current?.select();
    }

    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [atalhoGlobal]);

  return (
    <div className={`relative flex min-w-0 items-center ${className ?? ""}`}>
      <Search
        size={15}
        className="pointer-events-none absolute left-2.5 text-text-tertiary"
        aria-hidden
      />

      <input
        ref={campoRef}
        type="search"
        value={valor}
        onChange={(evento) => onChange(evento.target.value)}
        onKeyDown={(evento) => {
          // Escape limpa e devolve o foco à página: é o gesto que quem usa
          // teclado espera, e evita ter que apagar o termo caractere a caractere.
          if (evento.key !== "Escape") return;
          if (valor) onChange("");
          else campoRef.current?.blur();
        }}
        placeholder={placeholder}
        aria-label={rotulo}
        enterKeyHint="search"
        autoComplete="off"
        className="h-9 w-full min-w-0 rounded-md border border-border-strong bg-surface-card pl-8 pr-16 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-search-cancel-button]:appearance-none"
      />

      {atalhoGlobal && !valor && (
        <kbd
          className="pointer-events-none absolute right-2 hidden select-none rounded border border-border-subtle bg-surface-head px-1.5 py-0.5 font-mono text-[10px] text-text-tertiary sm:block"
          aria-hidden
        >
          {comMac ? "⌘K" : "Ctrl+K"}
        </kbd>
      )}
    </div>
  );
}
