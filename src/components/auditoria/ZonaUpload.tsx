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
        className={`group relative flex min-h-72 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-8 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
          arrastando
            ? "border-accent bg-accent-soft"
            : "border-border-strong bg-surface-card hover:border-accent hover:bg-accent-soft/40"
        } ${bloqueada ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
      >
        <span
          className={`grid place-items-center size-16 rounded-2xl transition-colors ${
            arrastando ? "bg-accent text-accent-contrast" : "bg-accent-soft text-accent group-hover:bg-accent group-hover:text-accent-contrast"
          }`}
        >
          {processando ? (
            <Loader2 size={28} className="animate-spin" aria-hidden />
          ) : arrastando ? (
            <FileUp size={28} aria-hidden />
          ) : (
            <UploadCloud size={28} aria-hidden />
          )}
        </span>

        <div>
          <p className="text-base font-semibold">
            {processando ? "Auditando a planilha…" : arrastando ? "Solte para auditar" : "Arraste o relatório do Alterdata aqui"}
          </p>
          <p id={idDescricao} className="mt-1 text-sm text-text-secondary">
            {desabilitada && mensagemDesabilitada
              ? mensagemDesabilitada
              : "ou clique para escolher um arquivo .xls ou .xlsx. Nada sai do seu computador: a auditoria roda no navegador."}
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
