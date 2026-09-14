"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Preferência de interface que sobrevive ao recarregamento da página.
 *
 * Diferente de `useEstadoMemoria`, que vive só enquanto a aba está aberta: aqui
 * o valor vai para o `localStorage`. A diferença importa para escolhas que o
 * usuário fez uma vez e não quer refazer — quais colunas ver numa grade de cem
 * colunas, por exemplo.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O QUE **NÃO** PODE SER GUARDADO AQUI
 *
 * Nada que venha do arquivo do cliente. A aba de ICMS/IPI promete que a
 * escrituração não sai do navegador e que "Encerrar análise" a apaga — e um
 * valor no `localStorage` sobrevive ao botão, ao fechamento da aba e à troca de
 * usuário na mesma máquina de escritório.
 *
 * A régua é a origem do dado: nome de coluna e largura vêm do LEIAUTE, que é
 * público e igual para todo mundo. Já um filtro de coluna guarda VALORES lidos
 * do arquivo — CNPJ de participante, número de documento —, e por isso os
 * filtros continuam em `useEstadoMemoria`, que morre com a aba.
 */

const ouvintesPorChave = new Map<string, Set<() => void>>();

/**
 * Cache do valor desserializado, por chave.
 *
 * `useSyncExternalStore` exige que `getSnapshot` devolva a MESMA referência
 * enquanto nada mudou — sem isto, cada render faria um `JSON.parse` novo, o
 * React veria um objeto diferente e entraria em laço infinito de re-render.
 */
const cache = new Map<string, { bruto: string | null; valor: unknown }>();

function ler<T>(chave: string, padrao: T): T {
  let bruto: string | null = null;
  try {
    bruto = localStorage.getItem(chave);
  } catch {
    // Storage bloqueado: o cache de módulo vira a fonte da verdade e a escolha
    // vale enquanto a aba viver. Devolver o padrão seco aqui deixava o seletor
    // de colunas morto — cada clique gravava no nada e a tela não mudava.
    const memorizado = cache.get(chave);
    return memorizado ? (memorizado.valor as T) : padrao;
  }

  const memorizado = cache.get(chave);
  if (memorizado && memorizado.bruto === bruto) return memorizado.valor as T;

  let valor = padrao;
  if (bruto !== null) {
    try {
      valor = JSON.parse(bruto) as T;
    } catch {
      // Valor corrompido por uma versão anterior: o padrão é melhor que quebrar.
      valor = padrao;
    }
  }
  cache.set(chave, { bruto, valor });
  return valor;
}

function avisar(chave: string): void {
  for (const ouvinte of ouvintesPorChave.get(chave) ?? []) ouvinte();
}

function inscrever(chave: string, aoMudar: () => void): () => void {
  const ouvintes = ouvintesPorChave.get(chave) ?? new Set();
  ouvintes.add(aoMudar);
  ouvintesPorChave.set(chave, ouvintes);

  // Outra aba mudou a mesma preferência.
  const aoTrocarEmOutraAba = (evento: StorageEvent) => {
    if (evento.key === chave) {
      cache.delete(chave);
      aoMudar();
    }
  };
  window.addEventListener("storage", aoTrocarEmOutraAba);

  return () => {
    ouvintes.delete(aoMudar);
    window.removeEventListener("storage", aoTrocarEmOutraAba);
  };
}

export function usePreferencia<T>(chave: string, padrao: T): [T, (valor: T) => void] {
  const assinar = useCallback((aoMudar: () => void) => inscrever(chave, aoMudar), [chave]);

  const valor = useSyncExternalStore(
    assinar,
    () => ler(chave, padrao),
    // No servidor não há storage: renderiza o padrão e o cliente reconcilia.
    () => padrao
  );

  const definir = useCallback(
    (novo: T) => {
      const bruto = JSON.stringify(novo);
      // O cache é gravado ANTES e independentemente do storage: é ele que o
      // getSnapshot lê quando o localStorage está bloqueado.
      cache.set(chave, { bruto, valor: novo });
      try {
        localStorage.setItem(chave, bruto);
      } catch {
        // Sem storage a escolha vale só para esta sessão — melhor que falhar.
      }
      avisar(chave);
    },
    [chave]
  );

  return [valor, definir];
}
