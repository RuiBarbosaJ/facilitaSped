import type { CampoSped, DicionarioSped, RegistroSped } from "./tipos";

/**
 * Acesso ao dicionário a partir de chaves vindas do arquivo do usuário.
 *
 * Todo lookup aqui passa por `Map`, nunca por indexação de objeto literal. O
 * código do registro é conteúdo do usuário: uma linha `|constructor|…` ou
 * `|__proto__|…` aparece em arquivo corrompido — ou malicioso — e indexar o
 * literal com essas chaves devolve algo herdado do protótipo de `Object`: um
 * valor *truthy* sem `campos`, cuja primeira leitura derruba o parse inteiro
 * dentro do worker. `Map` não consulta o protótipo.
 *
 * Os índices são construídos uma vez por dicionário e memorizados. Num arquivo
 * de 100 MB o C170 sozinho passa de meio milhão de linhas: resolver
 * `registro|campo → posição` por varredura de array a cada leitura é a
 * diferença entre o parse levar segundos e levar minutos.
 */

interface IndiceDoDicionario {
  readonly porRegistro: ReadonlyMap<string, RegistroSped>;
  /** `REG|NOME_DO_CAMPO` → posição no array da linha. */
  readonly posicaoPorCampo: Map<string, number | null>;
  /** `REG` → campos indexados por nome, para varreduras por registro. */
  readonly camposPorRegistro: ReadonlyMap<string, ReadonlyMap<string, CampoSped>>;
}

const indices = new WeakMap<DicionarioSped, IndiceDoDicionario>();

function indiceDe(dicionario: DicionarioSped): IndiceDoDicionario {
  const memorizado = indices.get(dicionario);
  if (memorizado) return memorizado;

  const porRegistro = new Map<string, RegistroSped>(Object.entries(dicionario.registros));
  const camposPorRegistro = new Map<string, ReadonlyMap<string, CampoSped>>();

  for (const [reg, definicao] of porRegistro) {
    camposPorRegistro.set(reg, new Map(definicao.campos.map((c) => [c.nome, c])));
  }

  const construido: IndiceDoDicionario = {
    porRegistro,
    posicaoPorCampo: new Map(),
    camposPorRegistro,
  };
  indices.set(dicionario, construido);
  return construido;
}

/** A definição do registro, ou `undefined` se ele não está no dicionário. */
export function registroDe(dicionario: DicionarioSped, reg: string): RegistroSped | undefined {
  return indiceDe(dicionario).porRegistro.get(reg);
}

/** A definição do campo, ou `undefined` se o registro não possui a coluna. */
export function campoDe(
  dicionario: DicionarioSped,
  reg: string,
  nome: string
): CampoSped | undefined {
  return indiceDe(dicionario).camposPorRegistro.get(reg)?.get(nome);
}

/**
 * Posição do campo na linha, ou `null` quando o registro não tem a coluna.
 *
 * Memoriza inclusive as ausências. Sem isso, uma regra que pergunta por um
 * campo inexistente — o que é normal: a mesma regra roda sobre C170 e C190 —
 * refaz a busca a cada linha do arquivo.
 */
export function posicaoDe(dicionario: DicionarioSped, reg: string, nome: string): number | null {
  const indice = indiceDe(dicionario);
  const chave = `${reg}|${nome}`;

  const memorizado = indice.posicaoPorCampo.get(chave);
  if (memorizado !== undefined) return memorizado;

  const posicao = indice.camposPorRegistro.get(reg)?.get(nome)?.posicao ?? null;
  indice.posicaoPorCampo.set(chave, posicao);
  return posicao;
}

/**
 * Valor bruto do campo nesta linha, já sem espaço nas pontas.
 *
 * Devolve `null` — e não string vazia — quando o registro não possui a coluna.
 * Quem valida precisa distinguir "este registro não tem esse campo" de "tem e
 * está vazio": só o segundo caso pode gerar achado de campo obrigatório.
 */
export function valorDe(
  dicionario: DicionarioSped,
  campos: readonly string[],
  nome: string
): string | null {
  const reg = campos[1] ?? "";
  const posicao = posicaoDe(dicionario, reg, nome);
  if (posicao === null) return null;
  return (campos[posicao] ?? "").trim();
}

/**
 * Converte um campo `N` de valor para número.
 *
 * O SPED grava decimal com VÍRGULA (`1234,56`) e omite o campo quando é zero.
 * Passar essa string direto para `Number` devolve `NaN`, e `NaN` em comparação
 * é sempre falso: a regra de totalizador simplesmente não dispararia, e a
 * auditoria diria "nenhum problema" sobre uma nota que não fecha.
 *
 * Campo vazio vira `0`, que é a leitura correta do leiaute — não `NaN`, não
 * `null`. Texto que não é número devolve `null`, e aí sim é achado de tipo.
 */
export function numeroDe(bruto: string | null | undefined): number | null {
  if (bruto === null || bruto === undefined) return null;

  const limpo = bruto.trim();
  if (limpo === "") return 0;

  // Só dígitos, vírgula decimal e sinal. O SPED não usa separador de milhar,
  // e aceitar ponto aqui faria "1.234" (mil duzentos e trinta e quatro, num
  // arquivo fora do padrão) ser lido como 1,234.
  if (!/^-?\d+(,\d+)?$/.test(limpo)) return null;

  const convertido = Number(limpo.replace(",", "."));
  return Number.isFinite(convertido) ? convertido : null;
}

/**
 * Converte um campo `N` distinguindo OMITIDO de ZERO.
 *
 * `numeroDe` devolve `0` para campo vazio, que é a leitura certa num campo de
 * valor — uma nota sem IPI traz o campo vazio e o imposto é mesmo zero. Mas há
 * campos condicionais em que vazio e zero são fatos DIFERENTES: a `ALIQ_ICMS`
 * do 0200 vazia significa "o cadastro não informou a alíquota", e não "a
 * alíquota é 0%". Uma regra que use `numeroDe` ali conclui alíquota zero e ou
 * cala sobre um cadastro incompleto, ou acusa de isenção um item tributado.
 *
 * Devolve `undefined` para campo ausente no registro, `null` para campo
 * presente e vazio, e o número quando há valor.
 */
export function numeroOuNulo(bruto: string | null | undefined): number | null | undefined {
  if (bruto === null || bruto === undefined) return undefined;
  if (bruto.trim() === "") return null;
  return numeroDe(bruto);
}

/**
 * Os dois últimos dígitos do CST do ICMS — a tributação (Tabela B).
 *
 * O CST do ICMS é `N(3)`: origem (1 dígito) + tributação (2 dígitos). Quase
 * toda regra fiscal fala da tributação ("CST 40 é isento"), e a armadilha é
 * comparar contra o campo inteiro: `["40","41"].includes(cst)` NUNCA casa,
 * porque o valor real é `"040"` ou `"140"`. A regra não dispara, não quebra e
 * não aparece em teste nenhum — ela simplesmente deixa de existir, e a
 * auditoria segue dizendo que está tudo certo.
 *
 * Devolve `null` quando o valor não tem a forma de um CST de ICMS.
 */
export function tributacaoDoCstIcms(cst: string | null | undefined): string | null {
  if (!cst) return null;
  const limpo = cst.trim();
  if (!/^\d{3}$/.test(limpo)) return null;
  return limpo.slice(1);
}

/**
 * Normaliza um código de domínio fechado antes de compará-lo.
 *
 * Os códigos do SPED são `N` com zero à esquerda significativo (`TIPO_ITEM`
 * `"00"`, `COD_SIT` `"02"`), mas há gerador que trata o campo como número e
 * grava `|0|`. Comparar cru rejeita o arquivo por um zero de formatação —
 * divergência de forma, não de conteúdo, e que não justifica reprovar
 * escrituração. Normalize para comparar, e aponte a formatação como alerta
 * separado, se for o caso.
 */
export function codigoNormalizado(bruto: string | null | undefined, tamanho: number): string {
  return (bruto ?? "").trim().padStart(tamanho, "0");
}

/** Todos os registros do dicionário, para varreduras e relatórios. */
export function todosOsRegistros(dicionario: DicionarioSped): readonly RegistroSped[] {
  return Object.values(dicionario.registros);
}
