/**
 * Limites operacionais da leitura de SPED.
 *
 * Estão todos aqui, e não espalhados pelo worker, porque são decisões de
 * produto (quanto o navegador do contador aguenta) e não detalhes de
 * implementação — mexer em qualquer um deles é uma escolha consciente, com o
 * custo à vista dos outros. Correspondem à tabela da seção 13.4 do plano.
 */
export const LIMITES = {
  /*
   * Acima disso o parse não cabe com folga na memória de uma aba.
   *
   * Medido: a estrutura em memória ocupa cerca de 4,3x o tamanho do arquivo
   * (cada linha vira um objeto com o array de campos). 150 MB de arquivo pedem
   * ~640 MB de heap dentro do worker, e o parse leva ~2 s. Dobrar este limite
   * dobra as duas coisas — e a aba passa a morrer em máquina modesta.
   */
  TAMANHO_MAXIMO_BYTES: 150 * 1024 * 1024,
  /*
   * Teto de linhas — guarda contra arquivo degenerado, não o limite de uso normal.
   *
   * Numa escrituração real a linha média tem ~192 bytes (o C170, que domina o
   * volume, passa de 200), então 150 MB equivalem a cerca de 800 mil linhas: é
   * o TAMANHO que limita, não a contagem. Estas 5 milhões só são alcançáveis
   * por um arquivo de linhas artificialmente curtas — exatamente o caso que
   * este teto existe para barrar antes que ele encha a memória.
   */
  LINHAS_MAXIMAS: 5_000_000,
  /**
   * Uma linha de SPED legítima não passa de alguns KB. Sem este teto, um .txt
   * de 150 MB sem nenhuma quebra de linha faz o acumulador do leitor crescer
   * até o arquivo inteiro, e a aba trava antes de qualquer validação.
   */
  CARACTERES_POR_LINHA: 100_000,
  /** Trava de segurança para o parse que não termina (arquivo patológico). */
  TEMPO_MAXIMO_MS: 5 * 60 * 1000,
  /** Quantos bytes do início são lidos para reconhecer o arquivo. */
  BYTES_DE_ASSINATURA: 4096,

  /**
   * Teto de achados por código. Sem ele, um arquivo com bloco K inteiro fora
   * do dicionário gera um objeto por linha: centenas de milhares de achados
   * que são clonados para a main thread e viram nós de DOM.
   */
  ACHADOS_POR_CODIGO: 500,
  /**
   * Teto de opções distintas por coluna do menu de filtro. COD_ITEM de um
   * arquivo grande tem centenas de milhares de valores — listá-los todos
   * duplica o conteúdo fiscal na main thread e mata a aba ao abrir o menu.
   */
  OPCOES_POR_COLUNA: 1_000,
  /** Linhas devolvidas por requisição de janela da grade. */
  LINHAS_POR_JANELA: 200,
  /** Linhas pedidas antes da primeira visível, para a rolagem não piscar. */
  FOLGA_DA_JANELA: 50,
  /** De quantas em quantas linhas o worker informa progresso. */
  INTERVALO_DE_PROGRESSO: 25_000,
} as const;
