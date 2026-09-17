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
  descricao = "ou clique para escolher um arquivo .xls ou .xlsx. Todo o processamento ocorre no seu próprio navegador para garantir a sua privacidade.",
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
        className={`group relative flex min-h-[320px] flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 overflow-hidden ${
          /*
             Sem halo colorido nem salto de escala. Uma sombra tingida com a cor
             de destaque é luz falsa — sombra é ausência de luz e não tem cor de
             marca. Quem responde ao arrasto é a borda e o fundo, que já mudam.
          */
          arrastando
            ? "border-accent bg-accent-soft shadow-(--shadow-card)"
            : "border-border-strong bg-surface-card hover:border-accent hover:bg-accent-soft/30"
        } ${bloqueada ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
      >
        <span
          className={`relative z-10 grid place-items-center size-20 rounded-md transition-all duration-500 ease-out ${
            arrastando
              ? "bg-accent text-accent-contrast"
              : "bg-accent-soft text-accent group-hover:bg-accent group-hover:text-accent-contrast"
          }`}
        >
          {processando ? (
            <Loader2 size={36} className="animate-spin" aria-hidden />
          ) : arrastando ? (
            <FileUp size={36} className="animate-bounce" aria-hidden />
          ) : (
            <UploadCloud size={36} className="transition-transform duration-300 group-hover:-translate-y-1" aria-hidden />
          )}
        </span>

        <div className="relative z-10">
          <p className="text-lg font-bold tracking-tight">
            {processando ? tituloProcessando : arrastando ? "Solte o arquivo agora" : titulo}
          </p>
          <p id={idDescricao} className="mt-2 text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
            {desabilitada && mensagemDesabilitada ? mensagemDesabilitada : descricao}
          </p>
        </div>

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
