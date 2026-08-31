"use client";

import { useEffect, useState } from "react";
import type { SincronizacaoMeta } from "@/types/sped";

function ehMeta(valor: unknown): valor is SincronizacaoMeta {
  if (typeof valor !== "object" || valor === null) return false;
  const meta = valor as Record<string, unknown>;
  return typeof meta.atualizado_em === "string" && typeof meta.registros === "number";
}

/**
 * Quando o robô trouxe dados novos da Receita pela última vez.
 *
 * O carimbo é gravado em UTC e formatado aqui no horário de Brasília — o cron
 * roda 06:00 UTC, que é 03:00 no Brasil. A formatação acontece só no cliente,
 * depois do fetch, então não há divergência com o HTML pré-renderizado.
 *
 * Devolve `null` enquanto carrega ou se o arquivo ainda não existe (a primeira
 * sincronização é quem o cria).
 */
export function useSincronizacao(): { data: string | null; versoes: Record<string, string> | null } {
  const [dados, setDados] = useState<{ data: string | null; versoes: Record<string, string> | null }>({ data: null, versoes: null });

  useEffect(() => {
    const controller = new AbortController();

    async function carregar() {
      try {
        const resposta = await fetch("/data/sync-meta.json", { signal: controller.signal });
        if (!resposta.ok) return;

        const corpo: unknown = await resposta.json();
        if (!ehMeta(corpo)) return;

        const quando = new Date(corpo.atualizado_em);
        if (Number.isNaN(quando.getTime())) return;

        setDados({
          data: new Intl.DateTimeFormat("pt-BR", {
            timeZone: "America/Sao_Paulo",
            dateStyle: "short",
            timeStyle: "short",
          }).format(quando),
          versoes: corpo.versoes ?? null,
        });
      } catch {
        // Sem o carimbo a página funciona igual — apenas não mostra a data.
      }
    }

    void carregar();
    return () => controller.abort();
  }, []);

  return dados;
}
