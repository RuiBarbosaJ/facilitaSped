import { AlertCircle } from "lucide-react";

/** Spinner exibido enquanto o JSON das tabelas é baixado. */
export function Carregando() {
  return (
    <div className="flex justify-center items-center h-64" role="status" aria-live="polite">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      <span className="sr-only">Carregando as tabelas do SPED...</span>
    </div>
  );
}

/** Falha no carregamento dos dados. */
export function MensagemErro({ mensagem }: { mensagem: string }) {
  return (
    <div
      role="alert"
      className="bg-red-50 text-red-700 p-6 rounded-xl flex flex-col items-center justify-center gap-3 border border-red-200"
    >
      <AlertCircle size={32} aria-hidden />
      <p className="font-medium text-lg">{mensagem}</p>
      <p className="text-sm opacity-80">Verifique se o script de sincronização foi executado.</p>
    </div>
  );
}
