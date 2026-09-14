/**
 * Contratos do dicionário de dados do SPED.
 *
 * Esta pasta é o "cérebro fiscal" da plataforma: a fonte de verdade sobre o que
 * cada campo de cada registro significa, quais valores aceita e com quem se
 * relaciona. As duas abas da auditoria — ICMS/IPI e PIS/COFINS — declaram seus
 * dicionários em pastas separadas usando ESTES mesmos contratos, e é só isso que
 * garante que um motor escrito para uma aba entenda o dicionário da outra.
 *
 * A separação entre `nucleo/` e as pastas por aba não é organização estética. As
 * duas escriturações são leiautes DIFERENTES, publicados por órgãos diferentes,
 * com versões que avançam em datas diferentes: o C170 da EFD ICMS/IPI e o C170
 * da EFD-Contribuições têm o mesmo nome e campos distintos. Misturá-los num
 * dicionário só faria a validação de uma aba apontar erro na outra.
 */

/**
 * Tipo do dado conforme o Guia Prático: `C` (alfanumérico) ou `N` (numérico).
 *
 * É a classificação NORMATIVA, e é de propósito mais grosseira do que a do
 * layout de exibição (`features/icms-ipi/layout/tipos.ts`, que distingue valor de
 * alíquota de quantidade para formatar a grade). Aqui interessa o que o PVA
 * cobra: um campo `N` que chega com letra é rejeição de arquivo.
 */
export type TipoDado = "C" | "N";

/**
 * Obrigatoriedade do campo, na notação do próprio Guia Prático.
 *
 * - `O`  — obrigatório: ausência é erro em qualquer hipótese.
 * - `OC` — obrigatório condicional: exigido só quando a condição do campo se
 *          verifica. É a categoria mais perigosa do dicionário. Tratar `OC`
 *          como `O` reprova escrituração legítima em massa; tratar como `N`
 *          deixa passar omissão real. Todo campo `OC` DEVE trazer `condicao`
 *          preenchida dizendo quando ele passa a ser exigido.
 * - `N`  — não obrigatório.
 */
export type Obrigatoriedade = "O" | "OC" | "N";

/**
 * De onde veio a afirmação deste campo.
 *
 * O dicionário é consultado por um contador que vai assinar a escrituração. Ele
 * precisa poder distinguir "o Guia Prático diz isto" de "inferimos isto". Um
 * campo `inferido` que produz achado deve ser apresentado com ressalva na UI —
 * nunca com a mesma autoridade de um campo conferido.
 */
export type Procedencia =
  /** Conferido campo a campo contra o Guia Prático da versão declarada. */
  | "guia-pratico"
  /** Conferido contra uma tabela oficial publicada (CFOP, CST, NCM, 5.1.1…). */
  | "tabela-oficial"
  /** Conferido contra ato normativo estadual (SEFAZ-MA e congêneres). */
  | "norma-estadual"
  /** Deduzido do leiaute e do comportamento do PVA; carece de conferência. */
  | "inferido";

export type Severidade = "critico" | "erro" | "alerta" | "info";

/** Um valor de domínio fechado e o que ele significa. */
export interface ValorValido {
  readonly valor: string;
  readonly descricao: string;
  /** Vigência inicial, quando o valor entrou no leiaute (formato `AAAA-MM`). */
  readonly desde?: string;
  /** Vigência final, quando o valor foi revogado (formato `AAAA-MM`). */
  readonly ate?: string;
}

/**
 * Integridade referencial entre registros: "este campo precisa existir ali".
 *
 * É o cruzamento que sustenta a maior parte dos achados de cadastro — o
 * `COD_ITEM` do C170 que não foi cadastrado no 0200, a `UNID` que não existe no
 * 0190. Declarar isso como DADO, e não como código, é o que permite uma única
 * rotina genérica cobrir todas as referências do leiaute em vez de uma função
 * copiada para cada uma.
 */
export interface RegraRelacional {
  /** Código estável, citado no achado. Ex.: `REL-C170-0200-COD_ITEM`. */
  readonly id: string;
  /** Registro onde o valor precisa estar cadastrado. Ex.: `"0200"`. */
  readonly registroAlvo: string;
  /** Campo que é a chave no registro alvo. Ex.: `"COD_ITEM"`. */
  readonly campoAlvo: string;
  readonly descricao: string;
  readonly severidade: Severidade;
  /**
   * Quando a referência só é exigida em certas condições.
   *
   * `C100.COD_PART` é o caso clássico: a nota de emissão própria para
   * consumidor final não tem participante, e cobrar a referência ali
   * transformaria toda venda no balcão em achado.
   */
  readonly condicao?: string;
}

/**
 * Regra lógica que envolve mais de um campo — ou mais de um registro.
 *
 * A `expressao` é intencionalmente uma STRING, não uma função. Três motivos, em
 * ordem de importância:
 *
 * 1. O dicionário precisa ser serializável e auditável. Um contador, um fiscal
 *    ou um revisor tem de conseguir ler a regra sem abrir o motor.
 * 2. A implementação da regra vive em `regras/`, onde ganha teste próprio. Se a
 *    lógica morasse aqui como função, o dicionário viraria motor — e a fronteira
 *    que separa "o que a norma diz" de "como a gente confere" se perderia.
 * 3. Nada aqui é avaliado dinamicamente. `eval` sobre conteúdo derivado de um
 *    arquivo do usuário seria execução de código arbitrário na aba dele.
 *
 * O campo `implementadaEm` fecha o ciclo: aponta o código da regra que confere
 * esta expressão. Vazio significa "norma mapeada, conferência ainda não escrita"
 * — que é informação útil, e não uma falha.
 */
export interface RegraValidacaoCustomizada {
  /** Código estável, citado no achado. Ex.: `FIS-101`. */
  readonly id: string;
  readonly nome: string;
  /** Quando a regra se aplica. Vazio = sempre. */
  readonly condicao?: string;
  /** O que precisa ser verdade quando a condição vale. */
  readonly expressao: string;
  readonly descricao: string;
  readonly severidade: Severidade;
  readonly procedencia: Procedencia;
  /** Campos lidos pela regra — permite à UI pintar a célula certa. */
  readonly camposEnvolvidos: readonly string[];
  /** Código da regra em `regras/` que confere esta expressão, quando existe. */
  readonly implementadaEm?: string;
  /**
   * Tolerância de arredondamento, para regras que comparam valores.
   *
   * Comparar dois somatórios de centavos com `===` é o erro mais caro que este
   * motor pode cometer: uma nota com cem itens acumula diferença de arredondamento
   * legítima, e a auditoria passaria a acusar divergência de totalizador em
   * praticamente todo documento grande de toda escrituração.
   */
  readonly tolerancia?: number;
  /**
   * O que fazer com o erro que esta regra aponta.
   *
   * Ausente significa "ainda não decidido", e a UI deve tratar como manual —
   * nunca como automatizável por omissão.
   */
  readonly correcao?: CorrecaoDeclarada;
  /** Anotação de manutenção: por que a regra é assim, o que falta conferir. */
  readonly observacao?: string;
}

/**
 * Como (e se) o erro apontado por uma regra pode ser corrigido.
 *
 * Existe porque a aba de PIS/COFINS corrige e a de ICMS/IPI só aponta — e a
 * diferença não está na interface, que já sabe mostrar valor sugerido: está em
 * não haver onde a norma DECLARAR qual é o valor certo. Sem este bloco, toda
 * regra nasce "manual, na origem" e o contador recebe um diagnóstico sem
 * remédio.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A DIFERENÇA ENTRE CORRIGIR UMA PLANILHA E CORRIGIR UM SPED
 *
 * A planilha corrigida volta para o ERP e passa por revisão humana. O TXT vai
 * assinado para a Receita Federal. Por isso `automatizavel` é conservador por
 * construção, e a régua é esta: só é automatizável o que a própria escrituração
 * já determina — um número que se recalcula a partir do que está no arquivo.
 *
 * SEGURO de automatizar (o valor certo é dedutível do próprio arquivo):
 *   · contagem de linhas de bloco (X990) e o bloco 9 inteiro — já é feito hoje;
 *   · campo que só pode ter um valor dada a situação declarada, como imposto
 *     zerado em operação isenta;
 *   · formatação que não muda conteúdo: zero à esquerda em código de domínio
 *     fechado, delimitador final ausente.
 *
 * NUNCA automatizar (exige decisão de quem assina):
 *   · CST, CFOP e NCM — mudar isso é reclassificar a operação, e a
 *     classificação correta depende do contrato, da mercadoria e do
 *     destinatário, nada disso no arquivo;
 *   · base de cálculo, alíquota e valor de imposto — alterar é refazer a
 *     apuração e mudar quanto se deve;
 *   · qualquer campo cujo valor "certo" venha de tabela externa que não esteja
 *     carregada e vigente para o período;
 *   · cadastro ausente (0150, 0190, 0200): inventar o cadastro que falta é
 *     inventar o dado, não corrigi-lo.
 *
 * Na dúvida, `automatizavel: false` com `motivo` preenchido. Um apontamento
 * honesto vale mais que uma correção que o contador vai assinar sem conferir.
 */
export interface CorrecaoDeclarada {
  /** A correção pode ser aplicada na regravação sem decisão humana. */
  readonly automatizavel: boolean;
  /**
   * Por que não é automatizável. Obrigatório quando `automatizavel` é falso —
   * é o texto que a UI mostra no lugar do botão de corrigir.
   */
  readonly motivo?: string;
  /** Nome do campo que a correção reescreve. */
  readonly campoCorrigido?: string;
  /**
   * De onde sai o valor correto.
   *
   * `calculado` é o único que dispensa confirmação: o valor vem de somar ou
   * contar o que já está no arquivo. `escolha-do-usuario` é o modelo do
   * critério de correção da aba de PIS/COFINS — o contador escolhe o alvo e a
   * ferramenta aplica.
   */
  readonly origemDoValor?: "calculado" | "tabela-oficial" | "cadastro-do-arquivo" | "escolha-do-usuario";
  /**
   * Exige confirmação explícita antes de entrar no arquivo gerado.
   *
   * Só `false` para o que se recalcula do próprio arquivo. Qualquer coisa que
   * dependa de tabela externa ou de juízo fiscal é `true`.
   */
  readonly exigeConfirmacao: boolean;
}

/** Definição normativa de um campo de registro do SPED. */
export interface CampoSped {
  /**
   * Índice da coluna no array resultante de `linha.split("|")`.
   *
   * ATENÇÃO — esta NÃO é a numeração do Guia Prático. A linha do SPED é
   * `|REG|campo1|campo2|…|`, então o split devolve `""` no índice 0 (antes do
   * primeiro pipe), o código do registro no índice 1, e o primeiro campo de
   * dados no índice 2. O Guia numera o primeiro campo de dados como 02 porque
   * conta o REG como 01: os números coincidem por construção, mas pelo motivo
   * errado — e deixam de coincidir no instante em que alguém "corrige" o
   * dicionário para a base 0. Toda posição aqui é o índice do array, e o teste
   * de coerência com o layout do parser existe para provar isso.
   */
  readonly posicao: number;
  readonly nome: string;
  readonly descricao: string;
  readonly tipo: TipoDado;
  /**
   * Tamanho máximo em caracteres, ou `null` quando o Guia não fixa um.
   *
   * Campos livres como `DESCR_ITEM` não têm teto normativo. Inventar um aqui
   * faria a auditoria reprovar descrição longa perfeitamente válida.
   */
  readonly tamanho: number | null;
  /** Casas decimais para campos `N` de valor, ou `null`. */
  readonly decimais?: number | null;
  readonly obrigatorio: Obrigatoriedade;
  /**
   * Quando o campo passa a ser exigido. Obrigatório de preencher para todo
   * campo `OC` — sem isso, a regra é impossível de conferir sem adivinhação.
   */
  readonly condicao?: string;
  /**
   * Domínio fechado do campo.
   *
   * Vazio ou ausente significa domínio ABERTO, e isso é uma afirmação forte:
   * CFOP, NCM, CEST, COD_MUN e todos os códigos de cadastro próprio da empresa
   * (COD_ITEM, COD_PART) têm milhares de valores e NÃO devem listar nada aqui.
   * Uma lista incompleta apresentada como fechada reprova valor legítimo.
   */
  readonly valoresValidos?: readonly ValorValido[];
  readonly regraRelacional?: RegraRelacional;
  readonly regrasValidacaoCustomizadas?: readonly RegraValidacaoCustomizada[];
  /**
   * Campo numérico de valor em que conteúdo vazio equivale a `0,00`.
   *
   * Existe porque `O` no Guia Prático significa "o delimitador tem de estar
   * presente", e NÃO "o conteúdo tem de ser não-vazio". Um campo de valor
   * obrigatório aceita vir vazio, e o PVA lê isso como zero — o próprio fixture
   * de escrituração válida do repo (`scripts/testes/sped.test.ts`) traz um C190
   * com `VL_IPI` vazio. Sem esta marca, a regra genérica de obrigatoriedade
   * reprova o arquivo de teste do próprio projeto e toda escrituração de
   * contribuinte que não destaca IPI.
   */
  readonly vazioEquivaleAZero?: boolean;
  readonly procedencia: Procedencia;
  /** Anotação livre de manutenção — o que conferir, o que ficou em aberto. */
  readonly observacao?: string;
}

/** Definição normativa de um registro do SPED. */
export interface RegistroSped {
  readonly reg: string;
  readonly descricao: string;
  readonly bloco: string;
  /** Nível hierárquico do leiaute (0 = abertura do arquivo). */
  readonly nivel: number;
  /** Registros que podem ser pai deste. `null` no registro de abertura. */
  readonly pai: readonly string[] | null;
  /** Ocorrência no leiaute. Ex.: `"1:1"`, `"1:N"`, `"vários por documento"`. */
  readonly ocorrencia: string;
  /**
   * Quantidade de campos de DADOS, sem contar o REG.
   *
   * O nome é longo de propósito. O layout do leitor
   * (`features/icms-ipi/layout/registros.ts`) tem uma chave chamada `totalCampos`
   * que conta OUTRA COISA: REG + campos de dados, porque é o número que
   * `conferirQuantidadeDeCampos` compara contra `campos.length - 2`. As duas
   * contagens diferem exatamente em 1, e um dicionário que reusasse o nome
   * `totalCampos` com esta semântica faria toda linha válida do arquivo emitir
   * "quantidade de campos maior que o layout" — um falso positivo por linha,
   * em todo arquivo, sem nada quebrar no build. Nomes diferentes para números
   * diferentes; a conversão fica explícita em `totalCamposNaLinha`.
   */
  readonly totalCamposDeDados: number;
  readonly campos: readonly CampoSped[];
  /** Regras que atravessam campos deste registro ou cruzam com outros. */
  readonly regrasDoRegistro?: readonly RegraValidacaoCustomizada[];
  readonly procedencia: Procedencia;
  readonly observacao?: string;
}

/**
 * Dicionário completo de uma escrituração.
 *
 * `registros` é um `Record` no literal — para o TypeScript inferir as chaves e
 * dar autocomplete no nome do registro — mas todo acesso a partir de dado vindo
 * do arquivo passa por `nucleo/acesso.ts`, que consulta um `Map`. O motivo está
 * documentado lá: uma linha `|constructor|…` num arquivo corrompido devolve
 * algo herdado do protótipo de `Object` e derruba o parse.
 */
export interface DicionarioSped {
  /** Identificador da escrituração. Ex.: `"EFD-ICMS-IPI"`. */
  readonly id: string;
  readonly nome: string;
  /** Versão do leiaute (COD_VER do registro 0000) contra a qual foi conferido. */
  readonly versaoLeiaute: string;
  /** URL da fonte normativa, para quem for atualizar. */
  readonly fonte: string;
  readonly registros: Readonly<Record<string, RegistroSped>>;
  /**
   * O que ainda precisa ser conferido contra a fonte oficial.
   *
   * Esta lista existir e ser exibível é o que separa um dicionário honesto de um
   * que finge certeza. Ela encolhe a cada conferência; enquanto não encolhe, o
   * usuário merece saber.
   */
  readonly pendenciasDeConferencia: readonly string[];
}
