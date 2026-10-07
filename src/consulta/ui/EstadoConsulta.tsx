import { AlertCircle } from "lucide-react";
import { AVISO_REGRA_SEM_NCM } from "@/pis-cofins/auditoria";

/** Quantas linhas o esqueleto desenha. O bastante para preencher a dobra. */
const LINHAS_DO_ESQUELETO = 12;

/** As colunas da consulta: NCM, natureza, descrição, vigência. */
const LARGURAS = ["w-32", "w-8", "flex-1 max-w-md", "w-24"];

/**
 * O que a tela mostra enquanto as tabelas da Receita são baixadas.
 *
 * Um esqueleto da própria tabela, e não um disco girando. A diferença é o que
 * ele comunica: o disco diz "espere" e nada mais; o esqueleto diz o que vem
 * aí — quantas colunas, em que ordem, que forma tem o dado — e a transição
 * para o conteúdo real deixa de ser um salto de layout.
 *
 * O texto também mudou. "Carregando as tabelas do SPED" descreve o que o
 * programa faz; "Indexando códigos e alíquotas" descreve o que o usuário está
 * esperando, no vocabulário dele.
 */
export function Carregando() {
  return (
    <div
      className="overflow-hidden rounded-lg border border-border-subtle bg-surface-card"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 px-3 py-2 shadow-[inset_0_-1px_0_var(--border-subtle)]">
        <span className="size-1.5 animate-pulse rounded-full bg-accent" aria-hidden />
        <span className="text-xs text-text-secondary">Indexando códigos e alíquotas…</span>
      </div>

      <div aria-hidden>
        {Array.from({ length: LINHAS_DO_ESQUELETO }, (_, linha) => (
          <div
            key={linha}
            className="flex items-center gap-6 border-b border-border-subtle px-3 py-3 last:border-b-0"
          >
            {LARGURAS.map((largura, coluna) => (
              <span
                key={coluna}
                /*
                 * A animação entra defasada por linha: sem isso, doze barras
                 * pulsando no mesmo compasso viram um estroboscópio, que é o
                 * oposto de "está quase pronto".
                 */
                className={`h-3 animate-pulse rounded-sm bg-border-subtle ${largura}`}
                style={{ animationDelay: `${(linha * 60 + coluna * 40) % 900}ms` }}
              />
            ))}
          </div>
        ))}
      </div>

      <span className="sr-only">Indexando os códigos e as alíquotas das tabelas do SPED.</span>
    </div>
  );
}

/** A coluna de CSTs enquanto os dados chegam: a mesma forma, sem os nomes. */
export function EsqueletoSeletor() {
  return (
    <div aria-hidden className="flex gap-1 lg:flex-col lg:gap-0.5">
      {Array.from({ length: 8 }, (_, i) => (
        <span
          key={i}
          className="flex shrink-0 items-center gap-2.5 px-2.5 py-1.5 lg:w-full"
        >
          <span className="h-3 w-5 animate-pulse rounded-sm bg-border-subtle" />
          <span className="h-3 w-24 animate-pulse rounded-sm bg-border-subtle lg:flex-1" />
        </span>
      ))}
    </div>
  );
}

/** Falha no carregamento dos dados. */
export function MensagemErro({ mensagem }: { mensagem: string }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border-subtle bg-danger-soft p-6 text-danger"
    >
      <AlertCircle size={28} aria-hidden />
      <p className="font-medium">{mensagem}</p>
      <p className="text-sm">Se o problema continuar, avise o responsável pelo sistema.</p>
    </div>
  );
}

export interface OutroRecorte {
  cst: string;
  nome: string;
  total: number;
}

interface SemResultadosProps {
  /** O que foi buscado, já por extenso: "o NCM 1006.40.00", "“cerveja”". */
  busca: string;
  /** "no CST 06" ou "em nenhuma tabela" — onde a busca não achou nada. */
  onde: string;
  /** Os recortes em que a mesma busca acha regras. */
  outros: OutroRecorte[];
  /** O termo é um código: a ressalva das regras escritas só por texto vale. */
  ehCodigo: boolean;
  onTrocar: (cst: string) => void;
}

/**
 * A busca não achou nada no recorte escolhido.
 *
 * Um estado vazio que só diz "nenhum resultado" deixa a pessoa sem saída. Este
 * diz onde a mesma busca TEM resultado e leva até lá num clique. Quando não há
 * resultado em lugar nenhum e o termo é um NCM, repete a ressalva que a
 * auditoria já faz: boa parte das regras descreve o produto só por texto, e
 * "não está na tabela" não quer dizer "é tributado".
 */
export function SemResultados({ busca, onde, outros, ehCodigo, onTrocar }: SemResultadosProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-strong/40 px-6 py-14 text-center">
      <p className="text-sm font-medium text-text-primary">
        Nenhuma regra para {busca} {onde}.
      </p>

      {outros.length > 0 ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-sm text-text-secondary">A busca encontra regras em</span>
          {outros.map((outro) => (
            <button
              key={outro.cst}
              type="button"
              onClick={() => onTrocar(outro.cst)}
              className="inline-flex items-center gap-2 rounded-md border border-border-subtle bg-surface-card px-2.5 py-1 text-sm text-text-primary transition-colors hover:border-accent hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {outro.nome}
              <span className="font-mono text-xs text-text-tertiary">{outro.total}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="max-w-lg text-sm text-text-secondary">
          {ehCodigo ? AVISO_REGRA_SEM_NCM : "Confira a grafia ou busque pelo NCM do produto."}
        </p>
      )}
    </div>
  );
}
