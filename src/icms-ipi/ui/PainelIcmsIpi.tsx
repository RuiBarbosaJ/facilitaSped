import { Lock } from "lucide-react";

import { LIMITES } from "../limites";

/** O que a auditoria confere hoje. O que não está aqui, o módulo não promete. */
const CONFERENCIAS = [
  "Estrutura de cada registro contra o layout oficial: campo faltando, campo a mais, delimitador ausente.",
  "Hierarquia do bloco C: item e registro analítico sem a nota fiscal correspondente.",
  "Cadastro: item do C170 sem 0200 e unidade de medida sem 0190.",
  "CFOP incompatível com o tipo de operação declarado na nota.",
  "Totalizadores de fechamento de bloco divergentes da contagem real.",
  "Correções para o PVA: as que se deduzem do próprio arquivo entram no TXT gerado depois da sua revisão, com o relatório do que mudou. O que exige decisão fiscal é apontado, nunca alterado.",
];

/**
 * Explica o que a aba faz antes de o usuário entregar o arquivo — e mantém a
 * página de importação com a mesma composição de duas colunas da auditoria de
 * planilhas, em vez de uma zona de upload solta ocupando a tela inteira.
 *
 * Sem as caixas coloridas com ícone que emolduravam cada bloco: é texto de
 * leitura, e a hierarquia vem do título curto e do espaço entre os grupos.
 */
export function PainelIcmsIpi() {
  return (
    <div className="flex flex-col gap-5 text-sm">
      <p className="max-w-md text-text-secondary">
        Envie o arquivo <strong className="font-medium text-text-primary">.txt</strong> gerado pelo seu
        ERP para a EFD ICMS/IPI, do registro 0000 ao 9999.
      </p>

      <div>
        <p className="text-xs font-medium text-text-tertiary">O que é conferido</p>
        <ul className="mt-2 flex max-w-md list-disc flex-col gap-1.5 pl-4 text-text-secondary marker:text-text-tertiary">
          {CONFERENCIAS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <p className="max-w-md text-xs text-text-tertiary">
        Limite: {Math.round(LIMITES.TAMANHO_MAXIMO_BYTES / 1024 / 1024)} MB por arquivo — cerca de 800
        mil linhas numa escrituração típica, o equivalente a algo como 80 mil notas com sete itens cada.
        A EFD é por estabelecimento e por mês, então isso cobre a maioria dos contribuintes; um
        estabelecimento de altíssimo volume pode passar disso.
      </p>

      <p className="flex max-w-md items-start gap-2 text-xs text-text-tertiary">
        <Lock size={14} className="mt-px shrink-0 text-success" aria-hidden />
        <span>
          <strong className="font-medium text-text-primary">Fica no seu navegador.</strong> A leitura
          acontece em um worker local e a página não tem permissão para enviar dados a nenhum servidor. A
          assinatura digital e a transmissão continuam sendo feitas no PVA, com o seu certificado.
        </span>
      </p>
    </div>
  );
}
