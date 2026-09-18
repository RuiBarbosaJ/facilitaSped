import { AlertCircle } from "lucide-react";

/** Quantas linhas o esqueleto desenha. O bastante para preencher a dobra. */
const LINHAS_DO_ESQUELETO = 12;

/** Larguras variadas: barra toda do mesmo tamanho não parece tabela, parece grade. */
const LARGURAS = ["w-24", "w-40", "w-12", "w-16", "w-14", "w-20"];

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
      <div className="flex items-center gap-2 border-b border-border-subtle bg-surface-head px-3 py-2">
        <span className="size-1.5 animate-pulse rounded-full bg-accent" aria-hidden />
        <span className="font-mono text-[11px] uppercase tracking-wider text-text-secondary">
          Indexando códigos e alíquotas…
        </span>
      </div>

      <div aria-hidden>
        {Array.from({ length: LINHAS_DO_ESQUELETO }, (_, linha) => (
          <div
            key={linha}
            className="flex items-center gap-6 border-b border-border-subtle px-3 py-2 last:border-b-0 odd:bg-surface-page/50"
          >
            {LARGURAS.map((largura, coluna) => (
              <span
                key={coluna}
                /*
                 * A opacidade cai da esquerda para a direita e a animação entra
                 * defasada por linha: sem isso, doze barras pulsando no mesmo
                 * compasso viram um estroboscópio, que é o oposto de "está
                 * quase pronto".
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
