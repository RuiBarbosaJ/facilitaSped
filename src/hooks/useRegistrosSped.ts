"use client";

import { useEffect, useState } from "react";
import type { RegistroSped } from "@/types/sped";

interface EstadoRegistros {
  registros: RegistroSped[];
  carregando: boolean;
  erro: string | null;
}

/**
 * `Response.json()` devolve `any`, o que abriria um buraco na tipagem estrita do
 * projeto. Tratamos o corpo como `unknown` e estreitamos com este type guard, de
 * modo que um JSON malformado vire lista vazia em vez de quebrar a renderização.
 */
function ehRegistroSped(valor: unknown): valor is RegistroSped {
  if (typeof valor !== "object" || valor === null) return false;
  const registro = valor as Record<string, unknown>;
  return (
    typeof registro.ncm === "string" &&
    typeof registro.descricao === "string" &&
    typeof registro.cst === "string" &&
    typeof registro.aliquota === "string"
  );
}

/**
 * Carrega as tabelas do SPED a partir do JSON estático.
 *
 * O arquivo tem algumas centenas de KB, então é buscado no cliente, de forma
 * assíncrona: assim ele não entra no bundle da página e a Vercel o serve como
 * asset estático cacheável.
 */
/**
 * O usuário é contador, não desenvolvedor: "Failed to fetch" e "HTTP 503" não
 * dizem nada a ele. Traduz a falha em algo que indique o que fazer.
 */
function mensagemAmigavel(excecao: unknown): string {
  if (excecao instanceof TypeError) {
    return "Não foi possível baixar as tabelas do SPED. Verifique sua conexão com a internet e recarregue a página.";
  }
  if (excecao instanceof Error && /formato/i.test(excecao.message)) {
    return "As tabelas do SPED chegaram em um formato inesperado. Avise o responsável pelo sistema.";
  }
  return "As tabelas do SPED não estão disponíveis no momento. Tente novamente em alguns minutos.";
}

export function useRegistrosSped(): EstadoRegistros {
  const [registros, setRegistros] = useState<RegistroSped[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    // Evita atualizar o estado caso o componente desmonte no meio do fetch.
    const controller = new AbortController();

    async function carregar() {
      try {
        const resposta = await fetch("/data/tabelas-sped.json", {
          signal: controller.signal,
        });
        if (!resposta.ok) {
          throw new Error(`Falha ao carregar os dados (HTTP ${resposta.status})`);
        }

        const corpo: unknown = await resposta.json();
        if (!Array.isArray(corpo)) {
          throw new Error("O arquivo de dados não está no formato esperado");
        }

        setRegistros(corpo.filter(ehRegistroSped));
        setErro(null);
      } catch (excecao) {
        if (excecao instanceof DOMException && excecao.name === "AbortError") return;
        setErro(mensagemAmigavel(excecao));
      } finally {
        if (!controller.signal.aborted) setCarregando(false);
      }
    }

    void carregar();
    return () => controller.abort();
  }, []);

  return { registros, carregando, erro };
}
