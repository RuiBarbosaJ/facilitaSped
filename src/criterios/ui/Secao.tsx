import { AlertTriangle, Info } from "lucide-react";
import type { ReactNode } from "react";

interface SecaoProps {
  /** Âncora do sumário. Precisa bater com o `id` declarado em `SUMARIO`. */
  id: string;
  /** Numeral da seção, em mono — é o que dá à página o registro de norma. */
  numero: string;
  titulo: string;
  /** Uma frase sob o título, quando a seção precisa de enquadramento. */
  resumo?: string;
  children: ReactNode;
}

/**
 * Uma seção do documento.
 *
 * O `scroll-margin-top` é o detalhe que faz o sumário funcionar: sem ele, um
 * salto de âncora encosta o título no topo da janela e o cabeçalho fixo o cobre
 * — quem clica em "Régua de correção" aterrissa no meio do primeiro parágrafo e
 * não vê o título que pediu.
 */
export function Secao({ id, numero, titulo, resumo, children }: SecaoProps) {
  return (
    <section
      id={id}
      className="scroll-mt-[calc(var(--altura-cabecalho)+1.5rem)] border-t border-border-subtle pt-8 first:border-t-0 first:pt-0"
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-xs text-text-tertiary tabular-nums">{numero}</span>
          <h2 className="text-base font-semibold tracking-tight text-text-primary">{titulo}</h2>
        </div>
        {resumo && <p className="max-w-3xl text-sm leading-relaxed text-text-secondary">{resumo}</p>}
      </div>

      <div className="mt-5 flex flex-col gap-5">{children}</div>
    </section>
  );
}

/** Um parágrafo do corpo. Largura contida: linha longa demais cansa a leitura. */
export function Paragrafo({ children }: { children: ReactNode }) {
  return <p className="max-w-3xl text-sm leading-relaxed text-text-secondary">{children}</p>;
}

/** Um código fiscal no meio da frase — CST, CFOP, NCM, nome de campo. */
export function Cod({ children }: { children: ReactNode }) {
  return (
    <code className="rounded border border-border-subtle bg-surface-head px-1 py-px font-mono text-[0.8125rem] text-text-primary">
      {children}
    </code>
  );
}

interface AvisoProps {
  titulo: string;
  tom?: "neutro" | "atencao";
  children: ReactNode;
}

/**
 * O destaque de uma ressalva.
 *
 * Chapado, sem fundo colorido: a cor neste sistema marca dado fiscal —
 * vermelho é erro na escrituração, amarelo é divergência —, e um bloco de texto
 * pintado de amarelo competiria com isso. Também sem a barra colorida na
 * lateral e sem o título em caixa alta: eram o acabamento de "caixa de
 * destaque" que toda página gerada no automático tem. O que separa a ressalva
 * do texto corrido é a moldura fina e o ícone; a cor fica só no ícone.
 */
export function Aviso({ titulo, tom = "neutro", children }: AvisoProps) {
  const Icone = tom === "atencao" ? AlertTriangle : Info;
  return (
    <div className="max-w-3xl rounded-md border border-border-subtle bg-surface-card p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-text-primary">
        <Icone size={15} className={`shrink-0 ${tom === "atencao" ? "text-warning" : "text-accent"}`} aria-hidden />
        {titulo}
      </p>
      <div className="mt-2 flex flex-col gap-2 text-sm leading-relaxed text-text-secondary">{children}</div>
    </div>
  );
}
