import type { RegraSped } from "../../nucleo/contrato";
import { FIS_C100_TOTAIS, FIS_C170_ANALITICO, FIS_C190_COERENCIA } from "./analitico";
import { FIS_C170_019, FIS_C170_020 } from "./cfop";
import { FIS_C170_001, FIS_C170_012, FIS_C170_013, MATRIZ_CST_ICMS } from "./cst";

/**
 * As regras da aba ICMS/IPI.
 *
 * Cobrem o bloco C — CST, CFOP e o efeito dominó C170 → C190 → C100. O que
 * cada uma exige está DECLARADO no dicionário, em `regrasDoRegistro`; o que
 * está aqui é como se confere. Quem for acrescentar regra escreve a norma lá
 * primeiro: o dicionário é auditável por um contador, e este arquivo não.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * QUATRO REGRAS EMITEM VÁRIOS CÓDIGOS DE ACHADO
 *
 * `MATRIZ_CST_ICMS`, `FIS_C170_ANALITICO`, `FIS_C190_COERENCIA` e
 * `FIS_C100_TOTAIS` não são uma regra por código: cada uma percorre os itens ou
 * os documentos UMA vez e emite sob os códigos declarados no dicionário. Num
 * arquivo de 100 MB são ~400 mil itens, e uma regra por código refaria a
 * leitura do CST e a conversão dos valores a cada passagem.
 *
 * O teto do motor continua sendo por CÓDIGO DE ACHADO — que é o que a UI
 * agrupa —, e não por regra, então nada se perde nessa junção.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O QUE ESTÁ DECLARADO E AINDA NÃO É CONFERIDO AQUI
 *
 * · FIS-C170-016 (redução de base sem VL_RED_BC no analítico) é o mesmo fato
 *   que FIS-C190-013 visto do lado do item: implementar as duas produziria
 *   dois achados para uma divergência só. Vale a do C190, que aponta a linha
 *   onde o campo está.
 * · FIS-C170-021 (sentido do CFOP × IND_OPER) já roda como FIS-014, no motor
 *   antigo de `src/icms-ipi/auditoria/`. Reescrevê-la aqui duplicaria o achado
 *   na tela até a migração daquele motor.
 * · FIS-C170-024 a 029, FIS-C100-010 e 013 a 017: fora do escopo do bloco C
 *   tratado nesta entrega (IPI, chave de acesso, datas, PIS/COFINS).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O QUE NÃO FAZER — cada item já custou um bug neste repositório ou é
 * consequência direta de um que custou:
 *
 * · Não procure cadastro com busca linear. `contexto.produtos.get(cod)`, nunca
 *   `contexto.linhas.find(…)`: são ~400 mil itens contra ~545 mil linhas.
 * · Não formate o achado antes de consultar `podeApontar`.
 * · Não compare somatório de centavos com `===`. Use `proximo` e
 *   `toleranciaDeSoma` de `comum.ts`.
 * · Não compare `CST_ICMS` inteiro contra `"40"`. O valor real é `"040"`, a
 *   regra nunca casa e — o pior — não quebra nada: ela só deixa de existir.
 * · Não aponte erro por campo `N` de valor vazio: vazio vale `0,00`.
 * · Não use `numeroDe` para decidir se um campo foi omitido. Ele devolve `0`
 *   para vazio; para distinguir, use `numeroOuNulo`.
 * · Não esqueça de excluir `COD_SIT` 02, 03, 04 e 05 das regras de totalizador
 *   e de presença de filho — é o que `temMovimento` faz.
 * · Não exija C170 sem olhar o `IND_PERFIL`: perfil B tem documento legítimo
 *   com C190 e sem item nenhum.
 * · Não guarde acumulador do arquivo em variável de módulo. O parser já foi
 *   mordido por isso: dois arquivos na mesma sessão misturavam conteúdo.
 * · Não escreva em `linha.campos`. A regravação devolve o arquivo byte a byte,
 *   e o teste de fidelidade prova isso.
 * · Não coloque conteúdo fiscal na MENSAGEM do achado — ela vai para a tela,
 *   para o log e para a exportação. CFOP e CST são inócuos; descrição de
 *   produto e nome de participante, não. Valor vai em `atual`/`esperado`, que
 *   é onde a UI o mostra como sugestão.
 * · Não importe nada desta pasta de um componente `"use client"`: o bundler
 *   arrastaria o dicionário e as tabelas para o bundle da página.
 */
export const REGRAS_ICMS_IPI: readonly RegraSped[] = [
  FIS_C170_001,
  MATRIZ_CST_ICMS,
  FIS_C170_012,
  FIS_C170_013,
  FIS_C170_019,
  FIS_C170_020,
  FIS_C170_ANALITICO,
  FIS_C190_COERENCIA,
  FIS_C100_TOTAIS,
];
