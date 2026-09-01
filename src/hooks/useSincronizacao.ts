"use client";

import { useEffect, useState } from "react";
import type { SincronizacaoMeta } from "@/types/sped";

function ehMeta(valor: unknown): valor is SincronizacaoMeta {
  if (typeof valor !== "object" || valor === null) return false;
  const meta = valor as Record<string, unknown>;
  return typeof meta.atualizado_em === "string" && typeof meta.registros === "number";
}

/**
 * Quando o robô conferiu a Receita pela última vez.
 *
 * A data exibida é a da última CONFERÊNCIA bem-sucedida (`verificado_em`), não
 * a da última mudança de conteúdo: a checagem é diária e o contador precisa
 * ver que ela aconteceu hoje mesmo quando a Receita não publicou nada.
 * Carimbos gravados por versões antigas do robô só têm `atualizado_em`, que
 * serve de reserva.
 *
 * O carimbo é gravado em UTC e formatado aqui no horário de Brasília — o cron
 * roda 06:00 UTC, que é 03:00 no Brasil. A formatação acontece só no cliente,
 * depois do fetch, então não há divergência com o HTML pré-renderizado.
 *
 * Devolve `null` enquanto carrega ou se o arquivo ainda não existe (a primeira
 * sincronização é quem o cria).
 */
interface EstadoSincronizacao {
  /** Última conferência bem-sucedida, já formatada em pt-BR. */
  data: string | null;
  /** Última vez que os dados de fato mudaram; igual a `data` quando mudaram hoje. */
  alteradoEm: string | null;
  versoes: Record<string, string> | null;
}

export function useSincronizacao(): EstadoSincronizacao {
  const [dados, setDados] = useState<EstadoSincronizacao>({ data: null, alteradoEm: null, versoes: null });

  useEffect(() => {
    const controller = new AbortController();

    async function carregar() {
      try {
        const resposta = await fetch("/data/sync-meta.json", { signal: controller.signal });
        if (!resposta.ok) return;

        const corpo: unknown = await resposta.json();
        if (!ehMeta(corpo)) return;

        const quando = new Date(corpo.verificado_em ?? corpo.atualizado_em);
        if (Number.isNaN(quando.getTime())) return;
        const mudou = new Date(corpo.atualizado_em);

        const formatar = (d: Date) =>
          new Intl.DateTimeFormat("pt-BR", {
            timeZone: "America/Sao_Paulo",
            dateStyle: "short",
            timeStyle: "short",
          }).format(d);

        setDados({
          data: formatar(quando),
          alteradoEm: Number.isNaN(mudou.getTime()) ? null : formatar(mudou),
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
