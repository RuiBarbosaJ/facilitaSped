import type { DicionarioSped, RegistroSped, ValorValido } from "../nucleo/tipos";

/**
 * Dicionário de dados da EFD ICMS/IPI — o "cérebro fiscal" da aba ICMS/IPI.
 *
 * É a fonte de verdade do motor de validação: o que cada campo é, que valores
 * aceita, quando é exigido e com quem se cruza. As funções que conferem essas
 * regras moram em `regras/`; aqui só se DECLARA a norma. A separação é o que
 * permite ler a regra sem ler o motor — e é o que um contador, um revisor ou um
 * fiscal conseguem auditar.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * COMO LER O CAMPO `posicao`
 *
 * É o índice no array de `linha.split("|")`, não a numeração do Guia Prático.
 * A linha é `|REG|campo1|campo2|…|`, então o índice 0 é `""`, o 1 é o código do
 * registro e o 2 é o primeiro campo de dados. Os números coincidem com os do
 * Guia (que chama o REG de campo 01), mas por construção — e deixam de
 * coincidir no instante em que alguém "corrige" o dicionário para base 0.
 *
 * Os índices aqui foram conferidos um a um contra `src/icms-ipi/leiaute/`, que
 * é o dicionário que o parser usa, e contra a escrituração de referência de
 * `scripts/testes/icms-ipi.test.ts`. O teste em `scripts/testes/dicionario.test.ts`
 * trava o build se as duas fontes divergirem.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O QUE ESTE DICIONÁRIO NÃO AFIRMA
 *
 * `procedencia: "inferido"` marca o que foi deduzido do leiaute sem conferência
 * documental. Não é enfeite: achado gerado a partir de campo inferido deve
 * chegar ao usuário com ressalva, e nunca com severidade `erro`. A lista em
 * `pendenciasDeConferencia`, no fim do arquivo, é o roteiro de quem tiver o
 * Guia Prático em mãos — ela encolhe a cada conferência.
 *
 * Três armadilhas governam quase toda regra escrita a partir daqui:
 *
 * 1. `O` em campo numérico de valor significa "o delimitador tem de existir",
 *    não "o conteúdo tem de ser não-vazio". Campo de valor vazio vale `0,00` e
 *    o PVA aceita. Por isso existe `vazioEquivaleAZero`.
 * 2. `CST_ICMS` é `N(3)` = origem + tributação. Toda regra que fala de "CST 40"
 *    fala dos DOIS ÚLTIMOS dígitos. Comparar o campo inteiro contra `"40"`
 *    nunca casa: a regra não dispara, não quebra e não aparece em teste algum.
 * 3. `COD_SIT` 02, 03, 04 e 05 (cancelado, denegado, inutilizado) mudam tudo:
 *    o documento em geral não traz filhos nem valores. Regra de totalizador ou
 *    de presença de filho que não os exclua acusa erro em massa no varejo.
 *
 * Manutenção: ver `src/icms-ipi/leiaute/versao.ts`. O Ato COTEPE publica
 * leiaute novo quase todo ano.
 */

/* ───────────────────────────── domínios reutilizados ────────────────────── */

/**
 * As 27 unidades da federação.
 *
 * `EX` (exterior) existe em outros contextos do SPED, mas não aqui: o
 * declarante do 0000 é sempre estabelecimento no país.
 */
export const UNIDADES_DA_FEDERACAO: readonly ValorValido[] = [
  { valor: "AC", descricao: "Acre" },
  { valor: "AL", descricao: "Alagoas" },
  { valor: "AP", descricao: "Amapá" },
  { valor: "AM", descricao: "Amazonas" },
  { valor: "BA", descricao: "Bahia" },
  { valor: "CE", descricao: "Ceará" },
  { valor: "DF", descricao: "Distrito Federal" },
  { valor: "ES", descricao: "Espírito Santo" },
  { valor: "GO", descricao: "Goiás" },
  { valor: "MA", descricao: "Maranhão" },
  { valor: "MT", descricao: "Mato Grosso" },
  { valor: "MS", descricao: "Mato Grosso do Sul" },
  { valor: "MG", descricao: "Minas Gerais" },
  { valor: "PA", descricao: "Pará" },
  { valor: "PB", descricao: "Paraíba" },
  { valor: "PR", descricao: "Paraná" },
  { valor: "PE", descricao: "Pernambuco" },
  { valor: "PI", descricao: "Piauí" },
  { valor: "RJ", descricao: "Rio de Janeiro" },
  { valor: "RN", descricao: "Rio Grande do Norte" },
  { valor: "RS", descricao: "Rio Grande do Sul" },
  { valor: "RO", descricao: "Rondônia" },
  { valor: "RR", descricao: "Roraima" },
  { valor: "SC", descricao: "Santa Catarina" },
  { valor: "SP", descricao: "São Paulo" },
  { valor: "SE", descricao: "Sergipe" },
  { valor: "TO", descricao: "Tocantins" },
];

/**
 * Situação do documento fiscal (COD_SIT do C100).
 *
 * É o domínio mais consequente do bloco C: ele decide quais documentos entram
 * no confronto de totalizadores e quais são escriturados sem filhos.
 */
export const SITUACAO_DO_DOCUMENTO: readonly ValorValido[] = [
  { valor: "00", descricao: "Documento regular" },
  { valor: "01", descricao: "Escrituração extemporânea de documento regular" },
  { valor: "02", descricao: "Documento cancelado" },
  { valor: "03", descricao: "Escrituração extemporânea de documento cancelado" },
  { valor: "04", descricao: "NF-e ou CT-e denegado" },
  { valor: "05", descricao: "NF-e ou CT-e com numeração inutilizada" },
  { valor: "06", descricao: "Documento fiscal complementar" },
  { valor: "07", descricao: "Escrituração extemporânea de documento complementar" },
  { valor: "08", descricao: "Documento fiscal emitido com base em regime especial ou norma específica" },
];

/** COD_SIT em que o documento carrega valores e filhos — o resto fica fora. */
export const SITUACOES_COM_VALORES: readonly string[] = ["00", "01", "06", "07", "08"];

/** COD_SIT de documento sem movimento: cancelado, denegado, inutilizado. */
export const SITUACOES_SEM_MOVIMENTO: readonly string[] = ["02", "03", "04", "05"];

/**
 * Tributação do ICMS — os DOIS ÚLTIMOS dígitos do CST (Tabela B).
 *
 * Copiado de `src/icms-ipi/leiaute/dominios.ts`, que já o mantém para descrever
 * o valor na grade. Aqui ele serve a outro fim: decidir quais campos de valor
 * são exigidos e quais têm de ser zero.
 */
export const TRIBUTACAO_DO_ICMS: readonly ValorValido[] = [
  { valor: "00", descricao: "Tributada integralmente" },
  { valor: "10", descricao: "Tributada e com cobrança do ICMS por substituição tributária" },
  { valor: "20", descricao: "Com redução da base de cálculo" },
  { valor: "30", descricao: "Isenta ou não tributada e com cobrança do ICMS por substituição tributária" },
  { valor: "40", descricao: "Isenta" },
  { valor: "41", descricao: "Não tributada" },
  { valor: "50", descricao: "Suspensão" },
  { valor: "51", descricao: "Diferimento" },
  { valor: "60", descricao: "ICMS cobrado anteriormente por substituição tributária" },
  { valor: "70", descricao: "Com redução da base de cálculo e cobrança do ICMS por substituição tributária" },
  { valor: "90", descricao: "Outras" },
];

/** Tributações que exigem ICMS próprio destacado. */
export const TRIBUTACOES_COM_ICMS_PROPRIO: readonly string[] = ["00", "10", "20", "70", "90"];

/** Tributações sem ICMS próprio: o imposto tem de ser zero. */
export const TRIBUTACOES_SEM_ICMS_PROPRIO: readonly string[] = ["30", "40", "41", "50", "51", "60"];

/** Tributações com substituição tributária. */
export const TRIBUTACOES_COM_ST: readonly string[] = ["10", "30", "60", "70"];

/** Tributações com redução da base de cálculo. */
export const TRIBUTACOES_COM_REDUCAO: readonly string[] = ["20", "70"];

/* ──────────────────────────────── registro 0000 ─────────────────────────── */

const REGISTRO_0000: RegistroSped = {
  reg: "0000",
  descricao:
    "Abertura do arquivo digital e identificação da entidade. É obrigatoriamente a primeira linha do arquivo e declara a versão do leiaute, a finalidade da remessa, o período escriturado e o estabelecimento.",
  bloco: "0",
  nivel: 0,
  pai: null,
  ocorrencia: "1:1",
  totalCamposDeDados: 14,
  procedencia: "guia-pratico",
  campos: [
    {
      posicao: 2,
      nome: "COD_VER",
      descricao: "Versão do leiaute conforme a tabela publicada pelo Ato COTEPE.",
      tipo: "N",
      tamanho: 3,
      obrigatorio: "O",
      procedencia: "guia-pratico",
      observacao:
        "Domínio fechado mas crescente — sai versão nova quase todo ano —, e o PVA valida o COD_VER contra a DT_FIN da escrituração. Por isso a lista de versões NÃO é afirmada aqui: um dicionário defasado passaria a reprovar arquivo de versão nova, que é exatamente o contrário do que deve fazer. A versão conferida vive em src/icms-ipi/leiaute/versao.ts.",
    },
    {
      posicao: 3,
      nome: "COD_FIN",
      descricao: "Finalidade do arquivo: remessa original ou substituta.",
      tipo: "N",
      tamanho: 1,
      obrigatorio: "O",
      valoresValidos: [
        { valor: "0", descricao: "Remessa do arquivo original" },
        { valor: "1", descricao: "Remessa do arquivo substituto" },
      ],
      procedencia: "guia-pratico",
    },
    {
      posicao: 4,
      nome: "DT_INI",
      descricao: "Data inicial das informações contidas no arquivo, no formato ddmmaaaa.",
      tipo: "N",
      tamanho: 8,
      obrigatorio: "O",
      procedencia: "guia-pratico",
      observacao:
        "Campo posicional de 8 dígitos: zeros à esquerda são significativos (01012025) e o valor NUNCA pode passar por normalização numérica. Sobre o conteúdo, a regra usual é o primeiro dia do período — mas início de atividade, baixa, incorporação, cisão e fusão produzem escrituração que começa no meio do mês, e há UF que autoriza período fracionado. Nenhuma regra bloqueante de 'tem de ser dia 1' deve ser escrita antes de conferir as exceções no Guia.",
    },
    {
      posicao: 5,
      nome: "DT_FIN",
      descricao: "Data final das informações contidas no arquivo, no formato ddmmaaaa.",
      tipo: "N",
      tamanho: 8,
      obrigatorio: "O",
      procedencia: "guia-pratico",
      observacao:
        "É a data contra a qual o PVA valida o COD_VER. Mesma ressalva do DT_INI: escrituração de baixa ou de evento societário termina antes do último dia do mês, então 'tem de ser o último dia' não é regra bloqueante.",
    },
    {
      posicao: 6,
      nome: "NOME",
      descricao: "Nome empresarial da entidade.",
      tipo: "C",
      tamanho: 100,
      obrigatorio: "O",
      procedencia: "inferido",
      observacao: "Campo livre. O tamanho 100 vem do leiaute e não é conferível dentro do repositório.",
    },
    {
      posicao: 7,
      nome: "CNPJ",
      descricao: "CNPJ do estabelecimento declarante, somente dígitos.",
      tipo: "N",
      tamanho: 14,
      obrigatorio: "OC",
      condicao: "Declarante pessoa jurídica. Vazio quando CPF estiver preenchido — ver a regra XOR-0000-CNPJ-CPF.",
      procedencia: "guia-pratico",
      observacao:
        "Sem máscara, com zeros à esquerda preservados: é string, nunca número. Validável por dígito verificador.",
    },
    {
      posicao: 8,
      nome: "CPF",
      descricao: "CPF do declarante pessoa física, somente dígitos.",
      tipo: "N",
      tamanho: 11,
      obrigatorio: "OC",
      condicao: "Declarante pessoa física — produtor rural, por exemplo. Vazio quando CNPJ estiver preenchido.",
      procedencia: "guia-pratico",
    },
    {
      posicao: 9,
      nome: "UF",
      descricao: "Sigla da unidade da federação do estabelecimento.",
      tipo: "C",
      tamanho: 2,
      obrigatorio: "O",
      valoresValidos: UNIDADES_DA_FEDERACAO,
      procedencia: "guia-pratico",
      observacao:
        "É o campo que decide QUAL tabela estadual vale para o arquivo inteiro — os ajustes da 5.1.1 e os benefícios da 5.3 são estaduais. O worker já o lê para o resumo.",
    },
    {
      posicao: 10,
      nome: "IE",
      descricao: "Inscrição estadual do estabelecimento, sem máscara.",
      tipo: "C",
      tamanho: 14,
      obrigatorio: "O",
      procedencia: "inferido",
      observacao:
        "Formato e dígito verificador variam por UF: não existe algoritmo nacional único, então a conferência genérica se limita a comprimento. Tipo C, e não N, porque há UF cuja inscrição admite letra.",
    },
    {
      posicao: 11,
      nome: "COD_MUN",
      descricao: "Código do município do domicílio fiscal, conforme a tabela do IBGE.",
      tipo: "N",
      tamanho: 7,
      obrigatorio: "O",
      procedencia: "tabela-oficial",
      observacao:
        "Tabela oficial FECHADA (~5.570 códigos), grande demais para ficar inline: a conferência do código em si depende de tabela carregada em tabelas/. O que dá para conferir sem tabela nenhuma é a coerência barata — os dois primeiros dígitos são o código da UF no IBGE (21 = MA, 35 = SP).",
    },
    {
      posicao: 12,
      nome: "IM",
      descricao: "Inscrição municipal do estabelecimento.",
      tipo: "C",
      tamanho: 60,
      obrigatorio: "OC",
      condicao: "Entidade inscrita no cadastro municipal — tipicamente contribuinte do ISS.",
      procedencia: "inferido",
      observacao: "O tamanho 60 é a medida de menor certeza do registro.",
    },
    {
      posicao: 13,
      nome: "SUFRAMA",
      descricao: "Inscrição do estabelecimento na SUFRAMA.",
      tipo: "C",
      tamanho: 9,
      obrigatorio: "OC",
      condicao:
        "Estabelecimento habilitado na SUFRAMA — Zona Franca de Manaus, Amazônia Ocidental e Áreas de Livre Comércio.",
      procedencia: "inferido",
      observacao: "Vazio na esmagadora maioria dos declarantes: vazio aqui nunca é achado.",
    },
    {
      posicao: 14,
      nome: "IND_PERFIL",
      descricao: "Perfil de apresentação do arquivo fiscal, atribuído ao contribuinte pela UF.",
      tipo: "C",
      tamanho: 1,
      obrigatorio: "O",
      valoresValidos: [
        { valor: "A", descricao: "Perfil A" },
        { valor: "B", descricao: "Perfil B" },
        { valor: "C", descricao: "Perfil C" },
      ],
      procedencia: "guia-pratico",
      observacao:
        "Governa o grau de detalhamento exigido: o perfil A é o mais analítico e o B agrega. É o que explica documento legítimo com C190 e sem nenhum C170 — por isso toda regra que exija item detalhado precisa consultar este campo antes de apontar.",
    },
    {
      posicao: 15,
      nome: "IND_ATIV",
      descricao: "Indicador do tipo de atividade do declarante.",
      tipo: "N",
      tamanho: 1,
      obrigatorio: "O",
      valoresValidos: [
        { valor: "0", descricao: "Industrial ou equiparado a industrial" },
        { valor: "1", descricao: "Outros" },
      ],
      procedencia: "guia-pratico",
      observacao:
        "Caracteriza o declarante como contribuinte do IPI e portanto condiciona a exigência dos campos de IPI do C170 (CST_IPI, COD_ENQ, VL_BC_IPI…).",
    },
  ],
  regrasDoRegistro: [
    {
      id: "FIS-0000-001",
      nome: "CNPJ e CPF mutuamente exclusivos",
      expressao: '(CNPJ !== "") !== (CPF !== "")',
      descricao:
        "Exatamente um entre CNPJ e CPF tem de estar preenchido. Ambos vazios é escrituração sem declarante identificado; ambos preenchidos é contradição sobre quem escritura.",
      severidade: "erro",
      procedencia: "guia-pratico",
      camposEnvolvidos: ["CNPJ", "CPF"],
      observacao:
        "Precisa ser regra de REGISTRO, e não obrigatoriedade de campo. Declarados só como OC, os dois campos permitem ao motor concluir que ambos são dispensáveis — e um 0000 sem CNPJ e sem CPF passaria limpo.",
    },
    {
      id: "FIS-0000-002",
      nome: "Coerência entre UF e código do município",
      condicao: 'COD_MUN !== "" && UF !== ""',
      expressao: "COD_MUN.slice(0, 2) === codigoIbgeDaUf(UF)",
      descricao:
        "Os dois primeiros dígitos do código IBGE do município são o código da UF. Conferência barata, que não depende de carregar a tabela de municípios.",
      severidade: "erro",
      procedencia: "tabela-oficial",
      camposEnvolvidos: ["UF", "COD_MUN"],
      correcao: {
        automatizavel: false,
        motivo:
          "O código IBGE e a UF vêm do cadastro do estabelecimento. Corrigir um pelo outro seria escolher arbitrariamente qual dos dois está certo.",
        campoCorrigido: "COD_MUN",
        origemDoValor: "tabela-oficial",
        exigeConfirmacao: true,
      },
    },
    {
      id: "FIS-0000-003",
      nome: "Período de escrituração coerente",
      expressao: "dataDe(DT_INI) <= dataDe(DT_FIN)",
      descricao: "A data inicial não pode ser posterior à final.",
      severidade: "critico",
      procedencia: "guia-pratico",
      camposEnvolvidos: ["DT_INI", "DT_FIN"],
      observacao:
        "Só a ordenação é afirmada. Exigir que o período cubra o mês inteiro reprovaria escrituração de abertura, de baixa e de evento societário — ver a observação de DT_INI.",
    },
  ],
};

/* ──────────────────────────────── registro 0150 ─────────────────────────── */

const REGISTRO_0150: RegistroSped = {
  reg: "0150",
  descricao:
    "Tabela de cadastro do participante. Identifica, uma única vez por arquivo, cada pessoa física ou jurídica referenciada nos demais blocos: cliente, fornecedor, transportador, remetente.",
  bloco: "0",
  nivel: 2,
  pai: ["0001"],
  ocorrencia: "vários por arquivo (1:N)",
  totalCamposDeDados: 12,
  procedencia: "guia-pratico",
  campos: [
    {
      posicao: 2,
      nome: "COD_PART",
      descricao: "Código de identificação do participante no cadastro da empresa.",
      tipo: "C",
      tamanho: 60,
      obrigatorio: "O",
      procedencia: "guia-pratico",
      observacao:
        "Domínio ABERTO — é código próprio do contribuinte, nunca listar valores. É a chave que o C100.COD_PART referencia, e o parser já indexa os participantes por ela.",
    },
    {
      posicao: 3,
      nome: "NOME",
      descricao: "Nome pessoal ou empresarial do participante.",
      tipo: "C",
      tamanho: 100,
      obrigatorio: "O",
      procedencia: "inferido",
      observacao: "Campo livre; o tamanho 100 vem do leiaute e não é conferível no repositório.",
    },
    {
      posicao: 4,
      nome: "COD_PAIS",
      descricao: "Código do país do participante, conforme a tabela do BACEN.",
      tipo: "N",
      tamanho: 5,
      obrigatorio: "O",
      procedencia: "tabela-oficial",
      observacao:
        "ATENÇÃO — o Brasil aparece como 1058 ou 01058 conforme o gerador, e este campo governa a obrigatoriedade condicional de CNPJ, CPF, IE e COD_MUN. Comparar com literal fixo é o caminho curto para ler TODO participante brasileiro como estrangeiro de uma vez: os quatro campos deixam de ser cobrados e, pelo outro lado da condição, passam a ser acusados de preenchimento indevido. Compare sempre normalizando zeros à esquerda.",
    },
    {
      posicao: 5,
      nome: "CNPJ",
      descricao: "CNPJ do participante, somente dígitos.",
      tipo: "N",
      tamanho: 14,
      obrigatorio: "OC",
      condicao: "Participante pessoa jurídica domiciliado no Brasil. Vazio quando CPF estiver preenchido.",
      procedencia: "guia-pratico",
      observacao:
        "Vazio para participante estrangeiro. Note que 'não exigido' não é o mesmo que 'vedado': o dicionário não afirma vedação em lugar nenhum, porque o Guia não a afirma e uma vedação inventada gera achado em linha legítima.",
    },
    {
      posicao: 6,
      nome: "CPF",
      descricao: "CPF do participante, somente dígitos.",
      tipo: "N",
      tamanho: 11,
      obrigatorio: "OC",
      condicao: "Participante pessoa física domiciliado no Brasil. Vazio quando CNPJ estiver preenchido.",
      procedencia: "guia-pratico",
    },
    {
      posicao: 7,
      nome: "IE",
      descricao: "Inscrição estadual do participante, sem máscara.",
      tipo: "C",
      tamanho: 14,
      obrigatorio: "OC",
      condicao: "Participante contribuinte do ICMS.",
      procedencia: "inferido",
      observacao:
        "Vazio para não contribuinte e para estrangeiro. Há escrituração que grava o literal ISENTO neste campo — conferir no Guia se é aceito antes de escrever qualquer regra de formato. Tipo C porque o formato varia por UF.",
    },
    {
      posicao: 8,
      nome: "COD_MUN",
      descricao: "Código do município do participante, conforme a tabela do IBGE.",
      tipo: "N",
      tamanho: 7,
      obrigatorio: "OC",
      condicao: "Participante domiciliado no Brasil.",
      procedencia: "tabela-oficial",
      observacao:
        "Tabela oficial FECHADA do IBGE (~5.570 códigos) — grande demais para inline, mas não é domínio aberto. Os dois primeiros dígitos são o código da UF, o que permite a mesma conferência cruzada barata do 0000.",
    },
    {
      posicao: 9,
      nome: "SUFRAMA",
      descricao: "Inscrição do participante na SUFRAMA.",
      tipo: "C",
      tamanho: 9,
      obrigatorio: "OC",
      condicao: "Participante beneficiário de incentivo da SUFRAMA.",
      procedencia: "inferido",
    },
    {
      posicao: 10,
      nome: "END",
      descricao: "Logradouro e endereço do imóvel.",
      tipo: "C",
      tamanho: 60,
      obrigatorio: "O",
      procedencia: "inferido",
      observacao:
        "Marcado obrigatório no layout do leitor, cuja procedência não é documentada. Se o leiaute 017 o trouxer como OC, cobrar 'O' reprova toda 0150 de participante estrangeiro ou de cadastro eventual sem logradouro. Até a conferência, ausência aqui é ALERTA, nunca erro.",
    },
    {
      posicao: 11,
      nome: "NUM",
      descricao: "Número do imóvel.",
      tipo: "C",
      tamanho: 10,
      obrigatorio: "OC",
      condicao: "Endereço com número. Vazio em endereço sem numeração, como imóvel rural.",
      procedencia: "inferido",
      observacao: 'Tipo C porque admite "S/N" e "12-A".',
    },
    {
      posicao: 12,
      nome: "COMPL",
      descricao: "Dados complementares do endereço.",
      tipo: "C",
      tamanho: 60,
      obrigatorio: "OC",
      condicao: "Endereço com complemento.",
      procedencia: "inferido",
    },
    {
      posicao: 13,
      nome: "BAIRRO",
      descricao: "Bairro em que o imóvel está situado.",
      tipo: "C",
      tamanho: 60,
      obrigatorio: "OC",
      condicao: "Endereço com bairro ou distrito.",
      procedencia: "inferido",
    },
  ],
  regrasDoRegistro: [
    {
      id: "CAD-0150-001",
      nome: "Código de participante duplicado",
      expressao: "count(0150 com o mesmo COD_PART) === 1",
      descricao:
        "Dois registros 0150 com o mesmo COD_PART tornam ambíguo a quem o documento se refere — e o cadastro que o parser monta guarda apenas o último lido, silenciosamente.",
      severidade: "erro",
      procedencia: "guia-pratico",
      camposEnvolvidos: ["COD_PART"],
    },
    {
      id: "CAD-0150-002",
      nome: "Participante brasileiro sem CNPJ nem CPF",
      condicao: "participante domiciliado no Brasil (COD_PAIS normalizado)",
      expressao: '(CNPJ !== "") !== (CPF !== "")',
      descricao:
        "Participante nacional precisa de exatamente um dos dois identificadores. A regra NÃO se aplica a participante estrangeiro, que legitimamente não tem nenhum dos dois.",
      severidade: "erro",
      procedencia: "guia-pratico",
      camposEnvolvidos: ["COD_PAIS", "CNPJ", "CPF"],
      observacao:
        "A condição depende da normalização do COD_PAIS (1058 vs 01058). Errar a normalização inverte a regra para o arquivo inteiro — ver a observação do campo.",
    },
  ],
};

/* ──────────────────────────────── registro 0200 ─────────────────────────── */

const REGISTRO_0200: RegistroSped = {
  reg: "0200",
  descricao:
    "Tabela de identificação do item (produtos e serviços). Cadastra, uma única vez por arquivo, todo item referenciado nos demais blocos: mercadorias, insumos, serviços e imobilizado.",
  bloco: "0",
  nivel: 2,
  pai: ["0001"],
  ocorrencia: "vários por arquivo (1:N)",
  totalCamposDeDados: 12,
  procedencia: "guia-pratico",
  campos: [
    {
      posicao: 2,
      nome: "COD_ITEM",
      descricao: "Código do item no cadastro da empresa.",
      tipo: "C",
      tamanho: 60,
      obrigatorio: "O",
      procedencia: "guia-pratico",
      observacao:
        "Domínio ABERTO — código próprio do contribuinte. É a chave referenciada por C170.COD_ITEM, e o parser indexa os produtos por ela. O tamanho 60 vem do leiaute e não é conferível no repositório: enquanto não for conferido, estouro de tamanho aqui é ALERTA, nunca erro.",
    },
    {
      posicao: 3,
      nome: "DESCR_ITEM",
      descricao: "Descrição do item.",
      tipo: "C",
      tamanho: null,
      obrigatorio: "O",
      procedencia: "guia-pratico",
      observacao:
        "Sem teto normativo de tamanho. Inventar um faria a auditoria reprovar descrição longa perfeitamente válida.",
    },
    {
      posicao: 4,
      nome: "COD_BARRA",
      descricao: "Código de barras do produto (GTIN), quando houver.",
      tipo: "C",
      tamanho: null,
      obrigatorio: "OC",
      condicao: "Item que possui código de barras GTIN.",
      procedencia: "inferido",
      observacao: "Aceita GTIN-8 a GTIN-14, portanto sem tamanho fixo. Validável por dígito verificador.",
    },
    {
      posicao: 5,
      nome: "COD_ANT_ITEM",
      descricao: "Código anterior do item, quando houve alteração.",
      tipo: "C",
      tamanho: 60,
      obrigatorio: "OC",
      condicao: "NÃO CONFIRMADO — o código do item mudou em relação à escrituração anterior.",
      procedencia: "inferido",
      observacao:
        "Há orientação do Guia direcionando a alteração de código para o registro 0205, com vigências próprias. Não foi confirmado se a versão 017 mantém este campo utilizável. Nenhuma regra antes de conferir.",
    },
    {
      posicao: 6,
      nome: "UNID_INV",
      descricao: "Unidade de medida utilizada na quantificação de estoques.",
      tipo: "C",
      tamanho: 6,
      obrigatorio: "O",
      procedencia: "guia-pratico",
      regraRelacional: {
        id: "REL-0200-0190-UNID_INV",
        registroAlvo: "0190",
        campoAlvo: "UNID",
        descricao: "A unidade precisa estar cadastrada na tabela de unidades de medida (0190).",
        severidade: "erro",
      },
    },
    {
      posicao: 7,
      nome: "TIPO_ITEM",
      descricao: "Tipo do item conforme a atividade a que se destina.",
      tipo: "N",
      tamanho: 2,
      obrigatorio: "O",
      valoresValidos: [
        { valor: "00", descricao: "Mercadoria para revenda" },
        { valor: "01", descricao: "Matéria-prima" },
        { valor: "02", descricao: "Embalagem" },
        { valor: "03", descricao: "Produto em processo" },
        { valor: "04", descricao: "Produto acabado" },
        { valor: "05", descricao: "Subproduto" },
        { valor: "06", descricao: "Produto intermediário" },
        { valor: "07", descricao: "Material de uso e consumo" },
        { valor: "08", descricao: "Ativo imobilizado" },
        { valor: "09", descricao: "Serviços" },
        { valor: "10", descricao: "Outros insumos" },
        { valor: "99", descricao: "Outras" },
      ],
      procedencia: "guia-pratico",
      observacao:
        "Domínio FECHADO, conferido contra src/icms-ipi/leiaute/dominios.ts. COMO COMPARAR: o campo é N de 2 posições com zero à esquerda significativo, mas há gerador que o trata como número e grava |0|. Normalize com padStart(2, '0') antes do teste de domínio — e, se o valor só casar DEPOIS do padStart, aponte alerta de formatação, não erro de domínio. Campo vazio não deve ser avaliado aqui: isso é assunto da regra de obrigatoriedade, e avaliar nos dois lugares gera dois achados para uma única falha.",
    },
    {
      posicao: 8,
      nome: "COD_NCM",
      descricao: "Codificação NCM da Nomenclatura Comum do Mercosul.",
      tipo: "C",
      tamanho: 8,
      obrigatorio: "OC",
      condicao:
        "Industrial ou equiparado, quanto aos itens da atividade-fim e aos que geram débito ou crédito de IPI; demais contribuintes, quanto aos itens sujeitos a substituição tributária; e operações de comércio exterior.",
      procedencia: "inferido",
      observacao:
        "Domínio é tabela oficial externa e extensa: a conferência do código depende da tabela NCM, que a plataforma já baixa para public/data/ncm.json. Condicionalidade não conferida no Guia — até lá, ausência é alerta.",
    },
    {
      posicao: 9,
      nome: "EX_IPI",
      descricao: "Código da exceção da NCM na TIPI, quando houver.",
      tipo: "C",
      tamanho: 3,
      obrigatorio: "OC",
      condicao: "NCM do item possui código EX na TIPI.",
      procedencia: "inferido",
      observacao: "EX_IPI preenchido com COD_NCM vazio é incoerência — alerta, não erro de leiaute.",
    },
    {
      posicao: 10,
      nome: "COD_GEN",
      descricao: "Código do gênero do item, conforme a tabela de gêneros da NCM.",
      tipo: "N",
      tamanho: 2,
      obrigatorio: "OC",
      condicao: "NÃO CONFIRMADO — conferir a condicionalidade no Guia antes de escrever qualquer regra.",
      procedencia: "inferido",
      observacao:
        "A correlação usual é 'dois primeiros dígitos do NCM = capítulo = COD_GEN', mas isso não foi confirmado para a versão 017 e há memória conflitante entre versões do leiaute.",
    },
    {
      posicao: 11,
      nome: "COD_LST",
      descricao: "Código do serviço conforme a lista da Lei Complementar 116/2003.",
      tipo: "C",
      tamanho: null,
      obrigatorio: "OC",
      condicao: "Item que é serviço sujeito ao ISS (TIPO_ITEM = 09).",
      procedencia: "inferido",
      observacao:
        "CONFLITO ABERTO de tipo e formato: há leitura de que o campo é N(4) sem ponto ('1401') e leitura de que é C(5) com ponto ('14.01'). As duas não podem estar certas, e errar significa reprovar exatamente o arquivo que o PVA aceita. Por isso tamanho fica null e NENHUMA regra de tipo, tamanho ou formato deve ser escrita aqui antes de conferir o campo 11 do 0200 no Guia da versão vigente. Só a coerência com TIPO_ITEM = 09 é segura, e como alerta.",
    },
    {
      posicao: 12,
      nome: "ALIQ_ICMS",
      descricao: "Alíquota de ICMS aplicável ao item nas operações internas.",
      tipo: "N",
      tamanho: 6,
      decimais: 2,
      obrigatorio: "OC",
      condicao: "NÃO CONFIRMADO — quando a legislação da UF determinar. É campo de apoio ao cálculo de ST.",
      procedencia: "inferido",
      observacao:
        "ATENÇÃO ao ler este campo: numeroDe() converte vazio em 0, que é a leitura certa num campo de valor e ERRADA aqui — vazio significa 'o cadastro não informou a alíquota', não 'a alíquota é 0%'. Use numeroOuNulo() de nucleo/acesso.ts, ou teste valorDe(...) === '' antes de converter. Quem usar numeroDe direto conclui alíquota zero e acusa de isento um item tributado.",
    },
    {
      posicao: 13,
      nome: "CEST",
      descricao: "Código Especificador da Substituição Tributária.",
      tipo: "N",
      tamanho: 7,
      obrigatorio: "OC",
      condicao:
        "Mercadoria sujeita a substituição tributária ou a antecipação do recolhimento do ICMS, ainda que a operação escriturada não seja de ST.",
      procedencia: "inferido",
      observacao: "Domínio é tabela oficial externa (Convênio ICMS 142/2018), não listável inline.",
    },
  ],
  regrasDoRegistro: [
    {
      id: "CAD-0200-001",
      nome: "Código de item duplicado",
      expressao: "count(0200 com o mesmo COD_ITEM) === 1",
      descricao:
        "Dois registros 0200 com o mesmo COD_ITEM tornam ambíguo a que produto o item do documento se refere.",
      severidade: "erro",
      procedencia: "guia-pratico",
      camposEnvolvidos: ["COD_ITEM"],
      correcao: {
        automatizavel: false,
        motivo:
          "Só quem mantém o cadastro sabe se os dois registros são o mesmo item duplicado ou dois itens que receberam o mesmo código por engano. Fundir ou renumerar automaticamente reescreveria todos os C170 que os referenciam.",
        exigeConfirmacao: true,
      },
    },
    {
      id: "CAD-0200-002",
      nome: "Serviço sem código da lista do ISS",
      condicao: 'TIPO_ITEM === "09"',
      expressao: 'COD_LST !== ""',
      descricao: "Item classificado como serviço deveria trazer o código da lista da LC 116/2003.",
      severidade: "alerta",
      procedencia: "inferido",
      camposEnvolvidos: ["TIPO_ITEM", "COD_LST"],
      observacao: "Alerta, e não erro, enquanto o conflito de formato do COD_LST não for resolvido.",
    },
    {
      id: "CAD-0200-003",
      nome: "Código da lista do ISS em item que não é serviço",
      condicao: 'COD_LST !== ""',
      expressao: 'TIPO_ITEM === "09"',
      descricao: "A recíproca da anterior: código de serviço preenchido em item que não foi classificado como serviço.",
      severidade: "alerta",
      procedencia: "inferido",
      camposEnvolvidos: ["TIPO_ITEM", "COD_LST"],
    },
    {
      id: "CAD-0200-004",
      nome: "Exceção de IPI sem NCM",
      condicao: 'EX_IPI !== ""',
      expressao: 'COD_NCM !== ""',
      descricao: "A exceção da TIPI qualifica um NCM: informá-la sem o NCM é incoerência de cadastro.",
      severidade: "alerta",
      procedencia: "inferido",
      camposEnvolvidos: ["EX_IPI", "COD_NCM"],
    },
  ],
};

/* ──────────────────────────────── registro C100 ─────────────────────────── */

/**
 * Condição, repetida em quase todo campo de valor do C100.
 *
 * Existe como constante porque a repetição literal em dezesseis campos é o tipo
 * de coisa que envelhece mal: quando a conferência no Guia resolver a dúvida
 * sobre documento cancelado, muda-se aqui uma vez.
 */
const CONDICAO_DOCUMENTO_COM_VALORES =
  "Documento com movimento — COD_SIT em 00, 01, 06, 07 ou 08. Em documento cancelado, denegado ou com numeração inutilizada (02, 03, 04, 05) o campo em geral não é informado, mas isso NÃO foi conferido no Guia: parte dos geradores preenche e o PVA aceita.";

const REGISTRO_C100: RegistroSped = {
  reg: "C100",
  descricao:
    "Documento fiscal de mercadorias: nota fiscal, NF-e, NFC-e e assemelhados. É o registro-pai dos itens (C170) e do analítico por CST/CFOP/alíquota (C190).",
  bloco: "C",
  nivel: 2,
  pai: ["C001"],
  ocorrencia: "vários por arquivo (1:N)",
  totalCamposDeDados: 28,
  procedencia: "guia-pratico",
  campos: [
    {
      posicao: 2,
      nome: "IND_OPER",
      descricao: "Indicador do tipo de operação: entrada ou saída.",
      tipo: "C",
      tamanho: 1,
      obrigatorio: "O",
      valoresValidos: [
        { valor: "0", descricao: "Entrada ou aquisição" },
        { valor: "1", descricao: "Saída ou prestação" },
      ],
      procedencia: "guia-pratico",
    },
    {
      posicao: 3,
      nome: "IND_EMIT",
      descricao: "Indicador do emitente do documento fiscal.",
      tipo: "C",
      tamanho: 1,
      obrigatorio: "O",
      valoresValidos: [
        { valor: "0", descricao: "Emissão própria" },
        { valor: "1", descricao: "Emissão por terceiros" },
      ],
      procedencia: "guia-pratico",
    },
    {
      posicao: 4,
      nome: "COD_PART",
      descricao: "Código do participante — emitente do documento ou destinatário.",
      tipo: "C",
      tamanho: 60,
      obrigatorio: "OC",
      condicao:
        "Há participante identificado. Não é informado em documento com numeração inutilizada (COD_SIT = 05) nem, tipicamente, em NFC-e a consumidor não identificado.",
      procedencia: "guia-pratico",
      regraRelacional: {
        id: "REL-C100-0150-COD_PART",
        registroAlvo: "0150",
        campoAlvo: "COD_PART",
        descricao: "O participante do documento precisa estar cadastrado na tabela de participantes (0150).",
        severidade: "erro",
        condicao: "COD_PART preenchido e documento fora de COD_SIT 02, 03, 04 e 05.",
      },
    },
    {
      posicao: 5,
      nome: "COD_MOD",
      descricao: "Código do modelo do documento fiscal, conforme a tabela 4.1.1.",
      tipo: "C",
      tamanho: 2,
      obrigatorio: "O",
      procedencia: "tabela-oficial",
      observacao:
        "Domínio é a tabela oficial 4.1.1, que tem dezenas de modelos e muda com o tempo — não é listada inline de propósito. Os valores mais frequentes no bloco C são 01 (nota fiscal), 1B, 04, 55 (NF-e) e 65 (NFC-e), mas listar só esses transformaria modelo legítimo em achado.",
    },
    {
      posicao: 6,
      nome: "COD_SIT",
      descricao: "Código da situação do documento fiscal.",
      tipo: "C",
      tamanho: 2,
      obrigatorio: "O",
      valoresValidos: SITUACAO_DO_DOCUMENTO,
      procedencia: "guia-pratico",
      observacao:
        "O campo mais consequente do registro. É ele que decide se o documento entra no confronto de totalizadores e se deve ter filhos. Toda regra de soma e de presença de C170/C190 precisa consultá-lo ANTES de apontar, ou a auditoria enche de achado falso um arquivo de varejo cheio de cancelamentos.",
    },
    {
      posicao: 7,
      nome: "SER",
      descricao: "Série do documento fiscal.",
      tipo: "C",
      tamanho: 4,
      obrigatorio: "OC",
      condicao: "Documento que possui série.",
      procedencia: "inferido",
      observacao:
        "TAMANHO NÃO CONFERIDO: há publicação com 3 e com 4 posições. Campo alfanumérico — NÃO normalizar o valor armazenado com zeros à esquerda. A normalização vale só na COMPARAÇÃO com a chave de acesso, onde a série ocupa 3 posições preenchidas com zero.",
    },
    {
      posicao: 8,
      nome: "NUM_DOC",
      descricao: "Número do documento fiscal.",
      tipo: "N",
      tamanho: 9,
      obrigatorio: "O",
      procedencia: "guia-pratico",
    },
    {
      posicao: 9,
      nome: "CHV_NFE",
      descricao: "Chave de acesso da NF-e ou NFC-e, com 44 dígitos.",
      tipo: "N",
      tamanho: 44,
      obrigatorio: "OC",
      condicao: "Documento eletrônico — COD_MOD 55 ou 65 —, inclusive quando cancelado ou denegado.",
      procedencia: "guia-pratico",
      observacao:
        "A chave carrega UF, AAMM, CNPJ do emitente, modelo, série, número e dígito verificador, e é a mais rica fonte de conferência cruzada do registro. ARMADILHA: dentro da chave a série ocupa 3 posições e o número 9, SEMPRE preenchidos com zero à esquerda, enquanto SER e NUM_DOC são escriturados sem preenchimento. Comparar por igualdade direta acusa divergência em praticamente toda NF-e de toda escrituração — o pior falso positivo possível. Compare sempre com padStart.",
    },
    {
      posicao: 10,
      nome: "DT_DOC",
      descricao: "Data da emissão do documento fiscal, no formato ddmmaaaa.",
      tipo: "N",
      tamanho: 8,
      obrigatorio: "O",
      procedencia: "guia-pratico",
    },
    {
      posicao: 11,
      nome: "DT_E_S",
      descricao: "Data da entrada ou da saída efetiva da mercadoria.",
      tipo: "N",
      tamanho: 8,
      obrigatorio: "OC",
      condicao: "Houve entrada ou saída efetiva da mercadoria.",
      procedencia: "guia-pratico",
      observacao:
        "Normalmente maior ou igual a DT_DOC — mas entrada extemporânea e devolução produzem casos legítimos fora dessa ordem, então a comparação vale como alerta.",
    },
    {
      posicao: 12,
      nome: "VL_DOC",
      descricao: "Valor total do documento fiscal.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "O",
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
      observacao:
        "NÃO é a soma dos VL_ITEM. É o total do documento: a mercadoria mais frete, seguro, outras despesas, IPI e ST, menos desconto e abatimento não tributado. Ver a regra FIS-C100-010, que escreve a fórmula inteira — e que é a regra mais fácil de implementar errado deste dicionário.",
    },
    {
      posicao: 13,
      nome: "IND_PGTO",
      descricao: "Indicador do tipo de pagamento.",
      tipo: "C",
      tamanho: 1,
      obrigatorio: "OC",
      condicao: "Documento com valor a pagar.",
      procedencia: "inferido",
      observacao:
        "DOMÍNIO NÃO CONFIRMADO e por isso não declarado: leiautes antigos traziam '2 — Outros' onde os atuais trazem '9 — Sem pagamento'. Declarar a lista errada reprova arquivo legítimo; conferir antes de listar.",
    },
    {
      posicao: 14,
      nome: "VL_DESC",
      descricao: "Valor total do desconto comercial.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "OC",
      condicao: CONDICAO_DOCUMENTO_COM_VALORES,
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
    },
    {
      posicao: 15,
      nome: "VL_ABAT_NT",
      descricao: "Abatimento não tributado e não comercial.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "OC",
      condicao: CONDICAO_DOCUMENTO_COM_VALORES,
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
      observacao:
        "Não confundir com VL_DESC: o abatimento reduz o valor a pagar sem reduzir a base de cálculo. Caso clássico em documentos de energia elétrica e comunicação.",
    },
    {
      posicao: 16,
      nome: "VL_MERC",
      descricao: "Valor total das mercadorias e serviços.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "OC",
      condicao: CONDICAO_DOCUMENTO_COM_VALORES,
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
      observacao: "Este sim confronta com a soma dos VL_ITEM dos C170 — ver FIS-C100-011.",
    },
    {
      posicao: 17,
      nome: "IND_FRT",
      descricao: "Indicador do tipo do frete.",
      tipo: "C",
      tamanho: 1,
      obrigatorio: "O",
      procedencia: "inferido",
      observacao:
        "DOMÍNIO NÃO DECLARADO de propósito: a tabela mudou entre versões do leiaute (a redação por conta de emitente/destinatário foi substituída por contratação FOB/CIF, e o código 9 passou a ser 'sem ocorrência de transporte'). Uma lista desatualizada aqui reprova arquivo correto. Conferir a versão vigente antes de listar.",
    },
    {
      posicao: 18,
      nome: "VL_FRT",
      descricao: "Valor do frete indicado no documento fiscal.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "OC",
      condicao: CONDICAO_DOCUMENTO_COM_VALORES,
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
    },
    {
      posicao: 19,
      nome: "VL_SEG",
      descricao: "Valor do seguro indicado no documento fiscal.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "OC",
      condicao: CONDICAO_DOCUMENTO_COM_VALORES,
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
    },
    {
      posicao: 20,
      nome: "VL_OUT_DA",
      descricao: "Valor de outras despesas acessórias.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "OC",
      condicao: CONDICAO_DOCUMENTO_COM_VALORES,
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
    },
    {
      posicao: 21,
      nome: "VL_BC_ICMS",
      descricao: "Valor da base de cálculo do ICMS.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "OC",
      condicao: CONDICAO_DOCUMENTO_COM_VALORES,
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
      observacao: "Confronta com a soma dos VL_BC_ICMS dos C190 do documento.",
    },
    {
      posicao: 22,
      nome: "VL_ICMS",
      descricao: "Valor do ICMS.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "OC",
      condicao: CONDICAO_DOCUMENTO_COM_VALORES,
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
      observacao: "Confronta com a soma dos VL_ICMS dos C190 do documento.",
    },
    {
      posicao: 23,
      nome: "VL_BC_ICMS_ST",
      descricao: "Valor da base de cálculo do ICMS de substituição tributária.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "OC",
      condicao: CONDICAO_DOCUMENTO_COM_VALORES,
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
    },
    {
      posicao: 24,
      nome: "VL_ICMS_ST",
      descricao: "Valor do ICMS retido por substituição tributária.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "OC",
      condicao: CONDICAO_DOCUMENTO_COM_VALORES,
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
    },
    {
      posicao: 25,
      nome: "VL_IPI",
      descricao: "Valor total do IPI.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "OC",
      condicao: CONDICAO_DOCUMENTO_COM_VALORES,
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
    },
    {
      posicao: 26,
      nome: "VL_PIS",
      descricao: "Valor do PIS/PASEP.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "OC",
      condicao: CONDICAO_DOCUMENTO_COM_VALORES,
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
      observacao:
        "Informativo nesta escrituração: a apuração de PIS/COFINS pertence à EFD-Contribuições, e é lá que a aba PIS/COFINS deste sistema vai buscá-la. Nenhuma regra de apuração deve ser escrita sobre este campo aqui.",
    },
    {
      posicao: 27,
      nome: "VL_COFINS",
      descricao: "Valor da COFINS.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "OC",
      condicao: CONDICAO_DOCUMENTO_COM_VALORES,
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
      observacao: "Informativo nesta escrituração — ver VL_PIS.",
    },
    {
      posicao: 28,
      nome: "VL_PIS_ST",
      descricao: "Valor do PIS/PASEP retido por substituição tributária.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "OC",
      condicao: CONDICAO_DOCUMENTO_COM_VALORES,
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
    },
    {
      posicao: 29,
      nome: "VL_COFINS_ST",
      descricao: "Valor da COFINS retida por substituição tributária.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "OC",
      condicao: CONDICAO_DOCUMENTO_COM_VALORES,
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
    },
  ],
  regrasDoRegistro: [
    {
      id: "FIS-C100-010",
      nome: "Valor total do documento",
      condicao:
        "Documento com movimento (COD_SIT em 00, 01, 06, 07, 08) que possua ao menos um C170. Perfil B do declarante dispensa o detalhe por item: documento sem C170 fica fora do confronto.",
      expressao:
        "VL_DOC ≈ soma(C170.VL_ITEM) - soma(C170.VL_DESC) + VL_FRT + VL_SEG + VL_OUT_DA + VL_IPI + VL_ICMS_ST - VL_ABAT_NT",
      descricao:
        "Fecha o valor total do documento contra os itens e os acessórios. A armadilha é tratar VL_DOC como simples soma de VL_ITEM: frete, seguro, outras despesas, IPI e ST SOMAM; desconto e abatimento SUBTRAEM.",
      severidade: "alerta",
      procedencia: "inferido",
      camposEnvolvidos: [
        "VL_DOC", "VL_DESC", "VL_FRT", "VL_SEG", "VL_OUT_DA", "VL_IPI", "VL_ICMS_ST", "VL_ABAT_NT",
      ],
      tolerancia: 0.02,
      observacao:
        "A tolerância não é folga: uma nota com cem itens acumula diferença de arredondamento legítima, e comparar somatórios de centavos com === faria a auditoria acusar divergência em praticamente todo documento grande de toda escrituração. Considere escalar a tolerância com a quantidade de itens (0,01 por item) em vez de fixá-la. Severidade alerta enquanto a fórmula não for conferida no Guia — há documento com composição própria (energia, comunicação, combustível) que legitimamente não fecha por ela.",
    },
    {
      id: "FIS-C100-011",
      nome: "Valor das mercadorias contra a soma dos itens",
      condicao: "Documento com movimento e com ao menos um C170.",
      expressao: "VL_MERC ≈ soma(C170.VL_ITEM)",
      descricao:
        "VL_MERC é o campo que de fato corresponde à soma dos itens — diferentemente de VL_DOC, que inclui os acessórios.",
      severidade: "alerta",
      procedencia: "inferido",
      camposEnvolvidos: ["VL_MERC"],
      tolerancia: 0.02,
    },
    {
      id: "FIS-C100-012",
      nome: "Base e imposto do documento contra o analítico",
      condicao: "Documento com movimento e com ao menos um C190.",
      expressao:
        "VL_BC_ICMS ≈ soma(C190.VL_BC_ICMS) && VL_ICMS ≈ soma(C190.VL_ICMS) && VL_BC_ICMS_ST ≈ soma(C190.VL_BC_ICMS_ST) && VL_ICMS_ST ≈ soma(C190.VL_ICMS_ST) && VL_IPI ≈ soma(C190.VL_IPI)",
      descricao:
        "O C190 é a consolidação por CST/CFOP/alíquota do próprio documento: seus totais têm de reproduzir os do C100.",
      severidade: "alerta",
      procedencia: "inferido",
      camposEnvolvidos: ["VL_BC_ICMS", "VL_ICMS", "VL_BC_ICMS_ST", "VL_ICMS_ST", "VL_IPI"],
      tolerancia: 0.02,
    },
    {
      id: "FIS-C100-013",
      nome: "Chave de acesso coerente com o documento",
      condicao: 'CHV_NFE preenchida com 44 dígitos e COD_MOD em ("55", "65").',
      expressao:
        'CHV_NFE.slice(20, 22) === COD_MOD && CHV_NFE.slice(22, 25) === SER.padStart(3, "0") && CHV_NFE.slice(25, 34) === NUM_DOC.padStart(9, "0") && CHV_NFE.slice(2, 6) === DT_DOC.slice(6, 8) + DT_DOC.slice(2, 4)',
      descricao:
        "A chave de acesso repete modelo, série, número e competência do documento. Divergência aqui costuma denunciar erro de digitação ou documento trocado.",
      severidade: "erro",
      procedencia: "tabela-oficial",
      camposEnvolvidos: ["CHV_NFE", "COD_MOD", "SER", "NUM_DOC", "DT_DOC"],
      observacao:
        "Os padStart são obrigatórios: dentro da chave a série tem 3 posições e o número 9, ambos com zero à esquerda, enquanto SER e NUM_DOC vêm sem preenchimento. Série vazia equivale a '000'. A competência na chave é AAMM com ano de 2 dígitos, e DT_DOC é DDMMAAAA — daí a transformação, e não uma comparação direta.",
      correcao: {
        automatizavel: false,
        motivo:
          "A chave de acesso é gerada e assinada pela SEFAZ. Divergência aqui significa documento trocado ou digitação errada na escrituração; reescrever a chave produziria um arquivo que aponta para um documento que não existe.",
        exigeConfirmacao: true,
      },
    },
    {
      id: "FIS-C100-014",
      nome: "Dígito verificador da chave de acesso",
      condicao: "CHV_NFE preenchida com 44 dígitos.",
      expressao: "CHV_NFE[43] === modulo11(CHV_NFE.slice(0, 43))",
      descricao: "O 44º dígito da chave é verificador (módulo 11) dos 43 anteriores.",
      severidade: "erro",
      procedencia: "tabela-oficial",
      camposEnvolvidos: ["CHV_NFE"],
    },
    {
      id: "FIS-C100-015",
      nome: "UF da chave de acesso coerente com o emitente",
      condicao: 'CHV_NFE preenchida e IND_EMIT === "0" (emissão própria).',
      expressao: "CHV_NFE.slice(0, 2) === codigoIbgeDaUf(0000.UF)",
      descricao:
        "Em documento de emissão própria, os dois primeiros dígitos da chave são o código IBGE da UF do declarante.",
      severidade: "alerta",
      procedencia: "tabela-oficial",
      camposEnvolvidos: ["CHV_NFE", "IND_EMIT"],
      observacao:
        "Só vale para emissão própria. Em documento de terceiros a UF da chave é a do emitente, que pode ser qualquer uma.",
    },
    {
      id: "FIS-C100-016",
      nome: "Documento eletrônico sem chave de acesso",
      condicao: 'COD_MOD em ("55", "65").',
      expressao: 'CHV_NFE !== "" && /^[0-9]{44}$/.test(CHV_NFE)',
      descricao: "NF-e e NFC-e são identificadas pela chave de acesso, inclusive quando canceladas ou denegadas.",
      severidade: "erro",
      procedencia: "guia-pratico",
      camposEnvolvidos: ["COD_MOD", "CHV_NFE"],
    },
    {
      id: "FIS-C100-017",
      nome: "Data de entrada ou saída anterior à emissão",
      condicao: 'DT_E_S !== "" && DT_DOC !== "".',
      expressao: "dataDe(DT_E_S) >= dataDe(DT_DOC)",
      descricao: "A movimentação física normalmente não antecede a emissão do documento.",
      severidade: "alerta",
      procedencia: "inferido",
      camposEnvolvidos: ["DT_DOC", "DT_E_S"],
      observacao:
        "Alerta, nunca erro: devolução e entrada extemporânea produzem casos legítimos fora dessa ordem.",
    },
    {
      id: "FIS-C100-018",
      nome: "Documento sem registro analítico",
      condicao:
        "Documento com movimento (COD_SIT em 00, 01, 06, 07, 08). Documento cancelado, denegado ou inutilizado fica FORA desta regra.",
      expressao: "existe ao menos um C190 filho deste C100",
      descricao: "Todo documento com valores escriturados traz a consolidação por CST/CFOP/alíquota.",
      severidade: "alerta",
      procedencia: "inferido",
      camposEnvolvidos: ["COD_SIT"],
      observacao:
        "PENDENTE: a exigência de filhos para COD_SIT 02, 03, 04 e 05 não foi conferida. Enquanto não for, esses documentos têm de ficar fora — ligada sem a exclusão, esta regra aponta erro em cada NF-e denegada e em cada faixa de numeração inutilizada de um arquivo de varejo.",
    },
  ],
};

/* ──────────────────────────────── registro C170 ─────────────────────────── */

/**
 * Condição dos campos 25 a 36 do C170.
 *
 * Os seis campos de PIS e os seis de COFINS existem neste registro, mas a
 * apuração dessas contribuições pertence à EFD-Contribuições. Quem entrega
 * aquela escrituração em geral deixa estes campos zerados aqui — e uma regra
 * que os cobre gera achado em massa em arquivo perfeitamente regular.
 *
 * São o motivo pelo qual a aba PIS/COFINS tem dicionário próprio: o C170 de lá
 * tem outros campos, nas mesmas posições.
 */
const CONDICAO_PIS_COFINS_INFORMATIVO =
  "Campo de PIS/COFINS na EFD ICMS/IPI: exigido apenas de quem apura essas contribuições por esta escrituração. Quem entrega a EFD-Contribuições normalmente deixa zerado — não cobrar aqui.";

const REGISTRO_C170: RegistroSped = {
  reg: "C170",
  descricao:
    "Itens do documento fiscal. É o registro mais volumoso da escrituração — num arquivo de 100 MB passa de meio milhão de linhas —, e por isso toda regra escrita sobre ele precisa ser O(1) por item.",
  bloco: "C",
  nivel: 3,
  pai: ["C100"],
  ocorrencia: "vários por documento (1:N)",
  totalCamposDeDados: 37,
  procedencia: "guia-pratico",
  campos: [
    {
      posicao: 2,
      nome: "NUM_ITEM",
      descricao: "Número sequencial do item no documento fiscal.",
      tipo: "N",
      tamanho: 3,
      obrigatorio: "O",
      procedencia: "guia-pratico",
    },
    {
      posicao: 3,
      nome: "COD_ITEM",
      descricao: "Código do item no cadastro da empresa.",
      tipo: "C",
      tamanho: 60,
      obrigatorio: "O",
      procedencia: "guia-pratico",
      regraRelacional: {
        id: "REL-C170-0200-COD_ITEM",
        registroAlvo: "0200",
        campoAlvo: "COD_ITEM",
        descricao: "O item do documento precisa estar cadastrado na tabela de itens (0200).",
        severidade: "erro",
        condicao: "COD_ITEM preenchido e documento fora de COD_SIT 02, 03, 04 e 05.",
      },
    },
    {
      posicao: 4,
      nome: "DESCR_COMPL",
      descricao: "Descrição complementar do item, como consta no documento fiscal.",
      tipo: "C",
      tamanho: null,
      obrigatorio: "OC",
      condicao: "A descrição no documento difere da cadastrada no 0200.",
      procedencia: "guia-pratico",
    },
    {
      posicao: 5,
      nome: "QTD",
      descricao: "Quantidade do item.",
      tipo: "N",
      tamanho: null,
      decimais: 5,
      obrigatorio: "O",
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
    },
    {
      posicao: 6,
      nome: "UNID",
      descricao: "Unidade do item, conforme a tabela de unidades de medida.",
      tipo: "C",
      tamanho: 6,
      obrigatorio: "O",
      procedencia: "guia-pratico",
      regraRelacional: {
        id: "REL-C170-0190-UNID",
        registroAlvo: "0190",
        campoAlvo: "UNID",
        descricao: "A unidade do item precisa estar cadastrada na tabela de unidades de medida (0190).",
        severidade: "erro",
        condicao: "UNID preenchida.",
      },
    },
    {
      posicao: 7,
      nome: "VL_ITEM",
      descricao: "Valor total do item, já considerada a quantidade.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "O",
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
      observacao: "É o campo que soma para o VL_MERC do C100 — ver FIS-C100-011.",
    },
    {
      posicao: 8,
      nome: "VL_DESC",
      descricao: "Valor do desconto comercial do item.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "OC",
      condicao: "Houve desconto no item.",
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
    },
    {
      posicao: 9,
      nome: "IND_MOV",
      descricao: "Indicador de movimentação física do item.",
      tipo: "C",
      tamanho: 1,
      obrigatorio: "OC",
      condicao:
        "NÃO CONFERIDO — o layout do leitor não marca este campo como obrigatório, e o Guia não foi conferido. Classificado OC, e não O, exatamente para não emitir achado duro sobre uma dúvida.",
      valoresValidos: [
        { valor: "0", descricao: "Com movimentação física do item" },
        { valor: "1", descricao: "Sem movimentação física do item" },
      ],
      procedencia: "inferido",
    },
    {
      posicao: 10,
      nome: "CST_ICMS",
      descricao: "Código da situação tributária do ICMS: origem da mercadoria mais tributação.",
      tipo: "N",
      tamanho: 3,
      obrigatorio: "O",
      procedencia: "guia-pratico",
      observacao:
        "N(3) = origem (1 dígito, Tabela A) + tributação (2 dígitos, Tabela B). Zeros à esquerda são significativos: '000' é tributação integral de mercadoria nacional. TODA regra que fale de 'CST 40' fala da TRIBUTAÇÃO — use tributacaoDoCstIcms() de nucleo/acesso.ts. Comparar o campo inteiro contra '40' nunca casa, e a regra morre calada: não dispara, não quebra, não aparece em teste, e a auditoria segue dizendo que está tudo certo.",
      regrasValidacaoCustomizadas: [
        {
          id: "FIS-C170-001",
          nome: "Código de situação tributária do ICMS inválido",
          expressao: "origem ∈ TabelaA(0..8) && tributacao ∈ TabelaB(00,10,20,30,40,41,50,51,60,70,90)",
          descricao:
            "O CST é composto por duas tabelas fechadas. O domínio não é listado como valoresValidos porque seriam 99 combinações — vale mais conferir as duas partes separadamente.",
          severidade: "erro",
          procedencia: "guia-pratico",
          camposEnvolvidos: ["CST_ICMS"],
        },
      ],
    },
    {
      posicao: 11,
      nome: "CFOP",
      descricao: "Código fiscal de operação e prestação.",
      tipo: "N",
      tamanho: 4,
      obrigatorio: "O",
      procedencia: "tabela-oficial",
      observacao:
        "Tabela oficial com centenas de códigos: NÃO listar inline. O primeiro dígito dá o sentido da operação — 1, 2 e 3 entram; 5, 6 e 7 saem — e é o que sustenta a conferência barata contra o IND_OPER do documento.",
    },
    {
      posicao: 12,
      nome: "COD_NAT",
      descricao: "Código da natureza da operação.",
      tipo: "C",
      tamanho: 10,
      obrigatorio: "OC",
      condicao: "Declarante que escritura a tabela de natureza da operação (0400) — a exigência varia por UF e perfil.",
      procedencia: "inferido",
      regraRelacional: {
        id: "REL-C170-0400-COD_NAT",
        registroAlvo: "0400",
        campoAlvo: "COD_NAT",
        descricao: "A natureza da operação precisa estar cadastrada no 0400.",
        severidade: "alerta",
        condicao: "COD_NAT preenchido.",
      },
    },
    {
      posicao: 13,
      nome: "VL_BC_ICMS",
      descricao: "Valor da base de cálculo do ICMS.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "OC",
      condicao: "Operação com ICMS próprio — tributação do CST em 00, 10, 20, 70 ou 90.",
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
    },
    {
      posicao: 14,
      nome: "ALIQ_ICMS",
      descricao: "Alíquota do ICMS.",
      tipo: "N",
      tamanho: 6,
      decimais: 2,
      obrigatorio: "OC",
      condicao: "Há ICMS próprio destacado no item.",
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
    },
    {
      posicao: 15,
      nome: "VL_ICMS",
      descricao: "Valor do ICMS creditado ou debitado.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "OC",
      condicao: "Operação com ICMS próprio.",
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
    },
    {
      posicao: 16,
      nome: "VL_BC_ICMS_ST",
      descricao: "Valor da base de cálculo do ICMS de substituição tributária.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "OC",
      condicao: "Operação com substituição tributária — tributação do CST em 10, 30, 70 e, nas entradas, 60.",
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
    },
    {
      posicao: 17,
      nome: "ALIQ_ST",
      descricao: "Alíquota do ICMS de substituição tributária.",
      tipo: "N",
      tamanho: 6,
      decimais: 2,
      obrigatorio: "OC",
      condicao: "Há ICMS-ST no item.",
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
    },
    {
      posicao: 18,
      nome: "VL_ICMS_ST",
      descricao: "Valor do ICMS retido por substituição tributária.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "OC",
      condicao: "Há ICMS-ST no item.",
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
    },
    {
      posicao: 19,
      nome: "IND_APUR",
      descricao: "Indicador do período de apuração do IPI.",
      tipo: "C",
      tamanho: 1,
      obrigatorio: "OC",
      condicao: "Contribuinte do IPI (IND_ATIV = 0 no 0000) com IPI escriturado no item.",
      valoresValidos: [
        { valor: "0", descricao: "Apuração mensal do IPI" },
        { valor: "1", descricao: "Apuração decendial do IPI" },
      ],
      procedencia: "guia-pratico",
    },
    {
      posicao: 20,
      nome: "CST_IPI",
      descricao: "Código da situação tributária do IPI.",
      tipo: "C",
      tamanho: 2,
      obrigatorio: "OC",
      condicao: "Contribuinte do IPI.",
      valoresValidos: [
        { valor: "00", descricao: "Entrada com recuperação de crédito" },
        { valor: "01", descricao: "Entrada tributada com alíquota zero" },
        { valor: "02", descricao: "Entrada isenta" },
        { valor: "03", descricao: "Entrada não tributada" },
        { valor: "04", descricao: "Entrada imune" },
        { valor: "05", descricao: "Entrada com suspensão" },
        { valor: "49", descricao: "Outras entradas" },
        { valor: "50", descricao: "Saída tributada" },
        { valor: "51", descricao: "Saída tributada com alíquota zero" },
        { valor: "52", descricao: "Saída isenta" },
        { valor: "53", descricao: "Saída não tributada" },
        { valor: "54", descricao: "Saída imune" },
        { valor: "55", descricao: "Saída com suspensão" },
        { valor: "99", descricao: "Outras saídas" },
      ],
      procedencia: "tabela-oficial",
      observacao:
        "Os códigos 00 a 49 são de ENTRADA e os de 50 a 99 são de SAÍDA — o que permite conferir coerência com o IND_OPER do documento.",
    },
    {
      posicao: 21,
      nome: "COD_ENQ",
      descricao: "Código de enquadramento legal do IPI.",
      tipo: "C",
      tamanho: 3,
      obrigatorio: "OC",
      condicao: "Há IPI escriturado no item, conforme o CST_IPI informado.",
      procedencia: "inferido",
    },
    {
      posicao: 22,
      nome: "VL_BC_IPI",
      descricao: "Valor da base de cálculo do IPI.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "OC",
      condicao: "Item com IPI tributado — CST_IPI 00 ou 50.",
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
      observacao:
        "É BASE, não imposto: confronta com ALIQ_IPI para reproduzir VL_IPI, e NÃO soma contra nenhum total de imposto. O C190 sequer tem campo de base de IPI — uma regra que compare a soma das bases contra o VL_IPI do C190 acusaria divergência em todo documento com IPI, já que a base é sempre maior que o imposto.",
    },
    {
      posicao: 23,
      nome: "ALIQ_IPI",
      descricao: "Alíquota do IPI.",
      tipo: "N",
      tamanho: 6,
      decimais: 2,
      obrigatorio: "OC",
      condicao: "Item com IPI tributado.",
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
    },
    {
      posicao: 24,
      nome: "VL_IPI",
      descricao: "Valor do IPI creditado ou debitado.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "OC",
      condicao: "Há IPI no item.",
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
      observacao:
        "É este campo — e não VL_BC_IPI — que totaliza: soma contra o VL_IPI do C190 (posição 11) e o do C100 (posição 25), sempre com tolerância.",
    },
    {
      posicao: 25,
      nome: "CST_PIS",
      descricao: "Código da situação tributária do PIS/PASEP.",
      tipo: "N",
      tamanho: 2,
      obrigatorio: "OC",
      condicao: CONDICAO_PIS_COFINS_INFORMATIVO,
      procedencia: "inferido",
      observacao:
        "Domínio é a tabela 4.3.3 da EFD-Contribuições, que a plataforma já sincroniza em public/data/tabelas-sped.json. Não listar inline: a tabela muda e o robô já a mantém.",
    },
    {
      posicao: 26,
      nome: "VL_BC_PIS",
      descricao: "Valor da base de cálculo do PIS.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "OC",
      condicao: CONDICAO_PIS_COFINS_INFORMATIVO,
      vazioEquivaleAZero: true,
      procedencia: "inferido",
    },
    {
      posicao: 27,
      nome: "ALIQ_PIS_PERC",
      descricao: "Alíquota do PIS em percentual.",
      tipo: "N",
      tamanho: 8,
      decimais: 4,
      obrigatorio: "OC",
      condicao: "Tributação do PIS por percentual sobre o valor. " + CONDICAO_PIS_COFINS_INFORMATIVO,
      vazioEquivaleAZero: true,
      procedencia: "inferido",
      observacao:
        "Par alternativo ao QUANT_BC_PIS × ALIQ_PIS_R$: ou se tributa por percentual sobre valor, ou por unidade de medida. Os quatro campos preenchidos ao mesmo tempo é incoerência.",
    },
    {
      posicao: 28,
      nome: "QUANT_BC_PIS",
      descricao: "Quantidade que serve de base de cálculo do PIS.",
      tipo: "N",
      tamanho: null,
      decimais: 3,
      obrigatorio: "OC",
      condicao: "Tributação do PIS por unidade de medida. " + CONDICAO_PIS_COFINS_INFORMATIVO,
      vazioEquivaleAZero: true,
      procedencia: "inferido",
    },
    {
      posicao: 29,
      nome: "ALIQ_PIS_R$",
      descricao: "Alíquota do PIS em reais por unidade de medida.",
      tipo: "N",
      tamanho: null,
      decimais: 4,
      obrigatorio: "OC",
      condicao: "Tributação do PIS por unidade de medida. " + CONDICAO_PIS_COFINS_INFORMATIVO,
      vazioEquivaleAZero: true,
      procedencia: "inferido",
    },
    {
      posicao: 30,
      nome: "VL_PIS",
      descricao: "Valor do PIS.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "OC",
      condicao: CONDICAO_PIS_COFINS_INFORMATIVO,
      vazioEquivaleAZero: true,
      procedencia: "inferido",
    },
    {
      posicao: 31,
      nome: "CST_COFINS",
      descricao: "Código da situação tributária da COFINS.",
      tipo: "N",
      tamanho: 2,
      obrigatorio: "OC",
      condicao: CONDICAO_PIS_COFINS_INFORMATIVO,
      procedencia: "inferido",
      observacao:
        "Domínio é a tabela 4.3.4 da EFD-Contribuições. Os códigos coincidem com os do CST_PIS, mas as tabelas são distintas e podem divergir numa revisão — não reaproveitar a lista.",
    },
    {
      posicao: 32,
      nome: "VL_BC_COFINS",
      descricao: "Valor da base de cálculo da COFINS.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "OC",
      condicao: CONDICAO_PIS_COFINS_INFORMATIVO,
      vazioEquivaleAZero: true,
      procedencia: "inferido",
    },
    {
      posicao: 33,
      nome: "ALIQ_COFINS_PERC",
      descricao: "Alíquota da COFINS em percentual.",
      tipo: "N",
      tamanho: 8,
      decimais: 4,
      obrigatorio: "OC",
      condicao: "Tributação da COFINS por percentual sobre o valor. " + CONDICAO_PIS_COFINS_INFORMATIVO,
      vazioEquivaleAZero: true,
      procedencia: "inferido",
    },
    {
      posicao: 34,
      nome: "QUANT_BC_COFINS",
      descricao: "Quantidade que serve de base de cálculo da COFINS.",
      tipo: "N",
      tamanho: null,
      decimais: 3,
      obrigatorio: "OC",
      condicao: "Tributação da COFINS por unidade de medida. " + CONDICAO_PIS_COFINS_INFORMATIVO,
      vazioEquivaleAZero: true,
      procedencia: "inferido",
    },
    {
      posicao: 35,
      nome: "ALIQ_COFINS_R$",
      descricao: "Alíquota da COFINS em reais por unidade de medida.",
      tipo: "N",
      tamanho: null,
      decimais: 4,
      obrigatorio: "OC",
      condicao: "Tributação da COFINS por unidade de medida. " + CONDICAO_PIS_COFINS_INFORMATIVO,
      vazioEquivaleAZero: true,
      procedencia: "inferido",
    },
    {
      posicao: 36,
      nome: "VL_COFINS",
      descricao: "Valor da COFINS.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "OC",
      condicao: CONDICAO_PIS_COFINS_INFORMATIVO,
      vazioEquivaleAZero: true,
      procedencia: "inferido",
    },
    {
      posicao: 37,
      nome: "COD_CTA",
      descricao: "Código da conta analítica contábil debitada ou creditada.",
      tipo: "C",
      tamanho: null,
      obrigatorio: "OC",
      condicao: "Declarante que escritura o plano de contas no registro 0500 — varia por perfil e UF.",
      procedencia: "inferido",
    },
    {
      posicao: 38,
      nome: "VL_ABAT_NT",
      descricao: "Abatimento não tributado e não comercial do item.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "OC",
      condicao: "Há abatimento não tributado no item — caso clássico em documentos de energia elétrica e comunicação.",
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
    },
  ],
  regrasDoRegistro: [
    {
      id: "FIS-C170-010",
      nome: "Operação tributada sem base de cálculo ou sem imposto",
      condicao: 'tributacaoDoCstIcms(CST_ICMS) em ("00", "10")',
      expressao: "VL_BC_ICMS > 0 && VL_ICMS > 0",
      descricao:
        "Tributação integral (00) e tributação com ST (10) implicam ICMS próprio destacado: base e imposto maiores que zero.",
      severidade: "erro",
      procedencia: "guia-pratico",
      camposEnvolvidos: ["CST_ICMS", "VL_BC_ICMS", "VL_ICMS"],
      observacao:
        "A comparação é sobre a TRIBUTAÇÃO — os dois últimos dígitos. O CST real é '000' ou '110', nunca '00'. Item com VL_ITEM zero (brinde, bonificação escriturada a valor zero) precisa ficar fora, ou a regra aponta erro sobre linha legítima.",
    },
    {
      id: "FIS-C170-011",
      nome: "Operação isenta ou suspensa com imposto destacado",
      condicao: 'tributacaoDoCstIcms(CST_ICMS) em ("40", "41", "50")',
      expressao: "VL_ICMS === 0",
      descricao:
        "Isenta (40), não tributada (41) e suspensão (50) não têm ICMS próprio: destacar imposto aqui é erro de classificação ou de cálculo.",
      severidade: "erro",
      procedencia: "guia-pratico",
      camposEnvolvidos: ["CST_ICMS", "VL_ICMS"],
      observacao:
        "Campo de valor vazio conta como zero e NÃO é achado — ver vazioEquivaleAZero. A regra vale para o ICMS próprio; ST em CST 30 e 60 é outra coisa e tem regra própria.",
      correcao: {
        automatizavel: false,
        motivo:
          "Zerar o VL_ICMS muda a apuração do período e, com ela, quanto o contribuinte deve. O erro pode estar no imposto (destaque indevido) ou no CST (operação na verdade tributada) — são correções opostas, e só quem conhece a operação decide qual.",
        campoCorrigido: "VL_ICMS",
        exigeConfirmacao: true,
      },
    },
    {
      id: "FIS-C170-012",
      nome: "Base de cálculo sem imposto, ou imposto sem base",
      condicao: 'tributacaoDoCstIcms(CST_ICMS) em ("00", "10", "20", "70", "90")',
      expressao: "(VL_BC_ICMS > 0) === (VL_ICMS > 0)",
      descricao: "Base e imposto caminham juntos: um deles sozinho denuncia cálculo interrompido.",
      severidade: "alerta",
      procedencia: "inferido",
      camposEnvolvidos: ["VL_BC_ICMS", "VL_ICMS"],
      observacao:
        "Alerta, não erro: alíquota zero legítima produz base positiva com imposto zero, e CST 90 comporta arranjos próprios.",
    },
    {
      id: "FIS-C170-013",
      nome: "Imposto divergente da base multiplicada pela alíquota",
      condicao: "VL_BC_ICMS > 0 && ALIQ_ICMS > 0",
      expressao: "VL_ICMS ≈ VL_BC_ICMS * ALIQ_ICMS / 100",
      descricao: "Confere o cálculo do ICMS do item.",
      severidade: "alerta",
      procedencia: "guia-pratico",
      camposEnvolvidos: ["VL_BC_ICMS", "ALIQ_ICMS", "VL_ICMS"],
      tolerancia: 0.01,
      observacao:
        "Redução de base (tributação 20 e 70) já vem refletida na própria VL_BC_ICMS, então a fórmula continua valendo. Sem tolerância, o arredondamento de centavo faz esta regra disparar em item perfeitamente calculado.",
    },
    {
      id: "FIS-C170-014",
      nome: "Substituição tributária sem base ou sem imposto retido",
      condicao: 'tributacaoDoCstIcms(CST_ICMS) em ("10", "30", "70")',
      expressao: "VL_BC_ICMS_ST > 0 && VL_ICMS_ST > 0",
      descricao: "As tributações 10, 30 e 70 são de operação COM cobrança do ICMS por substituição tributária.",
      severidade: "alerta",
      procedencia: "inferido",
      camposEnvolvidos: ["CST_ICMS", "VL_BC_ICMS_ST", "VL_ICMS_ST"],
      observacao:
        "Alerta: na ENTRADA com CST 10/70 o adquirente não retém — quem retém é o remetente —, então a exigência não vale nos dois sentidos. Conferir o tratamento por IND_OPER antes de promover a erro.",
    },
    {
      id: "FIS-C170-015",
      nome: "Item com ICMS já retido anteriormente e imposto destacado",
      condicao: 'tributacaoDoCstIcms(CST_ICMS) === "60"',
      expressao: "VL_ICMS === 0",
      descricao:
        "Tributação 60 é mercadoria cujo ICMS já foi cobrado por substituição em operação anterior: não há imposto próprio a destacar.",
      severidade: "alerta",
      procedencia: "inferido",
      camposEnvolvidos: ["CST_ICMS", "VL_ICMS"],
      observacao:
        "Alerta, não erro: há UF que admite destaque em CST 60 para fins de ressarcimento, e o tratamento varia. Não promover a erro sem conferir a legislação estadual.",
    },
    {
      id: "FIS-C170-016",
      nome: "Redução de base sem valor de redução no analítico",
      condicao: 'tributacaoDoCstIcms(CST_ICMS) em ("20", "70")',
      expressao: "existe C190 correspondente com VL_RED_BC > 0",
      descricao:
        "Tributação 20 e 70 são operações com redução da base de cálculo: o analítico do documento deve registrar o valor reduzido.",
      severidade: "alerta",
      procedencia: "inferido",
      camposEnvolvidos: ["CST_ICMS"],
    },
    {
      id: "FIS-C170-020",
      nome: "Tipo do item incompatível com o CFOP",
      condicao:
        'Item cadastrado no 0200 com TIPO_ITEM = "00" (mercadoria para revenda) e CFOP de venda de produção própria.',
      expressao: 'NÃO (TIPO_ITEM(0200) === "00" && CFOP em CFOPS_DE_PRODUCAO_PROPRIA)',
      descricao:
        "Mercadoria adquirida para revenda não sai como produção própria. O caso clássico é TIPO_ITEM 00 com CFOP 5101: ou o cadastro do item está errado, ou o CFOP deveria ser 5102 (venda de mercadoria adquirida de terceiros).",
      severidade: "erro",
      procedencia: "guia-pratico",
      camposEnvolvidos: ["COD_ITEM", "CFOP"],
      observacao:
        "Depende do cruzamento com o 0200 — o TIPO_ITEM não está no C170. Implementar consultando o cadastro de produtos, que o parser já mantém indexado. CFOPS_DE_PRODUCAO_PROPRIA deve viver na tabela de CFOP, não codificada na regra: a lista vai além do 5101 (inclui 6101, 5151, 5106 e outros) e muda com o tempo.",
      correcao: {
        automatizavel: false,
        motivo:
          "Trocar CFOP ou TIPO_ITEM é reclassificar a operação. O enquadramento correto depende do contrato, da mercadoria e do destinatário — nada disso está no arquivo.",
        exigeConfirmacao: true,
      },
    },
    {
      id: "FIS-C170-021",
      nome: "Sentido do CFOP divergente do tipo de operação",
      condicao: "CFOP preenchido e IND_OPER do documento preenchido.",
      expressao:
        'IND_OPER === "0" ? CFOP[0] em ("1","2","3") : CFOP[0] em ("5","6","7")',
      descricao:
        "O primeiro dígito do CFOP dá o sentido: 1, 2 e 3 são entradas; 5, 6 e 7 são saídas. Precisa concordar com o IND_OPER do documento.",
      severidade: "erro",
      procedencia: "tabela-oficial",
      camposEnvolvidos: ["CFOP"],
      observacao: "Já implementada como FIS-014 em src/icms-ipi/auditoria/regras/.",
    },
    {
      id: "FIS-C170-022",
      nome: "Item sem correspondência no registro analítico",
      condicao: "Documento com movimento e com ao menos um C190.",
      expressao: "existe C190 com (CST_ICMS, CFOP, ALIQ_ICMS) igual aos do item",
      descricao:
        "O C190 consolida os itens por CST, CFOP e alíquota: todo item tem de cair em alguma das linhas analíticas do documento.",
      severidade: "alerta",
      procedencia: "guia-pratico",
      camposEnvolvidos: ["CST_ICMS", "CFOP", "ALIQ_ICMS"],
      observacao:
        "A comparação de alíquota precisa ser numérica: '18,00' e '18,0' são a mesma alíquota e a comparação textual as separaria, gerando achado em documento correto.",
    },
    {
      id: "FIS-C170-023",
      nome: "Soma dos itens divergente do analítico",
      condicao: "Documento com movimento, com C170 e com C190.",
      expressao:
        "para cada (CST_ICMS, CFOP, ALIQ_ICMS): soma(C170.VL_ITEM) ≈ C190.VL_OPR && soma(C170.VL_BC_ICMS) ≈ C190.VL_BC_ICMS && soma(C170.VL_ICMS) ≈ C190.VL_ICMS",
      descricao: "Fecha os itens contra a consolidação do próprio documento, grupo a grupo.",
      severidade: "alerta",
      procedencia: "inferido",
      camposEnvolvidos: ["VL_ITEM", "VL_BC_ICMS", "VL_ICMS"],
      tolerancia: 0.02,
      observacao:
        "O VL_OPR do C190 inclui os acessórios rateados por grupo, então a comparação contra a soma pura de VL_ITEM pode divergir legitimamente em documento com frete e despesas. Conferir o critério de rateio antes de promover a erro.",
    },
    {
      id: "FIS-C170-024",
      nome: "IPI divergente da base multiplicada pela alíquota",
      condicao: "VL_BC_IPI > 0 && ALIQ_IPI > 0",
      expressao: "VL_IPI ≈ VL_BC_IPI * ALIQ_IPI / 100",
      descricao: "Confere o cálculo do IPI do item.",
      severidade: "alerta",
      procedencia: "guia-pratico",
      camposEnvolvidos: ["VL_BC_IPI", "ALIQ_IPI", "VL_IPI"],
      tolerancia: 0.01,
    },
    {
      id: "FIS-C170-025",
      nome: "Sentido do CST de IPI divergente da operação",
      condicao: 'CST_IPI preenchido.',
      expressao:
        'IND_OPER === "0" ? Number(CST_IPI) <= 49 : Number(CST_IPI) >= 50',
      descricao:
        "Os códigos 00 a 49 do CST de IPI são de entrada; 50 a 99, de saída. Precisam concordar com o sentido do documento.",
      severidade: "alerta",
      procedencia: "tabela-oficial",
      camposEnvolvidos: ["CST_IPI"],
    },
    {
      id: "FIS-C170-026",
      nome: "IPI destacado em item não tributado",
      condicao: 'CST_IPI em ("01","02","03","04","05","51","52","53","54","55")',
      expressao: "VL_IPI === 0",
      descricao:
        "Alíquota zero, isento, não tributado, imune e suspensão não geram IPI: destacar valor aqui é incoerência.",
      severidade: "alerta",
      procedencia: "inferido",
      camposEnvolvidos: ["CST_IPI", "VL_IPI"],
    },
    {
      id: "FIS-C170-027",
      nome: "Numeração de item duplicada no documento",
      expressao: "count(C170 do mesmo C100 com o mesmo NUM_ITEM) === 1",
      descricao: "O número do item é sequencial dentro do documento: repetição denuncia geração defeituosa.",
      severidade: "alerta",
      procedencia: "inferido",
      camposEnvolvidos: ["NUM_ITEM"],
    },
    {
      id: "FIS-C170-028",
      nome: "Unidade do item divergente da unidade de inventário",
      condicao: "Item cadastrado no 0200.",
      expressao: "UNID === UNID_INV(0200) || existe conversão em 0220",
      descricao:
        "A unidade usada no documento deveria ser a de inventário do item, ou ter fator de conversão declarado no 0220.",
      severidade: "info",
      procedencia: "inferido",
      camposEnvolvidos: ["UNID", "COD_ITEM"],
      observacao:
        "Apenas informativo: vender em caixa o que se inventaria em unidade é absolutamente normal, e o 0220 existe para isso. Promover a alerta só depois de conferir se o 0220 está presente no arquivo.",
    },
    {
      id: "FIS-C170-029",
      nome: "Tributação de PIS/COFINS por percentual e por unidade ao mesmo tempo",
      condicao: "Campos de PIS ou de COFINS preenchidos.",
      expressao:
        "NÃO (VL_BC_PIS > 0 && QUANT_BC_PIS > 0) && NÃO (VL_BC_COFINS > 0 && QUANT_BC_COFINS > 0)",
      descricao:
        "Ou se tributa por percentual sobre o valor, ou por unidade de medida — os dois pares preenchidos ao mesmo tempo é incoerência.",
      severidade: "info",
      procedencia: "inferido",
      camposEnvolvidos: ["VL_BC_PIS", "QUANT_BC_PIS", "VL_BC_COFINS", "QUANT_BC_COFINS"],
      observacao:
        "Severidade info porque estes campos são informativos nesta escrituração. A conferência séria de PIS/COFINS pertence à outra aba, sobre a EFD-Contribuições.",
    },
  ],
};

/* ──────────────────────────────── registro C190 ─────────────────────────── */

/**
 * Condição dos campos de valor do C190.
 *
 * Todos são `O` no leiaute — o delimitador tem de estar lá —, mas conteúdo
 * vazio é aceito e vale zero. A escrituração de referência do próprio
 * repositório prova: seu C190 traz `VL_IPI` vazio e é arquivo válido.
 */
const REGISTRO_C190: RegistroSped = {
  reg: "C190",
  descricao:
    "Registro analítico do documento: consolida os itens por combinação de CST do ICMS, CFOP e alíquota. É exigido para os documentos que carregam valores (COD_SIT 00, 01, 06, 07 e 08).",
  bloco: "C",
  nivel: 3,
  pai: ["C100"],
  ocorrencia: "vários por documento (1:N)",
  totalCamposDeDados: 11,
  procedencia: "guia-pratico",
  observacao:
    "PENDENTE — a exigência do C190 para documento cancelado (02, 03), denegado (04) e com numeração inutilizada (05) não foi conferida. Até lá, esses documentos ficam FORA de qualquer regra de presença: uma regra 'C100 sem C190' sem essa exclusão aponta erro em cada NF-e denegada e em cada faixa inutilizada de um arquivo de varejo.",
  campos: [
    {
      posicao: 2,
      nome: "CST_ICMS",
      descricao: "Código da situação tributária do ICMS do grupo consolidado.",
      tipo: "N",
      tamanho: 3,
      obrigatorio: "O",
      procedencia: "guia-pratico",
      observacao:
        "Mesma composição do CST do C170: origem + tributação, com zeros à esquerda significativos. Integra a chave de consolidação do registro.",
    },
    {
      posicao: 3,
      nome: "CFOP",
      descricao: "Código fiscal de operação e prestação do grupo consolidado.",
      tipo: "N",
      tamanho: 4,
      obrigatorio: "O",
      procedencia: "tabela-oficial",
    },
    {
      posicao: 4,
      nome: "ALIQ_ICMS",
      descricao: "Alíquota do ICMS do grupo consolidado.",
      tipo: "N",
      tamanho: 6,
      decimais: 2,
      obrigatorio: "OC",
      condicao:
        "Grupo com ICMS próprio destacado. Vem vazia nas tributações sem imposto próprio (30, 40, 41, 50, 51, 60) e pode vir vazia em 90.",
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
      observacao:
        "Único campo não obrigatório entre os oito primeiros. A regra mais robusta não é enumerar os CST em que a alíquota falta — enumeração envelhece e esquece o 30 e o 90 —, e sim exigir alíquota preenchida apenas onde VL_ICMS > 0, que se verifica dentro do próprio registro.",
    },
    {
      posicao: 5,
      nome: "VL_OPR",
      descricao: "Valor da operação correspondente à combinação, já com os acessórios rateados.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "O",
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
      observacao:
        "Inclui frete, seguro, despesas e ST rateados no grupo — por isso não bate exatamente com a soma pura dos VL_ITEM dos C170 do mesmo grupo.",
    },
    {
      posicao: 6,
      nome: "VL_BC_ICMS",
      descricao: "Valor da base de cálculo do ICMS do grupo.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "O",
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
    },
    {
      posicao: 7,
      nome: "VL_ICMS",
      descricao: "Valor do ICMS do grupo.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "O",
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
    },
    {
      posicao: 8,
      nome: "VL_BC_ICMS_ST",
      descricao: "Valor da base de cálculo do ICMS de substituição tributária do grupo.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "O",
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
    },
    {
      posicao: 9,
      nome: "VL_ICMS_ST",
      descricao: "Valor do ICMS retido por substituição tributária do grupo.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "O",
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
    },
    {
      posicao: 10,
      nome: "VL_RED_BC",
      descricao: "Valor da redução da base de cálculo do grupo.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "O",
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
      observacao: "Preenchido nas tributações com redução de base — 20 e 70.",
    },
    {
      posicao: 11,
      nome: "VL_IPI",
      descricao: "Valor do IPI do grupo.",
      tipo: "N",
      tamanho: null,
      decimais: 2,
      obrigatorio: "O",
      vazioEquivaleAZero: true,
      procedencia: "guia-pratico",
      observacao:
        "Prova viva de que `O` em campo de valor não significa conteúdo não-vazio: a escrituração válida de referência do repositório (scripts/testes/icms-ipi.test.ts) traz este campo VAZIO. Um motor que trate `O` como 'não pode estar vazio' reprova o arquivo de teste do próprio projeto — e toda escrituração de contribuinte que não destaca IPI.",
    },
    {
      posicao: 12,
      nome: "COD_OBS",
      descricao: "Código da observação do lançamento fiscal.",
      tipo: "C",
      tamanho: 6,
      obrigatorio: "OC",
      condicao: "Há observação a vincular ao grupo.",
      procedencia: "inferido",
      regraRelacional: {
        id: "REL-C190-0460-COD_OBS",
        registroAlvo: "0460",
        campoAlvo: "COD_OBS",
        descricao: "A observação precisa estar cadastrada na tabela de observações do lançamento fiscal (0460).",
        severidade: "erro",
        condicao: "COD_OBS preenchido. O registro 0460 ainda não está no dicionário — regra bloqueada até que esteja.",
      },
    },
  ],
  regrasDoRegistro: [
    {
      id: "FIS-C190-010",
      nome: "Alíquota ausente em grupo com ICMS destacado",
      condicao: "VL_ICMS > 0",
      expressao: "ALIQ_ICMS > 0",
      descricao:
        "Se o grupo tem imposto próprio, tem alíquota. Formulada assim — e não como lista de CST dispensados — a regra não envelhece junto com a tabela de tributações.",
      severidade: "erro",
      procedencia: "inferido",
      camposEnvolvidos: ["ALIQ_ICMS", "VL_ICMS"],
    },
    {
      id: "FIS-C190-011",
      nome: "Imposto divergente da base multiplicada pela alíquota",
      condicao: "VL_BC_ICMS > 0 && ALIQ_ICMS > 0",
      expressao: "VL_ICMS ≈ VL_BC_ICMS * ALIQ_ICMS / 100",
      descricao: "Confere o cálculo consolidado do grupo.",
      severidade: "alerta",
      procedencia: "guia-pratico",
      camposEnvolvidos: ["VL_BC_ICMS", "ALIQ_ICMS", "VL_ICMS"],
      tolerancia: 0.01,
    },
    {
      id: "FIS-C190-012",
      nome: "Grupo isento com imposto destacado",
      condicao: 'tributacaoDoCstIcms(CST_ICMS) em ("40", "41", "50")',
      expressao: "VL_ICMS === 0",
      descricao: "A mesma regra de isenção do item, aplicada à consolidação.",
      severidade: "erro",
      procedencia: "guia-pratico",
      camposEnvolvidos: ["CST_ICMS", "VL_ICMS"],
    },
    {
      id: "FIS-C190-013",
      nome: "Redução de base sem valor reduzido",
      condicao: 'tributacaoDoCstIcms(CST_ICMS) em ("20", "70")',
      expressao: "VL_RED_BC > 0",
      descricao: "Tributação com redução de base deve registrar quanto foi reduzido.",
      severidade: "alerta",
      procedencia: "inferido",
      camposEnvolvidos: ["CST_ICMS", "VL_RED_BC"],
    },
    {
      id: "FIS-C190-014",
      nome: "Combinação analítica duplicada no documento",
      condicao: "Dois C190 do mesmo documento com o mesmo COD_OBS — inclusive ambos vazios.",
      expressao: "count(C190 do mesmo C100 com a mesma chave) === 1",
      descricao:
        "O C190 consolida: dois registros com a mesma combinação de CST, CFOP e alíquota deveriam ser um só.",
      severidade: "alerta",
      procedencia: "inferido",
      camposEnvolvidos: ["CST_ICMS", "CFOP", "ALIQ_ICMS", "COD_OBS"],
      observacao:
        "BLOQUEADA por uma pendência: não está conferido se COD_OBS integra a chave de agrupamento. Se integrar, duas combinações iguais com observações distintas são legítimas e viram duas linhas. Por isso a condição exige mesmo COD_OBS — esse subconjunto é seguro nas duas hipóteses.",
    },
  ],
};

/* ──────────────────────────────── o dicionário ──────────────────────────── */

export const DICIONARIO_SPED_ICMS_IPI: DicionarioSped = {
  id: "EFD-ICMS-IPI",
  nome: "EFD ICMS/IPI — Escrituração Fiscal Digital",
  versaoLeiaute: "017",
  fonte: "https://www.gov.br/sped/pt-br/assuntos/escrituracoes-digitais/efd-icms-ipi",
  registros: {
    "0000": REGISTRO_0000,
    "0150": REGISTRO_0150,
    "0200": REGISTRO_0200,
    C100: REGISTRO_C100,
    C170: REGISTRO_C170,
    C190: REGISTRO_C190,
  },
  pendenciasDeConferencia: [
    // ─── bloqueantes: regra nenhuma deve ser ligada antes de resolver ───
    "C190: a exigência de registros filhos para COD_SIT 02, 03, 04 e 05 (cancelado, denegado, inutilizado). Até a conferência, esses documentos ficam FORA de toda regra de presença e de totalizador.",
    "C190: se COD_OBS integra a chave de agrupamento (CST_ICMS + CFOP + ALIQ_ICMS). Bloqueia a regra de duplicidade FIS-C190-014.",
    "0200 COD_LST: conflito de tipo e formato — N(4) sem ponto ('1401') ou C(5) com ponto ('14.01'). Nenhuma regra de formato, tipo ou tamanho antes de resolver.",
    "C100: a lista exata de campos vedados em documento cancelado, denegado e inutilizado. Parte dos geradores preenche os valores e o PVA aceita — por isso a condição dos 16 campos de valor é hoje descritiva, não bloqueante.",
    "C100 VL_DOC (FIS-C100-010): conferir a fórmula do valor total e o critério de rateio dos acessórios no C190 (FIS-C170-023). Ambas as regras estão como alerta por causa disto.",

    // ─── domínios não declarados por falta de conferência ───
    "C100 IND_PGTO: o domínio mudou entre versões ('2 — Outros' virou '9 — Sem pagamento'). Não declarado até conferir.",
    "C100 IND_FRT: o domínio foi reescrito entre versões (conta do emitente/destinatário → contratação FOB/CIF). Não declarado até conferir.",
    "C100 COD_MOD: a tabela 4.1.1 tem dezenas de modelos — carregar como tabela, nunca inline.",

    // ─── tamanhos e obrigatoriedades vindos do leiaute, sem conferência documental ───
    "Tamanhos marcados como 'inferido' em geral: 0000 NOME(100), IE(14), IM(60), SUFRAMA(9); 0150 NOME(100), IE(14), SUFRAMA(9), END(60), NUM(10), COMPL(60), BAIRRO(60); 0200 COD_ITEM(60), UNID_INV(6), COD_NCM(8), EX_IPI(3), COD_GEN(2), CEST(7); C100 SER(3 ou 4 — divergente entre publicações). Enquanto não conferidos, estouro de tamanho é ALERTA, nunca erro.",
    "0150 END: conferir se é 'O' ou 'OC' no leiaute vigente. Marcado 'O' com procedência inferida — se for OC, cobrar 'O' reprova participante estrangeiro e cadastro eventual sem logradouro.",
    "0200 COD_NCM: a condicionalidade (industrial/equiparado, itens de ST, comércio exterior) não foi conferida.",
    "0200 COD_GEN: a condicionalidade não foi confirmada, e a correlação 'dois primeiros dígitos do NCM' diverge entre versões.",
    "0200 COD_ANT_ITEM: conferir se a versão vigente mantém o campo utilizável ou direciona a alteração de código para o registro 0205.",
    "0200 ALIQ_ICMS: conferir em que hipótese a UF exige o preenchimento.",
    "C170 IND_MOV: o layout do leitor não o marca obrigatório e o Guia não foi conferido. Classificado OC por precaução.",
    "C170: confirmar quais campos de PIS/COFINS (25 a 36) são de fato exigidos de quem entrega a EFD-Contribuições.",
    "0000 DT_INI/DT_FIN: mapear as exceções ao período mensal fechado (início de atividade, baixa, incorporação, cisão, fusão) antes de qualquer regra de data bloqueante.",

    // ─── tabelas externas ainda não carregadas ───
    "Tabela de CFOP: necessária para FIS-C170-020 (CFOPS_DE_PRODUCAO_PROPRIA vai muito além do 5101) e para conferir o código em si.",
    "Tabela de municípios do IBGE (~5.570 códigos): é domínio FECHADO, não aberto. Hoje só se confere o prefixo de UF.",
    "Tabela 5.1.1 (ajustes da apuração, COD_AJ do E111) e Tabela 5.3 (benefícios fiscais, cBenef) da SEFAZ-MA: ver icms-ipi/tabelas/sefaz-ma/.",
    "Registros ainda fora do dicionário e citados por regras: 0190 (unidades), 0400 (natureza da operação), 0460 (observações), E110/E111 (apuração e ajustes).",
  ],
};
