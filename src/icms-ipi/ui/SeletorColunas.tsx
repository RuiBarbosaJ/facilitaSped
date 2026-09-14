"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Columns3, RotateCcw } from "lucide-react";

import type { ColunaGrade, EstadoDasColunas } from "../leiaute/colunas";

const LARGURA = 300;
const MARGEM = 8;

interface SeletorColunasProps {
  /** Todas as colunas do arquivo — o universo da escolha. */
  colunas: ColunaGrade[];
  /** As que a grade desenha agora. */
  visiveis: ColunaGrade[];
  /** Ausentes (não se aplicam) e em branco (têm o campo, ninguém preencheu). */
  estado: EstadoDasColunas;
  /** Decisões explícitas já tomadas. Ausente = automático. */
  escolha: Record<string, boolean>;
  onAlternar: (nome: string, visivel: boolean) => void;
  onRestaurar: () => void;
  onMostrarTodas: () => void;
  /** Coluna que nunca pode ser escondida — a referência da linha. */
  fixa: string;
  /** Colunas com filtro ativo: ficam travadas visíveis. */
  filtradas: ReadonlySet<string>;
  /** Colunas COM DADOS escondidas por escolha — o número que merece alarme. */
  cheiasOcultas: number;
  /** "Mostrar todas" ativo nesta sessão. */
  revelarTudo: boolean;
}

/**
 * Gerenciador de colunas da grade.
 *
 * Um arquivo SPED vira um planilhão de cem colunas em que cada linha preenche
 * um punhado — o C170 tem 38 campos, o 0000 tem 14, e na grade unificada todo o
 * resto fica vazio. Ler isso sem controle é atravessar telas de traços atrás de
 * uma informação.
 *
 * A grade esconde sozinha só o que NÃO SE APLICA ao recorte — a coluna que
 * nenhuma linha possui. Coluna que as linhas possuem e está em branco fica na
 * tela e ganha um selo: é campo existente que ninguém preencheu, e o contador
 * precisa vê-lo. Este menu existe para revelar uma coluna que não se aplica e
 * para tirar da frente uma coluna cheia que não interessa agora.
 *
 * A escolha vai para o `localStorage`: quem monta a vista uma vez não a monta
 * de novo amanhã.
 */
export function SeletorColunas({
  colunas,
  visiveis,
  estado,
  escolha,
  onAlternar,
  onRestaurar,
  onMostrarTodas,
  fixa,
  filtradas,
  cheiasOcultas,
  revelarTudo,
}: SeletorColunasProps) {
  const idMenu = useId();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [posicao, setPosicao] = useState<{ top: number; left: number } | null>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const nomesVisiveis = useMemo(() => new Set(visiveis.map((c) => c.nome)), [visiveis]);
  const personalizado = Object.keys(escolha).length > 0 || revelarTudo;
  const ocultas = colunas.length - visiveis.length;

  const encontradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return colunas;
    return colunas.filter(
      (c) => c.titulo.toLowerCase().includes(termo) || c.nome.toLowerCase().includes(termo)
    );
  }, [colunas, busca]);

  function fechar() {
    setAberto(false);
    setBusca("");
  }

  useLayoutEffect(() => {
    if (!aberto) return;

    function reposicionar() {
      const alvo = botaoRef.current?.getBoundingClientRect();
      if (!alvo) return;
      const limite = window.innerWidth - LARGURA - MARGEM;
      setPosicao({
        top: alvo.bottom + 4,
        left: Math.max(MARGEM, Math.min(alvo.right - LARGURA, limite)),
      });
    }

    reposicionar();
    window.addEventListener("scroll", reposicionar, true);
    window.addEventListener("resize", reposicionar);
    return () => {
      window.removeEventListener("scroll", reposicionar, true);
      window.removeEventListener("resize", reposicionar);
    };
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;

    function aoClicarFora(evento: MouseEvent) {
      const alvo = evento.target as Node;
      if (menuRef.current?.contains(alvo) || botaoRef.current?.contains(alvo)) return;
      fechar();
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key !== "Escape") return;
      fechar();
      botaoRef.current?.focus();
    }

    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  const titulo = `Colunas: ${visiveis.length} de ${colunas.length}${
    ocultas > 0 ? ` (${ocultas} ocultas)` : ""
  }`;

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        onClick={() => (aberto ? fechar() : setAberto(true))}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        aria-controls={aberto ? idMenu : undefined}
        title={titulo}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border-strong bg-surface-card px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-page focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Columns3 size={14} aria-hidden />
        Colunas
        <span className="tabular-nums text-text-tertiary">
          {visiveis.length}/{colunas.length}
        </span>
        {ocultas > 0 && (
          <span className="tabular-nums text-text-tertiary">
            · {ocultas} {ocultas === 1 ? "oculta" : "ocultas"}
          </span>
        )}
        {cheiasOcultas > 0 && (
          <span
            className="rounded bg-warning-soft px-1 text-[10px] font-semibold text-warning"
            title={`${cheiasOcultas} ${cheiasOcultas === 1 ? "coluna com dados está escondida" : "colunas com dados estão escondidas"} por sua escolha`}
          >
            {cheiasOcultas} com dados
          </span>
        )}
      </button>

      {aberto && posicao && (
        <div
          ref={menuRef}
          id={idMenu}
          role="dialog"
          aria-label="Escolher colunas visíveis"
          style={{ top: posicao.top, left: posicao.left, width: LARGURA }}
          className="fixed z-50 rounded-xl border border-border-strong bg-surface-card p-3 text-left shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-text-primary">Colunas da grade</span>
            {personalizado && (
              <button
                type="button"
                onClick={onRestaurar}
                title="Voltar ao automático: mostra as preenchidas, esconde as vazias"
                className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-accent hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <RotateCcw size={12} aria-hidden />
                Automático
              </button>
            )}
          </div>

          {cheiasOcultas > 0 && (
            <p className="mb-2 rounded bg-warning-soft px-2 py-1 text-[11px] leading-snug text-warning">
              {cheiasOcultas === 1
                ? "1 coluna com dados está escondida por sua escolha."
                : `${cheiasOcultas} colunas com dados estão escondidas por sua escolha.`}{" "}
              A escolha vale para todos os arquivos até você restaurar o automático.
            </p>
          )}

          <p className="mb-2 text-[11px] leading-snug text-text-tertiary">
            Colunas que nenhuma linha do recorte possui ficam escondidas. Colunas em branco — o
            campo existe e ninguém preencheu — continuam na grade, com selo.
          </p>

          <input
            type="text"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder={`Buscar entre ${colunas.length} colunas...`}
            aria-label="Buscar coluna"
            className="mb-2 w-full rounded border border-border-strong bg-surface-page px-2 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
          />

          <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto text-xs">
            {encontradas.length === 0 ? (
              <span className="p-1 text-text-tertiary">Nenhuma coluna encontrada.</span>
            ) : (
              encontradas.map((coluna) => {
                const travada = coluna.nome === fixa || filtradas.has(coluna.nome);
                const ausente = estado.ausentes.has(coluna.nome);
                const emBranco = estado.emBranco.has(coluna.nome);

                return (
                  <label
                    key={coluna.nome}
                    className={`flex items-center gap-2 rounded px-1 py-1 ${
                      travada ? "opacity-60" : "cursor-pointer hover:bg-surface-page"
                    }`}
                    title={
                      coluna.nome === fixa
                        ? "O registro identifica a linha e não pode ser escondido"
                        : filtradas.has(coluna.nome)
                          ? "Coluna com filtro ativo — limpe o filtro para poder escondê-la"
                          : coluna.nome
                    }
                  >
                    <input
                      type="checkbox"
                      checked={nomesVisiveis.has(coluna.nome)}
                      disabled={travada}
                      aria-describedby={travada ? `${idMenu}-${coluna.nome}` : undefined}
                      onChange={(evento) => onAlternar(coluna.nome, evento.target.checked)}
                      className="shrink-0 rounded border-border-strong text-accent focus:ring-accent"
                    />
                    <span className="min-w-0 flex-1 truncate text-text-primary">
                      {coluna.titulo}
                    </span>
                    {coluna.nome === fixa && (
                      <span
                        id={`${idMenu}-${coluna.nome}`}
                        className="shrink-0 rounded bg-surface-page px-1 text-[10px] text-text-tertiary"
                      >
                        fixa
                      </span>
                    )}
                    {filtradas.has(coluna.nome) && coluna.nome !== fixa && (
                      <span
                        id={`${idMenu}-${coluna.nome}`}
                        className="shrink-0 rounded bg-accent-soft px-1 text-[10px] text-accent"
                      >
                        filtrada
                      </span>
                    )}
                    {ausente && (
                      <span
                        className="shrink-0 rounded bg-surface-page px-1 text-[10px] text-text-tertiary"
                        title="Nenhuma linha do recorte atual possui este campo"
                      >
                        não se aplica
                      </span>
                    )}
                    {emBranco && (
                      <span
                        className="shrink-0 rounded bg-warning-soft px-1 text-[10px] text-warning"
                        title="As linhas possuem este campo e nenhuma o preencheu"
                      >
                        em branco
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>

          <p className="mt-2 flex items-center justify-between gap-2 border-t border-border-subtle pt-2 text-[11px] text-text-tertiary">
            <span>
              {visiveis.length} de {colunas.length} visíveis
            </span>
            {ocultas > 0 && (
              <button
                type="button"
                onClick={onMostrarTodas}
                className="font-medium text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Mostrar todas
              </button>
            )}
          </p>
        </div>
      )}
    </>
  );
}
