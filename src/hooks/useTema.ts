"use client";

import { useSyncExternalStore } from "react";

export type Tema = "claro" | "escuro" | "sistema";

const CHAVE = "tema";
const ouvintes = new Set<() => void>();

function ehTema(valor: string | null): valor is Tema {
  return valor === "claro" || valor === "escuro" || valor === "sistema";
}

/** Lê a preferência salva. Em aba anônima ou com storage bloqueado, cai no padrão. */
function lerPreferencia(): Tema {
  try {
    const salvo = localStorage.getItem(CHAVE);
    if (ehTema(salvo)) return salvo;
  } catch {
    // Storage indisponível: seguir o sistema é um padrão seguro.
  }
  return "sistema";
}

function sistemaPrefereEscuro(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Escreve o atributo que a variante `dark:` do Tailwind observa. É o mesmo que o
 * script inline do layout faz antes da primeira pintura — aqui só mantemos o
 * valor em dia quando o usuário troca de tema ou o sistema muda de preferência.
 */
function aplicar(tema: Tema): void {
  const escuro = tema === "escuro" || (tema === "sistema" && sistemaPrefereEscuro());
  document.documentElement.dataset.theme = escuro ? "dark" : "light";
}

function inscrever(aoMudar: () => void): () => void {
  ouvintes.add(aoMudar);

  // Outra aba trocou o tema.
  const aoTrocarEmOutraAba = (evento: StorageEvent) => {
    if (evento.key === CHAVE) {
      aplicar(lerPreferencia());
      aoMudar();
    }
  };
  window.addEventListener("storage", aoTrocarEmOutraAba);

  // O sistema mudou de claro para escuro (ou o contrário) com o modo "sistema" ativo.
  const consulta = window.matchMedia("(prefers-color-scheme: dark)");
  const aoTrocarNoSistema = () => {
    if (lerPreferencia() === "sistema") {
      aplicar("sistema");
      aoMudar();
    }
  };
  consulta.addEventListener("change", aoTrocarNoSistema);

  return () => {
    ouvintes.delete(aoMudar);
    window.removeEventListener("storage", aoTrocarEmOutraAba);
    consulta.removeEventListener("change", aoTrocarNoSistema);
  };
}

/** Troca o tema, persiste a escolha e avisa todos os componentes que a observam. */
export function definirTema(tema: Tema): void {
  try {
    localStorage.setItem(CHAVE, tema);
  } catch {
    // Sem persistência a troca ainda vale para esta sessão.
  }
  aplicar(tema);
  for (const ouvinte of ouvintes) ouvinte();
}

/**
 * Tema escolhido pelo usuário.
 *
 * `useSyncExternalStore` existe justamente para ler estado que vive fora do
 * React (aqui, o localStorage): ele recebe um retrato do servidor separado do
 * retrato do cliente, então a renderização estática não conflita com a
 * preferência salva no navegador.
 */
export function useTema(): Tema {
  return useSyncExternalStore(inscrever, lerPreferencia, () => "sistema");
}
