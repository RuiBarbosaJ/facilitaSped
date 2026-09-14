"use client";

import { useCallback, useState } from "react";

/**
 * Guarda o último valor de cada chave enquanto a aba estiver aberta. Não é
 * persistência: é para que voltar de /auditoria para / não apague a consulta
 * que a pessoa acabou de montar.
 */
const store: Record<string, unknown> = {};

export function useEstadoMemoria<T>(
  chave: string,
  valorInicial: T | (() => T)
): [T, (val: T | ((prev: T) => T)) => void] {
  const [estado, setEstado] = useState<T>(() => {
    if (chave in store) return store[chave] as T;
    const inicial = typeof valorInicial === "function" ? (valorInicial as () => T)() : valorInicial;
    store[chave] = inicial;
    return inicial;
  });

  // A identidade do setter precisa ser estável: ele entra nas dependências dos
  // callbacks dos filtros, e um setter novo a cada render recriaria todos eles.
  const setEstadoSincronizado = useCallback(
    (novo: T | ((prev: T) => T)) => {
      setEstado((prev) => {
        const valor = typeof novo === "function" ? (novo as (p: T) => T)(prev) : novo;
        store[chave] = valor;
        return valor;
      });
    },
    [chave]
  );

  return [estado, setEstadoSincronizado];
}

/**
 * Esquece tudo o que começa com o prefixo.
 *
 * Serve para encerrar de verdade uma análise: sem isto, sair da tela e voltar
 * traz de volta o resumo, os achados e os filtros do arquivo anterior — que no
 * caso do SPED são razão social, CNPJ e o cadastro de participantes do cliente.
 * Os componentes montados não são notificados, então chame antes de desmontar
 * quem lê essas chaves.
 */
export function esquecerEstadoMemoria(prefixo: string): void {
  for (const chave of Object.keys(store)) {
    if (chave.startsWith(prefixo)) delete store[chave];
  }
}
