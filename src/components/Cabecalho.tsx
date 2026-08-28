"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileSpreadsheet } from "lucide-react";
import type { ReactNode } from "react";
import { BotaoTema } from "./BotaoTema";

const PAGINAS = [
  { href: "/", rotulo: "Consulta" },
  { href: "/auditoria", rotulo: "Auditoria" },
] as const;

interface CabecalhoProps {
  /** Linha de controles específica da página (busca, filtros), abaixo da marca. */
  children?: ReactNode;
}

/** Marca, navegação entre as páginas e o botão de tema. */
export function Cabecalho({ children }: CabecalhoProps) {
  const atual = usePathname();

  return (
    <header className="bg-surface-card border-b border-border-subtle sticky top-0 z-10 shadow-(--shadow-header)">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="shrink-0 grid place-items-center size-10 rounded-xl bg-accent text-accent-contrast focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              aria-label="Facilita Sped — início"
            >
              <FileSpreadsheet size={20} aria-hidden />
            </Link>
            <div className="min-w-0">
              <p className="text-lg font-semibold tracking-tight truncate leading-tight">Facilita Sped</p>
              <p className="text-xs text-text-tertiary truncate">
                Tabelas do EFD-Contribuições · NCM, CST, alíquotas e vigência
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            <nav aria-label="Páginas" className="flex items-center gap-1">
              {PAGINAS.map(({ href, rotulo }) => {
                const ativa = atual === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={ativa ? "page" : undefined}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      ativa
                        ? "bg-accent-soft text-accent"
                        : "text-text-secondary hover:text-text-primary hover:bg-surface-page"
                    }`}
                  >
                    {rotulo}
                  </Link>
                );
              })}
            </nav>
            <BotaoTema />
          </div>
        </div>

        {children && <div className="pb-4">{children}</div>}
      </div>
    </header>
  );
}
