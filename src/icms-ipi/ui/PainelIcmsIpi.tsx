import { Info, Lock } from "lucide-react";

import { LIMITES } from "../limites";

/** O que a auditoria confere hoje. O que não está aqui, o módulo não promete. */
const CONFERENCIAS = [
  "Estrutura de cada registro contra o layout oficial: campo faltando, campo a mais, delimitador ausente.",
  "Hierarquia do bloco C: item e registro analítico sem a nota fiscal correspondente.",
  "Cadastro: item do C170 sem 0200 e unidade de medida sem 0190.",
  "CFOP incompatível com o tipo de operação declarado na nota.",
  "Totalizadores de fechamento de bloco divergentes da contagem real.",
];

/**
 * Explica o que a aba faz antes de o usuário entregar o arquivo — e mantém a
 * página de importação com a mesma composição de duas colunas da auditoria de
 * planilhas, em vez de uma zona de upload solta ocupando a tela inteira.
 */
export function PainelIcmsIpi() {
  return (
    <div className="flex flex-col gap-4 text-sm text-text-secondary">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
          <Info size={16} aria-hidden />
        </span>
        <div className="min-w-0">
          <p>
            Envie o arquivo <strong className="font-semibold text-text-primary">.txt</strong> gerado
            pelo seu ERP para a EFD ICMS/IPI, do registro 0000 ao 9999.
          </p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-xs text-text-tertiary">
            {CONFERENCIAS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-text-tertiary">
            Limite: {Math.round(LIMITES.TAMANHO_MAXIMO_BYTES / 1024 / 1024)} MB por arquivo — cerca
            de 800 mil linhas numa escrituração típica, o equivalente a algo como 80 mil notas com
            sete itens cada. A EFD é por estabelecimento e por mês, então isso cobre a maioria dos
            contribuintes; um estabelecimento de altíssimo volume pode passar disso.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface-card p-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-success-soft text-success">
          <Lock size={16} aria-hidden />
        </span>
        <p className="text-xs text-text-tertiary">
          <strong className="font-semibold text-text-primary">Fica no seu navegador.</strong> A
          leitura acontece em um worker local e a página não tem permissão para enviar dados a
          nenhum servidor. A assinatura digital e a transmissão continuam sendo feitas no PVA, com o
          seu certificado.
        </p>
      </div>
    </div>
  );
}
