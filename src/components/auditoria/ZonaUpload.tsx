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
}

const EXTENSOES = [".xls", ".xlsx"];

function ehPlanilha(arquivo: File): boolean {
  const nome = arquivo.name.toLowerCase();
  return EXTENSOES.some((ext) => nome.endsWith(ext));
}

/** Área de arrastar e soltar, que também funciona por clique e por teclado. */
export function ZonaUpload({ onArquivo, processando, desabilitada, mensagemDesabilitada, ref }: ZonaUploadProps) {
  const [arrastando, setArrastando] = useState(false);
  const [rejeitado, setRejeitado] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idDescricao = useId();

  const bloqueada = processando || Boolean(desabilitada);

  function receber(arquivos: FileList | null) {
    const arquivo = arquivos?.[0];
    if (!arquivo) return;
    if (!ehPlanilha(arquivo)) {
      setRejeitado(`"${arquivo.name}" não é uma planilha. Envie um arquivo .xls ou .xlsx.`);
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
          arrastando
            ? "border-accent bg-accent-soft scale-[1.02] shadow-2xl shadow-accent/10"
            : "border-border-strong bg-surface-card hover:border-accent hover:bg-accent-soft/30 hover:shadow-lg"
        } ${bloqueada ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
      >
        {/* Efeito de pulso animado quando o arquivo está sobre a área */}
        {arrastando && (
          <div className="absolute inset-0 bg-linear-to-b from-transparent to-accent/5 animate-pulse rounded-2xl pointer-events-none"></div>
        )}

        <span
          className={`relative z-10 grid place-items-center size-20 rounded-full transition-all duration-500 ease-out ${
            arrastando 
              ? "bg-accent text-accent-contrast scale-125 shadow-lg shadow-accent/40" 
              : "bg-accent-soft text-accent group-hover:bg-accent group-hover:text-accent-contrast group-hover:scale-110 group-hover:shadow-md"
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
            {processando ? "Auditando a planilha…" : arrastando ? "Solte o arquivo agora" : "Arraste o relatório do Alterdata aqui"}
          </p>
          <p id={idDescricao} className="mt-2 text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
            {desabilitada && mensagemDesabilitada
              ? mensagemDesabilitada
              : "ou clique para escolher um arquivo .xls ou .xlsx. Todo o processamento ocorre no seu próprio navegador para garantir a sua privacidade."}
          </p>
        </div>

        {/* A zona (role=button) é o único ponto de tabulação; o input só recebe o clique programático. */}
        <input
          ref={inputRef}
          type="file"
          tabIndex={-1}
          accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={aoEscolher}
          disabled={bloqueada}
          aria-label="Escolher planilha para auditoria"
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
