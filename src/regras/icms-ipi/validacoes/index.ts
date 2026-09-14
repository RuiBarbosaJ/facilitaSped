import type { RegraSped } from "../../nucleo/contrato";

/**
 * Regras da aba ICMS/IPI — o ponto de entrada do handoff.
 *
 * Está vazio de propósito: a entrega desta etapa foi o dicionário, que declara
 * O QUE a norma exige. Aqui mora COMO se confere — uma função por regra, cada
 * uma com seu teste.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * COMO ESCREVER UMA REGRA
 *
 * ```ts
 * import { tributacaoDoCstIcms, valorDe, numeroDe } from "../../nucleo/acesso";
 * import { DICIONARIO_SPED_ICMS_IPI as DIC } from "../dicionario-sped-icms-ipi";
 * import type { RegraSped } from "../../nucleo/contrato";
 *
 * const CODIGO = "FIS-C170-011";
 *
 * export const FIS_C170_011: RegraSped = {
 *   codigo: CODIGO,
 *   nome: "Operação isenta com imposto destacado",
 *   regraDoDicionario: CODIGO,          // amarra a função à norma declarada
 *   executar(contexto, apontar, podeApontar) {
 *     for (const documento of contexto.documentos) {
 *       // Saída rápida: documento sem movimento não entra.
 *       const codSit = valorDe(DIC, documento.campos, "COD_SIT");
 *       if (codSit && SITUACOES_SEM_MOVIMENTO.includes(codSit)) continue;
 *
 *       for (const item of documento.itens) {
 *         // Teto ANTES de formatar — ver PodeApontar em nucleo/contrato.ts.
 *         if (!podeApontar(CODIGO)) return;
 *
 *         const tributacao = tributacaoDoCstIcms(valorDe(DIC, item.campos, "CST_ICMS"));
 *         if (tributacao !== "40" && tributacao !== "41" && tributacao !== "50") continue;
 *
 *         const icms = numeroDe(valorDe(DIC, item.campos, "VL_ICMS"));
 *         if (icms === null || icms === 0) continue;
 *
 *         apontar({ … });
 *       }
 *     }
 *   },
 * };
 * ```
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O QUE NÃO FAZER — cada item já custou um bug neste repositório ou é
 * consequência direta de um que custou:
 *
 * · Não procure cadastro com busca linear. `contexto.produtos.get(cod)`, nunca
 *   `contexto.linhas.find(…)`: são ~400 mil itens contra ~545 mil linhas.
 * · Não formate o achado antes de consultar `podeApontar`.
 * · Não compare somatório de centavos com `===`. Use a `tolerancia` que a
 *   regra do dicionário declara.
 * · Não compare `CST_ICMS` inteiro contra `"40"`. O valor real é `"040"`, a
 *   regra nunca casa e — o pior — não quebra nada: ela só deixa de existir.
 * · Não aponte erro por campo `N` de valor vazio: vazio vale `0,00`.
 * · Não use `numeroDe` para decidir se um campo foi omitido. Ele devolve `0`
 *   para vazio; para distinguir, use `numeroOuNulo`.
 * · Não esqueça de excluir `COD_SIT` 02, 03, 04 e 05 das regras de totalizador
 *   e de presença de filho.
 * · Não exija C170 sem olhar o `IND_PERFIL`: perfil B tem documento legítimo
 *   com C190 e sem item nenhum.
 * · Não guarde acumulador do arquivo em variável de módulo. O parser já foi
 *   mordido por isso: dois arquivos na mesma sessão misturavam conteúdo.
 * · Não escreva em `linha.campos`. A regravação devolve o arquivo byte a byte,
 *   e o teste de fidelidade prova isso.
 * · Não coloque conteúdo fiscal na mensagem do achado — ela vai para a tela,
 *   para o log e para a exportação. CFOP e CST são inócuos; descrição de
 *   produto, nome de participante e valor de nota, não.
 * · Não importe nada desta pasta de um componente `"use client"`: o bundler
 *   arrastaria o dicionário e as tabelas para o bundle da página.
 */
export const REGRAS_ICMS_IPI: readonly RegraSped[] = [];
