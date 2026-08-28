"use client";

import { useEffect, useState } from "react";
import type { NcmOficial, TabelaNcm } from "@/types/sped";

function ehNcmOficial(valor: unknown): valor is NcmOficial {
  if (typeof valor !== "object" || valor === null) return false;
  const c = valor as Record<string, unknown>;
  return (
    typeof c.ncm === "string" &&
    typeof c.descricao === "string" &&
    typeof c.inicio === "string" &&
    (c.fim === undefined || typeof c.fim === "string")
  );
}

export interface EstadoTabelaNcm {
  tabela: TabelaNcm | null;
  carregando: boolean;
  /** true quando o arquivo não existe ou falhou — a auditoria segue sem checar existência de NCM. */
  indisponivel: boolean;
}

/**
 * Nomenclatura NCM completa (Siscomex), só para a página de auditoria. São
 * ~10 mil códigos; o arquivo é baixado uma vez e fica no cache do navegador.
 */
export function useTabelaNcm(): EstadoTabelaNcm {
  const [estado, setEstado] = useState<EstadoTabelaNcm>({
    tabela: null,
    carregando: true,
    indisponivel: false,
  });

  useEffect(() => {
    const controller = new AbortController();

    async function carregar() {
      try {
        const resposta = await fetch("/data/ncm.json", { signal: controller.signal });
        if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
        const corpo: unknown = await resposta.json();
        const raiz = typeof corpo === "object" && corpo !== null ? (corpo as Record<string, unknown>) : {};
        const codigos = Array.isArray(raiz.codigos) ? raiz.codigos.filter(ehNcmOficial) : [];
        if (codigos.length === 0) throw new Error("tabela vazia");
        setEstado({
          tabela: { fonte: typeof raiz.fonte === "string" ? raiz.fonte : "Siscomex", codigos },
          carregando: false,
          indisponivel: false,
        });
      } catch (excecao) {
        if (excecao instanceof DOMException && excecao.name === "AbortError") return;
        setEstado({ tabela: null, carregando: false, indisponivel: true });
      }
    }

    void carregar();
    return () => controller.abort();
  }, []);

  return estado;
}
