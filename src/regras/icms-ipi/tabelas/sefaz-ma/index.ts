import type { RegraValidacaoCustomizada } from "../../../nucleo/tipos";
import type { TabelaEstadual } from "../tipos";

/**
 * Tabelas da SEFAZ-MA — tabela 5.1.1 (ajustes da apuração) e 5.3 (benefícios).
 *
 * ESTE ARQUIVO NÃO CONTÉM OS CÓDIGOS. Eles não foram transcritos porque a
 * publicação oficial não estava disponível, e um código de ajuste inventado é
 * pior do que nenhum: ele faria a auditoria aprovar um lançamento que a SEFAZ
 * vai glosar, com a aparência de uma conferência que aconteceu.
 *
 * O que está aqui é a MODELAGEM — como a tabela entra, como é carregada, e o
 * que dá para conferir sem ela. Quem for preencher encontra o roteiro no fim.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O QUE SE VALIDA SEM A TABELA
 *
 * O código de ajuste é estruturado (`MA` + 6 dígitos), e a estrutura é federal
 * mesmo quando o conteúdo é estadual. Isso permite conferir formato, prefixo de
 * UF e — o mais valioso — o fechamento aritmético dos ajustes contra o E110,
 * que independe de saber o que cada código significa.
 *
 * O QUE NÃO SE VALIDA SEM A TABELA
 *
 * Se o código EXISTE, se estava vigente no período escriturado, se cabe naquele
 * CST e naquele CFOP, e se o benefício declarado corresponde ao dispositivo
 * legal citado. Nada disso é dedutível: exige a publicação.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DUAS CORREÇÕES DE NOMENCLATURA QUE CUSTAM CARO
 *
 * 1. O campo do E111 e do E220 chama-se `COD_AJ_APUR`. `COD_AJ`, sem sufixo, é
 *    o campo do C197/D197, que aponta para a tabela 5.3. Ler `COD_AJ` num E111
 *    devolve `null` — e a regra que fizer isso não acusa erro: ela simplesmente
 *    nunca dispara, e a apuração passa sem conferência nenhuma.
 *
 * 2. `VL_AJ_DEBITOS` (E110, posição 3) e `VL_AJ_CREDITOS` (posição 7) NÃO são
 *    os campos alimentados pelo E111 — eles recebem os ajustes vindos de
 *    documento fiscal (C197/D197). O E111 alimenta `VL_TOT_AJ_DEBITOS`
 *    (posição 4) e `VL_TOT_AJ_CREDITOS` (posição 8). Confundir os dois pares
 *    faz a regra de fechamento acusar divergência em toda apuração que tenha
 *    ajuste de documento fiscal — ou seja, quase todas.
 */

/**
 * Tabelas do Maranhão. `null` enquanto os códigos não forem transcritos.
 *
 * `null`, e não um objeto de listas vazias: listas vazias fariam toda regra
 * concluir "este código não existe na tabela" e reprovar ajuste legítimo. O
 * `null` obriga quem consome a passar pelo caminho da degradação.
 */
export const TABELA_SEFAZ_MA: TabelaEstadual | null = null;

/**
 * O que dá para conferir sem a tabela publicada.
 *
 * Nenhuma delas consulta a tabela: são todas estruturais ou aritméticas. Por
 * isso valem para QUALQUER UF, e não só para o Maranhão.
 */
export const REGRAS_ESTRUTURAIS_DE_AJUSTE: readonly RegraValidacaoCustomizada[] = [
  {
    id: "MA-E111-001",
    nome: "Formato do código de ajuste da apuração",
    expressao: '/^[A-Z]{2}\\d{6}$/.test(COD_AJ_APUR)',
    descricao:
      "O código de ajuste é a sigla da UF seguida de seis dígitos. O formato é federal, ainda que o conteúdo seja estadual.",
    severidade: "erro",
    procedencia: "tabela-oficial",
    camposEnvolvidos: ["COD_AJ_APUR"],
  },
  {
    id: "MA-E111-002",
    nome: "Prefixo do código de ajuste divergente da UF do declarante",
    condicao: "Registro E111 — ajuste da apuração do ICMS próprio.",
    expressao: "COD_AJ_APUR.slice(0, 2) === UF(0000)",
    descricao:
      "O ajuste da apuração própria usa código publicado pela UF do estabelecimento. Prefixo de outro estado denuncia código copiado de outra escrituração.",
    severidade: "erro",
    procedencia: "guia-pratico",
    camposEnvolvidos: ["COD_AJ_APUR"],
    observacao:
      "NÃO vale para o E220: lá o ajuste é da apuração de ST, e o prefixo é a UF do E200 — o estado do destinatário ou do substituído —, nunca a do declarante. Aplicar esta regra ao E220 acusa erro em toda apuração de ST interestadual.",
  },
  {
    id: "MA-E111-006",
    nome: "Ajustes da apuração não fecham com o E110",
    condicao: "Existe E110 no arquivo.",
    expressao:
      "soma(E111.VL_AJ_APUR por tipo de ajuste) ≈ campo correspondente do E110 (VL_TOT_AJ_DEBITOS, VL_ESTORNOS_CRED, VL_TOT_AJ_CREDITOS, VL_ESTORNOS_DEB)",
    descricao:
      "Os ajustes detalhados no E111 têm de reproduzir os totais declarados na apuração. É a conferência mais valiosa do bloco E — e não depende de saber o que cada código significa.",
    severidade: "erro",
    procedencia: "guia-pratico",
    camposEnvolvidos: ["COD_AJ_APUR", "VL_AJ_APUR"],
    tolerancia: 0.01,
    observacao:
      "O tipo do ajuste é o QUARTO caractere do código (índice 3), e é ele que diz qual campo do E110 a soma alimenta. Cuidado com o par errado: VL_AJ_DEBITOS e VL_AJ_CREDITOS recebem ajustes de DOCUMENTO FISCAL (C197/D197), não do E111.",
  },
  {
    id: "MA-E110-009",
    nome: "Saldo da apuração incoerente",
    condicao: "Existe E110 no arquivo.",
    expressao:
      "saldo = (VL_TOT_DEBITOS + VL_AJ_DEBITOS + VL_TOT_AJ_DEBITOS + VL_ESTORNOS_CRED) - (VL_TOT_CREDITOS + VL_AJ_CREDITOS + VL_TOT_AJ_CREDITOS + VL_ESTORNOS_DEB + VL_SLD_CREDOR_ANT); saldo > 0 ? VL_SLD_APURADO ≈ saldo : VL_SLD_CREDOR_TRANSPORTAR ≈ -saldo",
    descricao: "Fecha a apuração do ICMS próprio pela soma de débitos, créditos e ajustes.",
    severidade: "erro",
    procedencia: "guia-pratico",
    camposEnvolvidos: [
      "VL_TOT_DEBITOS", "VL_AJ_DEBITOS", "VL_TOT_AJ_DEBITOS", "VL_ESTORNOS_CRED",
      "VL_TOT_CREDITOS", "VL_AJ_CREDITOS", "VL_TOT_AJ_CREDITOS", "VL_ESTORNOS_DEB",
      "VL_SLD_CREDOR_ANT", "VL_SLD_APURADO", "VL_SLD_CREDOR_TRANSPORTAR",
    ],
    tolerancia: 0.01,
  },
  {
    id: "MA-E110-010",
    nome: "ICMS a recolher incoerente com as deduções",
    condicao: "Existe E110 no arquivo.",
    expressao:
      "VL_ICMS_RECOLHER ≈ max(0, VL_SLD_APURADO - VL_TOT_DED) && NÃO (VL_ICMS_RECOLHER > 0 && VL_SLD_CREDOR_TRANSPORTAR > 0)",
    descricao:
      "Ou há imposto a recolher, ou há saldo credor a transportar — nunca os dois no mesmo período.",
    severidade: "erro",
    procedencia: "guia-pratico",
    camposEnvolvidos: ["VL_SLD_APURADO", "VL_TOT_DED", "VL_ICMS_RECOLHER", "VL_SLD_CREDOR_TRANSPORTAR"],
    tolerancia: 0.01,
  },
];

/**
 * ROTEIRO PARA PREENCHER ESTA TABELA
 *
 * 1. Baixe a tabela 5.1.1 vigente do Maranhão no portal da SEFAZ-MA e a 5.3 no
 *    Portal Nacional da NF-e, anotando a versão e a data de publicação.
 * 2. Gere `public/data/estaduais/ma.json` no formato de `TabelaEstadual`, e
 *    acrescente a UF ao manifesto `public/data/estaduais/index.json`.
 * 3. NÃO grave a versão em `public/data/sync-meta.json`: aquelas chaves `5.1.1`
 *    e `5.1.2` pertencem à EFD-Contribuições e seriam sobrescritas.
 * 4. Troque `TABELA_SEFAZ_MA` de `null` pelo carregamento da UF lida do 0000.
 * 5. Estenda `scripts/sync-tabelas.ts` para as UFs, seguindo o caminho que já
 *    existe para as tabelas federais (cron, git diff, commit condicional).
 *
 * ANTES DISSO, DUAS COISAS PRECISAM MUDAR NO LEITOR — e elas bloqueiam
 * qualquer regra de bloco E, com ou sem tabela:
 *
 * a) `features/icms-ipi/layout/registros.ts` conhece o E110 e mais nenhum registro
 *    de apuração. E111, E112, E113, E115, E116 e todo o bloco E2 caem em
 *    "registro fora do escopo" — são lidos e preservados, mas nenhum campo
 *    deles é acessível por nome.
 *
 * b) `rotear()` em `worker/parser.ts` empilha em `estrutura.apuracao` tudo que
 *    começa com "E1", numa lista PLANA, sem pai e sem filhos: um E111 não sabe
 *    a qual E110 pertence. E o bloco E2 (apuração da ST) começa com "E2" e
 *    portanto nunca chega ali.
 */
