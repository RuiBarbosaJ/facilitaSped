import { Cabecalho } from "@/componentes/Cabecalho";
import { Rodape } from "@/componentes/Rodape";

export const metadata = {
  title: "Auditoria SPED ICMS/IPI | FacilitaSPED",
  description:
    "Auditoria de arquivos SPED EFD ICMS/IPI processada dentro do navegador, sem enviar a escrituração para nenhum servidor.",
};

export default function LayoutIcmsIpi({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-surface-page text-text-primary font-sans">
      <Cabecalho />

      {/* O id é o destino do "Pular para o conteúdo principal" do layout raiz. */}
      <main
        id="conteudo-principal"
        className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6"
      >
        {children}
      </main>

      <Rodape />
    </div>
  );
}
