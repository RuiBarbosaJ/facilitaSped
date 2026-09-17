import type { DicionarioSped, Severidade } from "./tipos";

/**
 * Reexportada para que quem importa `Achado` importe a severidade do mesmo
 * lugar. Sem isto, os consumidores precisariam de dois imports para um tipo
 * só — e foi assim que a definição duplicada nasceu da primeira vez.
 */
export type { Severidade } from "./tipos";

/**
 * O contrato entre o motor e quem escreve regra.
 *
 * Este arquivo é a superfície que o próximo desenvolvedor precisa conhecer para
 * implementar uma validação: o que ele recebe (`ContextoValidacao`), o que ele
 * devolve (`Achado`) e como registra a regra (`RegraSped`). Nada além disso.
 */

/**
 * Como o erro apontado pode ser consertado — decidido DEPOIS da auditoria.
 *
 * A regra não sabe: ela calcula o valor certo (ou não calcula) e segue. Quem
 * sabe é o gerador de propostas, que confere o valor contra a linha e consulta
 * a norma declarada. Por isso o campo é preenchido no fim do processamento, e
 * não por cada regra — uma regra que esquecesse deixaria o achado dizendo
 * "manual" sobre um conserto que existe.
 */
export type ConsertoDoAchado =
  /** Sai de contar ou somar o próprio arquivo; entra aprovada. */
  | "automatica"
  /** O valor é dedutível, mas há decisão embutida; nasce desmarcada. */
  | "sugerida"
  /** Não há valor a propor: o conserto é na origem. */
  | "manual";

export interface Achado {
  /** Estável entre execuções: `${codigo}:${nl}:${campo ?? reg}`. */
  readonly id: string;
  /** Código da regra que gerou o achado. Ex.: `FIS-101`. */
  readonly codigo: string;
  readonly severidade: Severidade;
  /** Linha no arquivo original, base 1. Zero para achados agregados. */
  readonly nl: number;
  readonly reg: string;
  /** Nome do campo, para a UI pintar a célula exata. */
  readonly campo?: string;
  /**
   * Descrição do problema.
   *
   * NUNCA deve carregar conteúdo sigiloso do arquivo. Citar um CFOP ou um CST
   * ajuda e é inócuo; reproduzir descrição de produto, nome de participante ou
   * valor de nota transforma a mensagem de erro — que vai para log, para
   * exportação e para a tela — num vazamento de escrituração alheia.
   */
  readonly mensagem: string;
  /**
   * Número do documento a que a linha pertence — o NUM_DOC do C100.
   *
   * É por ele que o contador acha a nota no ERP: o número da LINHA serve para
   * abrir o .txt, e não serve para mais nada. Fica num campo próprio, e nunca
   * dentro da mensagem, pela mesma razão que os valores: a mensagem vai para
   * log e exportação, e um campo separado é o que permite à UI decidir onde
   * mostrá-lo — ou não mostrá-lo.
   *
   * Ausente quando a linha não pertence a documento nenhum (registros de
   * abertura, cadastros, fechamentos de bloco).
   */
  readonly documento?: string;
  /** Valor sugerido, quando a correção é automatizável. */
  readonly esperado?: string;
  readonly atual?: string;
  /**
   * Existe proposta de correção para este achado.
   *
   * A REGRA não preenche isto: ela não sabe. O worker o reescreve no fim, a
   * partir das propostas que de fato foram geradas — é a única forma de o selo
   * na tela e o que entra no arquivo dizerem a mesma coisa.
   */
  readonly corrigivel: boolean;
  /** Que tipo de conserto existe. Ausente equivale a `manual`. */
  readonly conserto?: ConsertoDoAchado;
  /**
   * Por que o conserto é o que é — o texto que a norma escreveu para esta regra.
   *
   * Importa mais no caso `manual`: sem ele, a tela diz "manual, na origem" e
   * quem lê não sabe se a ferramenta não conseguiu, não quis, ou esqueceu. O
   * dicionário já escreve essa frase em `correcao.motivo`; este campo é o que
   * a faz chegar à tela.
   */
  readonly motivoDoConserto?: string;
  /** Referência normativa: Guia Prático, tabela oficial, ato estadual. */
  readonly regra: string;
}

/** Uma linha já quebrada pelos pipes. */
export interface LinhaSped {
  readonly reg: string;
  /** Linha no arquivo original, base 1. */
  readonly nl: number;
  /** Índice 0 = "", índice 1 = REG, índice 2 = primeiro campo de dados. */
  readonly campos: readonly string[];
  /**
   * Linha do registro PAI imediato, quando há.
   *
   * Sem isto, um C197 (benefício fiscal) empilhado junto dos irmãos não diz a
   * qual C170 pertence — e a pergunta que o contador mais faz sobre ICMS,
   * "este item tem o código de benefício que a SEFAZ exige?", fica impossível
   * de responder sem reler o arquivo. Vale para todo filho de segundo nível:
   * C171–C179 pendem do C170, C191 do C190, C197 do C195.
   */
  readonly paiNl?: number;
}

/**
 * Um documento e seus filhos, indexados por registro.
 *
 * Genérico de propósito. A primeira versão era a nota do C100 e só ela —
 * `itens`, `analiticos` e `filhos` —, o que deixava sem lugar o CT-e (D100), a
 * conta de energia (C500), o inventário (H005), a produção (K100) e o CIAP
 * (G125). Regra de inventário ou de crédito de energia não teria onde rodar, e
 * a limitação ficaria congelada na assinatura de toda regra escrita contra o
 * contrato antigo.
 */
export interface Documento {
  /** Registro-raiz: `C100`, `D100`, `C500`, `H005`, `K100`, `G125`, `E100`… */
  readonly reg: string;
  readonly nl: number;
  readonly campos: readonly string[];
  /** Filhos agrupados pelo código do registro. Vazio quando não há. */
  readonly filhos: ReadonlyMap<string, readonly LinhaSped[]>;
}

/**
 * A nota do bloco C, com os atalhos que as regras de mercadoria usam.
 *
 * Continua existindo porque `itens` e `analiticos` são o vocabulário natural de
 * quem escreve regra de C170 e C190 — e porque as regras que já existem os usam.
 */
export interface DocumentoFiscal extends Documento {
  /** Itens do documento (C170). */
  readonly itens: readonly LinhaSped[];
  /** Consolidação por CST/CFOP/alíquota (C190). */
  readonly analiticos: readonly LinhaSped[];
}

/**
 * Tudo o que uma regra pode ler.
 *
 * É deliberadamente uma INTERFACE, e não a estrutura concreta do parser. Duas
 * razões: a regra fica testável com um objeto literal de três linhas em vez de
 * um arquivo SPED de verdade, e o motor de regras deixa de estar amarrado à
 * representação interna do leitor — que pode mudar por performance sem
 * arrastar consigo toda a pasta de regras.
 *
 * Os cadastros são `ReadonlyMap` por acesso O(1): a validação de integridade
 * referencial pergunta "este COD_ITEM existe?" uma vez por item do arquivo, e
 * num arquivo de 100 MB isso é meio milhão de perguntas. Com busca linear em
 * array, a mesma auditoria que roda em segundos passa a não terminar.
 */
export interface ContextoValidacao {
  readonly dicionario: DicionarioSped;

  /** Registro 0000 — abertura e identificação da entidade. */
  readonly cabecalho: LinhaSped | null;

  /** Cadastros indexados pela sua chave natural. */
  readonly participantes: ReadonlyMap<string, LinhaSped>;
  readonly produtos: ReadonlyMap<string, LinhaSped>;
  readonly unidades: ReadonlyMap<string, LinhaSped>;
  readonly naturezas: ReadonlyMap<string, LinhaSped>;

  /**
   * Documentos por registro-raiz: `C100`, `D100`, `C500`, `H005`, `K100`…
   *
   * É o que permite uma regra de inventário ou de CT-e existir sem mudar este
   * contrato de novo. Uma chave ausente significa que o arquivo não tem aquele
   * tipo de documento — e não que a regra deva apontar algo.
   */
  readonly grupos: ReadonlyMap<string, readonly Documento[]>;
  /*
   * DÍVIDA CONHECIDA — o parser ainda não preenche `grupos` nem `paiNl`.
   *
   * O campo existe aqui antes de existir lá de propósito: a alternativa era
   * escrever as regras contra o contrato estreito (só a nota do C100) e
   * reescrever todas elas quando o parser aprendesse os outros blocos. Como
   * `REGRAS_ICMS_IPI` ainda está vazio, esta é a hora mais barata de acertar a
   * assinatura.
   *
   * Consequência prática: hoje `grupos` chega com a única chave `"C100"`, e
   * regra de inventário, produção, CIAP ou CT-e não tem como rodar ainda —
   * não porque o contrato a impeça, mas porque o dado não está montado. Ver o
   * roteiro no README: generalizar `notaAtual` em worker/parser.ts para um
   * documento-raiz corrente por bloco.
   */

  /**
   * Atalho para `grupos.get("C100")`, que é o caso mais comum.
   *
   * Existe para que a regra de mercadoria — a maioria — continue curta, e para
   * que as regras já escritas não precisem mudar.
   */
  readonly documentos: readonly DocumentoFiscal[];

  /**
   * Registros de apuração do bloco E, na ordem do arquivo.
   *
   * Lista plana por enquanto: o vínculo entre um E111 e o E110 a que ele
   * pertence ainda não é montado pelo parser. Regra que dependa desse vínculo
   * está bloqueada até isso existir — ver as pendências do README.
   */
  readonly apuracao: readonly LinhaSped[];

  /** Todas as linhas na ordem original — para regras estruturais. */
  readonly linhas: readonly LinhaSped[];
  readonly contagemPorRegistro: ReadonlyMap<string, number>;

  /** UF do estabelecimento, lida do 0000. Decide qual tabela estadual vale. */
  readonly uf: string;
}

/** Emite um achado. É por aqui que passa o teto por código. */
export type Apontar = (achado: Achado) => void;

/**
 * Pergunta se ainda vale a pena montar um achado deste código.
 *
 * `apontar` aplica o teto tarde: quando ele é chamado, o achado já foi
 * construído — id concatenado, mensagem formatada, número convertido. Numa
 * regra que percorre os ~400 mil itens de um arquivo de 100 MB e dispara em
 * boa parte deles, isso é meio milhão de formatações para o motor descartar
 * 499.500. Regra de laço quente começa o corpo com
 * `if (!podeApontar(CODIGO)) return;` e só então monta o objeto.
 */
export type PodeApontar = (codigo: string) => boolean;

export interface RegraSped {
  /** Código estável, citado no achado e na documentação. Ex.: `FIS-101`. */
  readonly codigo: string;
  readonly nome: string;
  /** Referência à regra do dicionário que esta função confere, quando há. */
  readonly regraDoDicionario?: string;
  executar(contexto: ContextoValidacao, apontar: Apontar, podeApontar: PodeApontar): void;
}
