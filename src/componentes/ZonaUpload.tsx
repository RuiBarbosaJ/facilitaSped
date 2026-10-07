"use client";

import { useId, useRef, useState, type DragEvent, type ChangeEvent, type Ref } from "react";
import { FileUp, Loader2, UploadCloud } from "lucide-react";

interface ZonaUploadProps {
  onArquivo: (arquivo: File) => void;
  processando: boolean;
  desabilitada?: boolean;
  mensagemDesabilitada?: string;
  /** Para devolver o foco à zona depois de "Nova auditoria". */
  ref?: Ref<HTMLDivElement>;
  /**
   * Textos e extensões aceitas. Os padrões descrevem a auditoria de planilhas;
   * a aba do SPED passa os seus para reaproveitar a mesma zona acessível em vez
   * de recriar uma — que foi como nasceu uma segunda versão sem rótulo, sem
   * foco visível e sem "arraste e solte" de verdade.
   */
  extensoes?: readonly string[];
  accept?: string;
  titulo?: string;
  tituloProcessando?: string;
  descricao?: string;
  /** Como o arquivo esperado se chama, para a mensagem de recusa. */
  nomeDoTipo?: string;
}

const EXTENSOES_PADRAO = [".xls", ".xlsx"] as const;
const ACCEPT_PADRAO =
  ".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Área de arrastar e soltar, que também funciona por clique e por teclado. */
export function ZonaUpload({
  onArquivo,
  processando,
  desabilitada,
  mensagemDesabilitada,
  ref,
  extensoes = EXTENSOES_PADRAO,
  accept = ACCEPT_PADRAO,
  titulo = "Arraste o relatório do Alterdata aqui",
  tituloProcessando = "Auditando a planilha…",
  descricao = "Planilha .xls ou .xlsx. Ela é lida no seu navegador — nada é enviado.",
  nomeDoTipo = "uma planilha",
}: ZonaUploadProps) {
  const [arrastando, setArrastando] = useState(false);
  const [rejeitado, setRejeitado] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idDescricao = useId();

  const bloqueada = processando || Boolean(desabilitada);

  function receber(arquivos: FileList | null) {
    const arquivo = arquivos?.[0];
    if (!arquivo) return;
    const nome = arquivo.name.toLowerCase();
    if (!extensoes.some((ext) => nome.endsWith(ext))) {
      setRejeitado(`"${arquivo.name}" não é ${nomeDoTipo}. Envie um arquivo ${extensoes.join(" ou ")}.`);
      return;
    }
    setRejeitado(null);
    onArquivo(arquivo);
  }

  function aoSoltar(evento: DragEvent<HTMLDivElement>) {
    evento.preventDefault();
    setArrastando(false);
    if (bloqueada) return;
    receber(evento.dataTransfer.files);
  }

  function aoSairArrastando(evento: DragEvent<HTMLDivElement>) {
    // Passar por cima do ícone ou do texto dispara dragleave no contêiner; só
    // desliga o destaque quando o cursor sai da zona de verdade.
    if (evento.currentTarget.contains(evento.relatedTarget as Node | null)) return;
    setArrastando(false);
  }

  function aoEscolher(evento: ChangeEvent<HTMLInputElement>) {
    receber(evento.target.files);
    // Permite reenviar o mesmo arquivo depois de uma nova auditoria.
    evento.target.value = "";
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={ref}
        role="button"
        tabIndex={bloqueada ? -1 : 0}
        aria-disabled={bloqueada}
        aria-describedby={idDescricao}
        onClick={() => !bloqueada && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (bloqueada) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!bloqueada) setArrastando(true);
        }}
        onDragLeave={aoSairArrastando}
        onDrop={aoSoltar}
        className={`group relative flex min-h-70 flex-col items-center justify-center gap-3 overflow-hidden rounded-lg border border-dashed p-8 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
          /*
             Sem halo colorido nem salto de escala. Uma sombra tingida com a cor
             de destaque é luz falsa — sombra é ausência de luz e não tem cor de
             marca. Quem responde ao arrasto é a borda e o fundo, que já mudam.
          */
          arrastando
            ? "border-accent bg-accent-soft"
            : "border-border-strong bg-surface-card hover:border-accent"
        } ${bloqueada ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
      >
        {/*
          O ícone sozinho, sem a caixa colorida de 80px que o emoldurava e sem
          o pulinho ao arrastar. A zona inteira já reage ao arrasto pela borda
          e pelo fundo; um segundo elemento se mexendo só disputava atenção.
        */}
        {processando ? (
          <Loader2 size={28} className="animate-spin text-accent" aria-hidden />
        ) : arrastando ? (
          <FileUp size={28} className="text-accent" aria-hidden />
        ) : (
          <UploadCloud size={28} className="text-accent" aria-hidden />
        )}

        <div>
          <p className="text-base font-semibold text-text-primary">
            {processando ? tituloProcessando : arrastando ? "Solte o arquivo agora" : titulo}
          </p>
          <p id={idDescricao} className="mx-auto mt-1 max-w-md text-sm text-text-secondary">
            {desabilitada && mensagemDesabilitada ? mensagemDesabilitada : descricao}
          </p>
        </div>

        {/*
          O botão que se vê. Arrastar é o atalho de quem já conhece; quem chega
          pela primeira vez procura onde clicar, e uma área tracejada não
          parece clicável. É só aparência: o clique é da zona inteira, que
          continua sendo o único ponto de tabulação.
        */}
        {!processando && !arrastando && (
          <span
            aria-hidden
            className="mt-1 inline-flex items-center rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast transition-colors group-hover:bg-accent-hover"
          >
            Escolher arquivo
          </span>
        )}

        {/* A zona (role=button) é o único ponto de tabulação; o input só recebe o clique programático. */}
        <input
          ref={inputRef}
          type="file"
          tabIndex={-1}
          accept={accept}
          className="sr-only"
          onChange={aoEscolher}
          disabled={bloqueada}
          aria-label={`Escolher ${nomeDoTipo} para auditoria`}
          suppressHydrationWarning
        />
      </div>

      {rejeitado && (
        <p role="alert" className="text-sm text-danger">
          {rejeitado}
        </p>
      )}
    </div>
  );
}
