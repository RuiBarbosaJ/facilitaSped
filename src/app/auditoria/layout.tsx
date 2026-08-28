import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Auditoria de planilhas — Facilita Sped",
  description:
    "Cruze o relatório de NCM do Alterdata com as tabelas do SPED EFD-Contribuições e encontre CSTs e naturezas de receita divergentes.",
};

export default function AuditoriaLayout({ children }: LayoutProps<"/auditoria">) {
  return children;
}
