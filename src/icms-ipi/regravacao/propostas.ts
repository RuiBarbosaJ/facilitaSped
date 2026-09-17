import type { Achado } from "@/regras/nucleo/contrato";
import { correcaoDeclaradaDe } from "@/regras/nucleo/acesso";
import { DICIONARIO_SPED_ICMS_IPI } from "@/regras/icms-ipi/dicionario-sped-icms-ipi";
import { definicaoDoRegistro } from "../leiaute/acesso";
import type { EstruturaSped, LinhaSped } from "../leitura/parser";
import type { Correcao, CorrecaoDeCampo } from "./correcoes";

/**
 * Transforma achados em correções propostas — o que a regravação PODE fazer.
 *
 * Cada gerador aqui responde a uma pergunta só: "o valor certo é dedutível do
 * próprio arquivo, sem juízo fiscal?". Se a resposta é sim sem ressalva, a
 * proposta sai `automatica`. Se há uma decisão embutida — ainda que pequena —
 * sai `sugerida` e espera aprovação. Se a resposta é não, o achado continua
 * achado e não passa por aqui.
 *
 * Os geradores recebem a estrutura inteira, e não só o achado, porque quase
 * toda proposta precisa olhar a LINHA (o valor atual, a quantidade de campos)
 * e às vezes o arquivo em volta (existe o cadastro? onde entra a linha nova?).
 */
/**
 * Um gerador pode devolver VÁRIAS correções para o mesmo achado.
 *
 * Um erro de classificação raramente se conserta num campo só: reclassificar um
 * item de uso e consumo para CST x90 obriga a zerar, na mesma linha, a base e o
 * imposto próprios e os dois campos de substituição — são cinco campos e uma
 * decisão. Enquanto o gerador só podia devolver uma correção, a alternativa era
 * gravar metade do conserto, que deixa a linha em um estado que nem o arquivo
 * original tinha.
 *
 * `null` continua significando "não há o que propor".
 */
export type GeradorDeProposta = (
  achado: Achado,
  linha: LinhaSped | undefined,
  estrutura: EstruturaSped
) => Correcao | Correcao[] | null;

/**
 * EST-023 — linha sem o delimitador final.
 *
 * A linha bem formada termina em "|", e o PVA recusa a que não termina. Como o
 * `split("|")` deixa um "" no fim de toda linha bem formada, a correção é
 * acrescentar esse "" ao array: na serialização ele vira o "|" que faltava.
 * Forma, não conteúdo — por isso automática.
 *
 * A GUARDA que torna isso seguro: só propõe quando a quantidade de campos bate
 * com o leiaute. Uma linha sem o "|" final E com campos a menos pode ser uma
 * linha TRUNCADA — o gerador do ERP parou no meio —, e acrescentar o
 * delimitador esconderia a truncagem em vez de consertá-la. Nesse caso o
 * EST-020 já aponta, e o conserto é na origem.
 */
const delimitadorFinal: GeradorDeProposta = (achado, linha) => {
  if (!linha) return null;
  if (linha.campos[linha.campos.length - 1] === "") return null; // já tem

  const def = definicaoDoRegistro(linha.reg);
  // Sem delimitador final, o split deixa um campo a menos: REG + dados = length - 1.
  const camposNaLinha = linha.campos.length - 1;
  if (def && camposNaLinha !== def.totalCampos) return null;

  return {
    tipo: "campo",
    codigo: achado.codigo,
    classe: "automatica",
    nl: linha.nl,
    reg: linha.reg,
    campo: "(delimitador final)",
    posicao: linha.campos.length,
    de: "",
    para: "",
    motivo:
      "A linha não termina em '|' e o PVA a recusa. Acrescentar o delimitador não altera nenhum campo — a quantidade de campos já confere com o leiaute.",
  };
};

/**
 * Códigos cuja correção é AUTOMÁTICA mesmo sem o dicionário declarar.
 *
 * Só entra aqui o que a regravação já faz sozinha, com ou sem apontamento:
 * `recalcularTotalizadores` reescreve todo QTD_LIN em cada exportação, e a
 * contagem sai da mesma função que a regra usa para apontar. A proposta não
 * muda o arquivo gerado — ela torna visível o que ele já vai ter.
 *
 * A régua para acrescentar alguém aqui é a mesma do dicionário: o valor tem de
 * sair de CONTAR ou SOMAR o próprio arquivo, sem nenhum juízo fiscal.
 */
const CORRECOES_AUTOMATICAS = new Set(["EST-040"]);

/**
 * Transforma em proposta o valor que o próprio achado já calculou.
 *
 * É o gerador que faltava, e a ausência dele era estrutural: até aqui cada
 * código precisava de uma função escrita à mão, e havia duas — as duas de
 * FORMA do arquivo. Todo achado FISCAL ficava sem correção nenhuma, inclusive
 * os de severidade erro. Quem abria uma linha vermelha via o problema e não via
 * o conserto, mesmo quando a regra tinha acabado de calcular o valor certo.
 *
 * Toda regra que preenche `esperado` passa a render proposta, e a classe sai da
 * norma declarada no dicionário:
 *
 *  - `automatizavel: true` e sem confirmação → `automatica`, entra aprovada;
 *  - qualquer outro caso                     → `sugerida`, nasce DESMARCADA.
 *
 * O padrão é `sugerida`, e é o padrão certo: valor de imposto, base e alíquota
 * costumam ter duas correções opostas possíveis — ou o valor está errado, ou o
 * CST é que não era aquele. O `motivo` que o contador lê antes de aprovar é o
 * texto que a própria norma escreveu para essa dúvida.
 */
const doValorEsperado: GeradorDeProposta = (achado, linha) => {
  if (!linha || !achado.campo || achado.esperado === undefined) return null;

  const def = definicaoDoRegistro(linha.reg);
  const campo = def?.campos.find((c) => c.nome === achado.campo);
  if (!campo) return null; // achado sobre campo que o leiaute não tem: não mexe

  /*
   * CAMPO AUSENTE NÃO É CAMPO VAZIO — e confundir os dois corrompe o arquivo.
   *
   * Numa linha TRUNCADA pelo ERP o índice do leiaute simplesmente não existe no
   * array. Lido com `?? ""`, ele se disfarça de campo em branco: a proposta sai
   * com `de: ""`, a guarda da aplicação também lê fora do array como vazio,
   * deixa passar, e a escrita ALONGA o array deixando buracos no meio. O
   * `join("|")` transforma cada buraco num "|" a mais.
   *
   * Medido antes desta guarda, num C100 truncado após VL_DOC com as duas
   * propostas de FIS-C100-012 aprovadas: 14 campos viraram 23, nove campos
   * vazios entraram sem nenhuma aprovação que os autorizasse, e a linha perdeu
   * o delimitador final — o arquivo entregue passava a violar a mesma regra que
   * a ferramenta cobra na leitura. Nada era recusado, e o relatório do download
   * listava tudo como aplicado com sucesso.
   *
   * A linha truncada já tem o apontamento que lhe cabe, o EST-020, e o conserto
   * dela é na origem: o ERP precisa gerar a linha inteira. Preencher um campo
   * solto no meio do vazio não conserta a truncagem — esconde.
   */
  if (campo.indice >= linha.campos.length) return null;

  /*
   * O `de` vai CRU, sem aparar.
   *
   * `aplicarCorrecoes` compara `campos[posicao] !== c.de` sem normalizar nada —
   * é a proteção contra correção velha, e ela tem de ser exata. Um `de` aparado
   * sobre um campo com espaço faria a correção ser recusada no momento de
   * gerar o arquivo, depois de o contador já tê-la aprovado na tela.
   */
  const de = linha.campos[campo.indice] ?? "";
  // O arquivo já está com o valor certo — apontamento velho, nada a propor.
  if (de.trim() === achado.esperado) return null;

  const declarada = correcaoDeclaradaDe(DICIONARIO_SPED_ICMS_IPI, achado.codigo);
  const automatica =
    CORRECOES_AUTOMATICAS.has(achado.codigo) ||
    (declarada?.automatizavel === true && declarada.exigeConfirmacao === false);

  return {
    tipo: "campo",
    codigo: achado.codigo,
    classe: automatica ? "automatica" : "sugerida",
    nl: linha.nl,
    reg: linha.reg,
    campo: campo.nome,
    posicao: campo.indice,
    de,
    para: achado.esperado,
    motivo: declarada?.motivo ?? achado.mensagem,
  };
};

/** Os quatro campos de valor do item que a reclassificação zera. */
const VALORES_DO_ITEM = ["VL_BC_ICMS", "VL_ICMS", "VL_BC_ICMS_ST", "VL_ICMS_ST"] as const;

/**
 * FIS-C170-019 — crédito destacado em entrada que não o admite.
 *
 * É a única regra deste repositório cujo conserto o Guia descreve PASSO A
 * PASSO: reclassificar a tributação para 90 ("outras") preservando a origem, e
 * zerar os quatro campos de valor do item. Por isso ela tem gerador próprio em
 * vez de cair no genérico — o genérico devolve um campo, e meio conserto aqui
 * deixa a linha num estado que nem o arquivo original tinha: CST de operação
 * tributada com imposto zerado.
 *
 * Nasce SUGERIDA e a norma diz por quê, em `correcao.motivo` do dicionário:
 * pode ser o CFOP que está errado, e não o crédito. Quem conhece a compra
 * decide; a ferramenta monta o conserto inteiro e espera o clique.
 */
const reclassificarSemCredito: GeradorDeProposta = (achado, linha) => {
  if (!linha) return null;

  const def = definicaoDoRegistro(linha.reg);
  if (!def) return null;

  const posicaoDe = (nome: string) => def.campos.find((c) => c.nome === nome)?.indice;
  const posicaoCst = posicaoDe("CST_ICMS");
  if (posicaoCst === undefined) return null;

  if (posicaoCst >= linha.campos.length) return null;
  const cstAtual = linha.campos[posicaoCst] ?? "";
  const origem = cstAtual.trim().charAt(0);
  if (!/^\d$/.test(origem)) return null; // CST ilegível: FIS-C170-001 é quem fala

  const declarada = correcaoDeclaradaDe(DICIONARIO_SPED_ICMS_IPI, achado.codigo);
  const base = {
    codigo: achado.codigo,
    classe: "sugerida" as const,
    nl: linha.nl,
    reg: linha.reg,
  };

  const correcoes: Correcao[] = [
    {
      ...base,
      tipo: "campo",
      campo: "CST_ICMS",
      posicao: posicaoCst,
      de: cstAtual,
      para: `${origem}90`,
      motivo:
        `A operação não admite crédito, e a tributação 90 ("outras") é a que o Guia indica para ela. ` +
        `A origem da mercadoria (${origem}) é preservada. ` +
        (declarada?.motivo ?? ""),
    },
  ];

  for (const nome of VALORES_DO_ITEM) {
    const posicao = posicaoDe(nome);
    // Mesma guarda: campo que a linha truncada não tem não se preenche.
    if (posicao === undefined || posicao >= linha.campos.length) continue;
    const atual = linha.campos[posicao] ?? "";
    if (atual.trim() === "" || atual.trim() === "0,00") continue; // já está zerado

    correcoes.push({
      ...base,
      tipo: "campo",
      campo: nome,
      posicao,
      de: atual,
      para: "0,00",
      motivo: `Zerado junto com a reclassificação para CST ${origem}90: a tributação 90 nesta operação não comporta valor neste campo.`,
    });
  }

  return correcoes;
};

/**
 * Registro dos geradores, por código de achado.
 *
 * É um Map, e não um objeto literal, porque a chave vem de dado: o código do
 * achado é montado a partir do arquivo em alguns caminhos, e um `{}` indexado
 * por "constructor" devolveria uma função herdada — a regra do repositório.
 */
const GERADORES: ReadonlyMap<string, GeradorDeProposta> = new Map([
  ["EST-023", delimitadorFinal],
  ["FIS-C170-019", reclassificarSemCredito],
]);

/**
 * O gerador de último recurso, para todo código sem função própria.
 *
 * Inverte o padrão antigo: antes, um código sem entrada no mapa não tinha
 * correção nenhuma, e o silêncio era indistinguível de "não dá para corrigir".
 * Agora, quem calculou o valor certo o oferece; quem não calculou continua
 * sendo apontamento sem conserto — e agora isso é uma AFIRMAÇÃO, não um
 * esquecimento.
 */
const GERADOR_PADRAO = doValorEsperado;

/**
 * Todas as propostas de correção para a estrutura lida.
 *
 * Roda DEPOIS do motor de auditoria: as propostas nascem dos achados. Uma por
 * achado no máximo — e o gerador pode devolver `null` quando a guarda decide
 * que não é seguro propor.
 */
export function proporCorrecoes(estrutura: EstruturaSped): Correcao[] {
  const porNl = new Map<number, LinhaSped>();
  for (const linha of estrutura.linhas) porNl.set(linha.nl, linha);

  const brutas: Correcao[] = [];
  for (const achado of estrutura.achados) {
    const gerador = GERADORES.get(achado.codigo) ?? GERADOR_PADRAO;
    const proposta = gerador(achado, porNl.get(achado.nl), estrutura);
    if (!proposta) continue;
    if (Array.isArray(proposta)) brutas.push(...proposta);
    else brutas.push(proposta);
  }

  return semConflitos(brutas, estrutura);
}

/**
 * Tira da lista as propostas que brigam entre si.
 *
 * São dois conflitos, e os dois nascem de regras diferentes olharem o mesmo
 * fato por ângulos diferentes — o que é bom para apontar e péssimo para
 * corrigir.
 *
 * 1. DUPLICADA. FIS-C170-010 ("falta o imposto") e FIS-C170-013 ("o imposto não
 *    bate com a conta") apontam a MESMA célula e chegam ao mesmo valor. Duas
 *    correções idênticas não somam nada: a primeira entra, e a segunda é
 *    recusada na aplicação porque o campo já não contém o `de` que ela esperava
 *    — o contador via um "recusada" no relatório sem ter feito nada errado.
 *
 * 2. CONTRADITÓRIA, e esta é grave. As regras de soma (FIS-C170-023,
 *    FIS-C100-012) calculam o total a partir dos itens COMO ELES ESTÃO no
 *    arquivo lido. Se o mesmo documento tem proposta num item, aquele total foi
 *    calculado sobre um valor que a própria lista propõe mudar: aprovar as duas
 *    grava o item novo e o total velho, e a nota passa a não fechar em lugar
 *    nenhum. O documento fica PIOR do que chegou.
 *
 *    A saída certa para o efeito dominó é recalcular o C190 e o C100 DEPOIS de
 *    aplicar as correções de item — é o que o Guia recomenda e o que
 *    `recalcularTotalizadores` já faz para o fechamento de bloco. Enquanto esse
 *    passo não existe, a proposta de total é retirada quando há item proposto
 *    no mesmo documento: deixar de oferecer um conserto é recuperável, entregar
 *    um arquivo que não fecha não é.
 */
function semConflitos(propostas: readonly Correcao[], estrutura: EstruturaSped): Correcao[] {
  /** Linhas de item com proposta, por documento. */
  const documentoComItemProposto = new Set<number>();
  const propostasPorLinha = new Set(
    propostas.filter((c): c is CorrecaoDeCampo => c.tipo === "campo").map((c) => c.nl)
  );

  for (const nota of estrutura.notas) {
    if (nota.itens.some((item) => propostasPorLinha.has(item.nl))) {
      documentoComItemProposto.add(nota.nl);
    }
  }

  /** As linhas de total que ficam de fora: o analítico e o cabeçalho da nota. */
  const totaisSuspensos = new Set<number>();
  for (const nota of estrutura.notas) {
    if (!documentoComItemProposto.has(nota.nl)) continue;
    totaisSuspensos.add(nota.nl);
    for (const analitico of nota.analiticos) totaisSuspensos.add(analitico.nl);
  }

  const vistas = new Set<string>();
  const limpas: Correcao[] = [];

  for (const proposta of propostas) {
    if (proposta.tipo !== "campo") {
      limpas.push(proposta);
      continue;
    }
    if (totaisSuspensos.has(proposta.nl)) continue;

    const chave = `${proposta.nl}|${proposta.posicao}`;
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    limpas.push(proposta);
  }

  return limpas;
}

/**
 * O código tem gerador PRÓPRIO — o genérico atende todos os outros.
 *
 * Continua existindo para o teste que trava os geradores de forma; a UI não
 * pergunta mais isso, porque a resposta passou a depender do achado (ter ou não
 * `esperado`), e não só do código.
 */
export function temGeradorDeProposta(codigo: string): boolean {
  return GERADORES.has(codigo);
}

/**
 * Carimba nos achados o conserto que de fato existe para cada um.
 *
 * O `corrigivel` que as regras gravam é sempre `false`: a regra não tem como
 * saber se haverá proposta — isso depende do valor na linha e da norma
 * declarada, que só o gerador consulta. Enquanto a tela lia aquele campo, ela
 * dizia "manual, na origem" ao lado de achados que tinham conserto pronto.
 *
 * Roda depois de `proporCorrecoes`, sobre a lista já limitada pelos tetos.
 */
export function marcarConsertos(estrutura: EstruturaSped, propostas: readonly Correcao[]): void {
  if (estrutura.achados.length === 0) return;


  /*
   * Indexado pela CÉLULA, e não pelo código do achado.
   *
   * Duas regras podem apontar a mesma célula e chegar ao mesmo conserto —
   * "falta o imposto" e "o imposto não bate com a conta" são a mesma correção
   * vista de dois ângulos, e `semConflitos` deixa só uma proposta de pé. Se o
   * carimbo fosse por código, a regra cuja proposta foi retirada passaria a
   * dizer "manual" ao lado de uma célula que tem conserto pendente.
   */
  const classePorCelula = new Map<string, Correcao["classe"]>();
  const classePorAchado = new Map<string, Correcao["classe"]>();
  for (const proposta of propostas) {
    const nl = proposta.tipo === "campo" ? proposta.nl : proposta.apos;
    classePorAchado.set(`${proposta.codigo}|${nl}`, proposta.classe);
    if (proposta.tipo === "campo") classePorCelula.set(`${nl}|${proposta.campo}`, proposta.classe);
  }

  estrutura.achados = estrutura.achados.map((achado) => {
    const classe =
      classePorAchado.get(`${achado.codigo}|${achado.nl}`) ??
      (achado.campo ? classePorCelula.get(`${achado.nl}|${achado.campo}`) : undefined);
    const declarada = correcaoDeclaradaDe(DICIONARIO_SPED_ICMS_IPI, achado.codigo);

    if (!classe) {
      // Sem proposta. O motivo declarado é o que separa "a norma decidiu que
      // isto exige julgamento" de "a ferramenta não chegou lá" — e sem ele a
      // tela diz "manual, na origem" sobre as duas coisas.
      return declarada?.motivo
        ? { ...achado, conserto: "manual" as const, motivoDoConserto: declarada.motivo }
        : { ...achado, conserto: "manual" as const };
    }

    return {
      ...achado,
      corrigivel: true,
      conserto: classe,
      motivoDoConserto: declarada?.motivo,
    };
  });
}
