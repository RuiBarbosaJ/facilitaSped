"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Filter } from "lucide-react";

interface FiltroColunaExcelProps {
  coluna: string;
  valoresUnicos: string[];
  selecionados: string[] | undefined;
  onChange: (s: string[] | null) => void;
  alinharDireita?: boolean;
}

export function FiltroColunaExcel({
  coluna,
  valoresUnicos,
  selecionados,
  onChange,
  alinharDireita = false,
}: FiltroColunaExcelProps) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filtradosBusca = useMemo(() => {
    if (!busca) return valoresUnicos;
    const b = busca.toLowerCase();
    return valoresUnicos.filter((v) => v.toLowerCase().includes(b));
  }, [valoresUnicos, busca]);

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (aberto && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [aberto]);

  const selecionadosParaRenderizar = selecionados ?? valoresUnicos;

  const toggleAll = () => {
    if (selecionados === undefined || selecionados.length === valoresUnicos.length) {
      onChange([]);
    } else {
      onChange(null);
    }
  };

  const toggleUm = (valor: string) => {
    const atual = selecionados ?? valoresUnicos;
    if (atual.includes(valor)) {
      const novo = atual.filter((v) => v !== valor);
      onChange(novo);
    } else {
      const novo = [...atual, valor];
      if (novo.length === valoresUnicos.length) {
        onChange(null);
      } else {
        onChange(novo);
      }
    }
  };

  return (
    <div className="relative inline-flex items-center" ref={containerRef}>
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        className={`p-1 rounded hover:bg-surface-page transition-colors ${
          selecionados !== undefined ? "text-accent bg-accent-soft" : "text-text-tertiary"
        }`}
        aria-label={`Filtrar coluna ${coluna}`}
        title={`Filtrar coluna ${coluna}`}
      >
        <Filter size={14} />
      </button>

      {aberto && (
        <div className={`absolute top-full z-10 mt-1 w-64 rounded-xl border border-border-strong bg-surface-card p-3 shadow-lg font-sans text-left ${alinharDireita ? 'right-0' : 'left-0'}`}>
          <input
            type="text"
            placeholder="Buscar..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full rounded border border-border-strong bg-surface-page px-2 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none mb-2"
          />
          <div className="flex flex-col max-h-48 overflow-y-auto gap-0.5 text-xs font-normal normal-case tracking-normal">
            <label className="flex items-center gap-2 px-1 py-1 hover:bg-surface-page cursor-pointer rounded">
              <input
                type="checkbox"
                checked={selecionados === undefined || selecionados.length === valoresUnicos.length}
                onChange={toggleAll}
                className="rounded border-border-strong text-accent focus:ring-accent"
              />
              <span className="font-semibold">(Selecionar Tudo)</span>
            </label>
            {filtradosBusca.length === 0 ? (
              <span className="text-text-tertiary p-1">Nenhum valor encontrado</span>
            ) : (
              filtradosBusca.map((v) => (
                <label
                  key={v}
                  className="flex items-center gap-2 px-1 py-1 hover:bg-surface-page cursor-pointer rounded"
                >
                  <input
                    type="checkbox"
                    checked={selecionadosParaRenderizar.includes(v)}
                    onChange={() => toggleUm(v)}
                    className="rounded border-border-strong text-accent focus:ring-accent shrink-0"
                  />
                  <span className="truncate" title={v}>
                    {v || "(Vazio)"}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
