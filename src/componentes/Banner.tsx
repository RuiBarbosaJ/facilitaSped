import type { ReactNode } from "react";
import { AlertTriangle, Info, ShieldCheck } from "lucide-react";

type Tom = "erro" | "aviso" | "ok" | "info";

const ESTILO: Record<Tom, { caixa: string; Icone: typeof AlertTriangle }> = {
  erro: { caixa: "border-danger/30 bg-danger-soft text-danger", Icone: AlertTriangle },
  aviso: { caixa: "border-warning/30 bg-warning-soft text-warning", Icone: AlertTriangle },
  ok: { caixa: "border-success/30 bg-success-soft text-success", Icone: ShieldCheck },
  info: { caixa: "border-accent/30 bg-accent-soft text-accent", Icone: Info },
};

interface BannerProps {
  tom: Tom;
  titulo?: ReactNode;
  children?: ReactNode;
}

/**
 * Um aviso sobre o estado da tela: a base que não carregou, a planilha que não
 * deu para ler, a auditoria que não achou nada.
 *
 * As duas telas de auditoria montavam o seu, cada uma com raio, ícone e
 * espaçamento próprios. É o mesmo tipo de recado, e precisa ter a mesma cara —
 * quem aprende a ler o amarelo numa tela lê na outra.
 */
export function Banner({ tom, titulo, children }: BannerProps) {
  const { caixa, Icone } = ESTILO[tom];
  return (
    <div
      role={tom === "erro" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${caixa}`}
    >
      <Icone size={16} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0">
        {titulo && <p className="font-medium">{titulo}</p>}
        {children && <div className={titulo ? "mt-0.5" : undefined}>{children}</div>}
      </div>
    </div>
  );
}
