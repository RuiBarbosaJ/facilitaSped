"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
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
      {/* Barra superior fina com as cores do Brasil (Gov.br / RFB style) */}
      <div className="h-1 w-full bg-linear-to-r from-[#00A859] via-[#FED000] to-[#1351B4]"></div>
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-y-4 gap-x-2 py-4 relative">
          {/* Botão de Tema (Esquerda no desktop, Segunda linha à esquerda no mobile) */}
          <div className="flex-1 basis-0 flex items-center justify-start order-2 sm:order-1">
            <BotaoTema />
          </div>

          {/* Logo e Título (Centro no desktop, Primeira linha centralizada no mobile) */}
          <div className="w-full sm:w-auto flex items-center justify-center gap-3 min-w-0 order-1 sm:order-2 shrink-0">
            <Link
              href="/"
              className="shrink-0 flex items-center justify-center size-12 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 transition-transform hover:scale-105"
              aria-label="Facilita Sped — início"
            >
              <Image 
                src="/logo-sped-v2.png" 
                alt="Logo SPED" 
                width={48} 
                height={48}
                className="w-full h-full object-contain drop-shadow-md"
              />
            </Link>
            <div className="min-w-0">
              <div className="flex items-start justify-center sm:justify-start">
                <p 
                  className="text-xl font-bold tracking-tight truncate leading-none py-1" 
                  style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
                >
                  <span className="bg-linear-to-r from-accent to-accent-hover bg-clip-text text-transparent mr-1">Facilita</span>
                  <span className="text-text-primary">
                    Sped
                    <sup className="text-[0.6rem] font-black text-accent uppercase ml-[1px]" title="Rui">r</sup>
                  </span>
                </p>
              </div>
              <p className="text-xs text-text-tertiary truncate">
                Tabelas EFD-Contribuições
              </p>
            </div>
          </div>

          {/* Navegação (Direita no desktop, Segunda linha à direita no mobile) */}
          <div className="flex-1 basis-0 flex items-center justify-end gap-3 sm:gap-5 order-3 sm:order-3">
            <nav aria-label="Páginas" className="flex items-center justify-end gap-1 flex-wrap sm:flex-nowrap">
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
          </div>
        </div>

        {children && <div className="pb-4">{children}</div>}
      </div>
    </header>
  );
}
