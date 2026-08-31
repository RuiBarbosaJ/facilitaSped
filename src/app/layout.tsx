import type { Metadata } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Facilita Sped — Consulta EFD-Contribuições",
  description:
    "Consulta de NCMs, códigos CST de PIS/COFINS, alíquotas, natureza da receita e vigência das tabelas do SPED EFD-Contribuições.",
};

/*
 * Roda de forma síncrona enquanto o navegador lê o HTML, antes da primeira
 * pintura: sem isso a página apareceria clara por um instante para quem escolheu
 * o tema escuro. É a técnica que a documentação do Next recomenda para estado
 * que só existe no cliente (guia "preventing flash before hydration").
 */
const APLICAR_TEMA = `(function(){try{var t=localStorage.getItem("tema");var escuro=t==="escuro"||((!t||t==="sistema")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",escuro?"dark":"light")}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      // O script abaixo troca este valor antes da hidratação; sem
      // suppressHydrationWarning o React reclamaria da diferença.
      data-theme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: APLICAR_TEMA }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
