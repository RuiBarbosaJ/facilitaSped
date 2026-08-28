"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import { useRegistrosSped } from "@/hooks/useRegistrosSped";
import { useBuscaSped } from "@/hooks/useBuscaSped";
import { CampoBusca } from "@/components/CampoBusca";
import { TabelaRegistros } from "@/components/TabelaRegistros";
import { Carregando, MensagemErro } from "@/components/EstadoConsulta";

/**
 * Quantos registros entram na tela por vez. As tabelas do SPED passam de mil
 * linhas; renderizar todas de uma vez travaria o primeiro paint sem necessidade,
 * já que a consulta útil quase sempre está nas primeiras dezenas de resultados.
 */
const PAGINA = 50;

export default function Home() {
  const { registros, carregando, erro } = useRegistrosSped();
  const [consulta, setConsulta] = useState("");
  const [visiveis, setVisiveis] = useState(PAGINA);

  const resultados = useBuscaSped(registros, consulta);

  // Uma busca nova recomeça a paginação do topo. Fazer isso aqui, e não num
  // efeito, evita o render em cascata (a lista chegaria a pintar a página
  // anterior antes do reset).
  function aoBuscar(valor: string) {
    setConsulta(valor);
    setVisiveis(PAGINA);
  }

  const exibidos = resultados.slice(0, visiveis);
  const restantes = resultados.length - exibidos.length;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <span className="text-blue-600 bg-blue-50 p-2 rounded-lg">
                  <Search size={24} aria-hidden />
                </span>
                Facilita Sped
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Consulta rápida de NCMs, CST, alíquotas e vigência para o SPED EFD-Contribuições
              </p>
            </div>
            <CampoBusca valor={consulta} onChange={aoBuscar} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {carregando ? (
          <Carregando />
        ) : erro ? (
          <MensagemErro mensagem={erro} />
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4" aria-live="polite">
              {resultados.length.toLocaleString("pt-BR")}{" "}
              {resultados.length === 1 ? "registro" : "registros"}
              {consulta ? " para a busca" : " nas tabelas"}
              {restantes > 0 ? ` — exibindo os primeiros ${exibidos.length}` : ""}
            </p>

            <TabelaRegistros registros={exibidos} consulta={consulta} />

            {restantes > 0 && (
              <div className="flex justify-center mt-6">
                <button
                  type="button"
                  onClick={() => setVisiveis((atual) => atual + PAGINA)}
                  className="px-5 py-2.5 text-sm font-medium text-blue-700 bg-white border border-blue-200 rounded-xl shadow-sm hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
                >
                  Mostrar mais {Math.min(PAGINA, restantes)} de {restantes.toLocaleString("pt-BR")}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
