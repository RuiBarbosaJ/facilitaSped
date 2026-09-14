/**
 * Versão do leiaute contra a qual o dicionário desta pasta foi conferido.
 *
 * MANUTENÇÃO — o Ato COTEPE publica leiaute novo quase todo ano, e a Receita
 * valida o COD_VER do registro 0000 contra a data final da escrituração. Quando
 * sair uma versão nova:
 *
 *   1. Baixe o Guia Prático e a Nota Técnica vigentes em
 *      https://www.gov.br/sped/pt-br/assuntos/escrituracoes-digitais/efd-icms-ipi
 *   2. Confira, campo a campo, os registros de `registros.ts` que mudaram —
 *      principalmente `totalCampos` e os índices, que deslocam tudo o que vem
 *      depois.
 *   3. Atualize `LEIAUTE_CONFERIDO` para o novo COD_VER.
 *   4. Rode `npm run teste`: o teste de fidelidade byte a byte é o que prova
 *      que a leitura e a regravação continuam íntegras.
 *
 * Enquanto isso não é feito, nada quebra: o módulo nunca reescreve uma linha
 * com base no dicionário — ele apenas aponta divergências, e avisa o usuário
 * quando o arquivo declara uma versão diferente desta.
 */
export const LEIAUTE_CONFERIDO = "017";

export const FONTE_DO_LEIAUTE =
  "https://www.gov.br/sped/pt-br/assuntos/escrituracoes-digitais/efd-icms-ipi";
