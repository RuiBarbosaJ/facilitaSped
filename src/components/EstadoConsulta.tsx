import { AlertCircle } from "lucide-react";

/** Spinner exibido enquanto o JSON das tabelas é baixado. */
export function Carregando() {
  return (
    <div className="flex justify-center items-center h-64" role="status" aria-live="polite">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-border-subtle border-t-accent" />
      <span className="sr-only">Carregando as tabelas do SPED...</span>
    </div>
  );
}

/** Falha no carregamento dos dados. */
export function MensagemErro({ mensagem }: { mensagem: string }) {
  return (
    <div
      role="alert"
      className="bg-danger-soft text-danger p-6 rounded-xl flex flex-col items-center justify-center gap-3 border border-border-subtle"
    >
      <AlertCircle size={28} aria-hidden />
      <p className="font-medium">{mensagem}</p>
      <p className="text-sm">Verifique se o script de sincronização foi executado.</p>
    </div>
  );
}
