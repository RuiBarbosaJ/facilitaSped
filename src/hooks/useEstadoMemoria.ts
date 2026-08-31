"use client";

import { useState } from "react";

const store: Record<string, any> = {};

export function useEstadoMemoria<T>(chave: string, valorInicial: T | (() => T)): [T, (val: T | ((prev: T) => T)) => void] {
  const [estado, setEstado] = useState<T>(() => {
    if (chave in store) {
      return store[chave];
    }
    const inicial = typeof valorInicial === "function" ? (valorInicial as () => T)() : valorInicial;
    store[chave] = inicial;
    return inicial;
  });

  const setEstadoSincronizado = (novo: T | ((prev: T) => T)) => {
    setEstado((prev) => {
      const valor = typeof novo === "function" ? (novo as (p: T) => T)(prev) : novo;
      store[chave] = valor;
      return valor;
    });
  };

  return [estado, setEstadoSincronizado];
}
