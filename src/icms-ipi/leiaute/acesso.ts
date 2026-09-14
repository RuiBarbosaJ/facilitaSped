import { LAYOUT } from "./registros";
import type { DefRegistro } from "./tipos";

/**
 * Acesso ao dicionário de layout a partir de uma chave vinda do arquivo.
 *
 * O código do registro é conteúdo do usuário: uma linha `|constructor|…` ou
 * `|__proto__|…` é perfeitamente possível num arquivo corrompido — ou
 * malicioso. Indexar o objeto literal com essas chaves devolve algo herdado do
 * protótipo de Object: um valor *truthy* que não tem `campos`, e a primeira
 * leitura de `.campos` derruba o parse, o handler de janela do worker e a
 * árvore de render da grade. Um `Map` não consulta o protótipo — é a regra da
 * seção 13.3 do plano ("use Map, nunca objeto literal").
 */
const POR_REGISTRO: ReadonlyMap<string, DefRegistro> = new Map<string, DefRegistro>(
  Object.entries(LAYOUT)
);

/** A definição do registro, ou `undefined` se ele não está no dicionário. */
export function definicaoDoRegistro(reg: string): DefRegistro | undefined {
  return POR_REGISTRO.get(reg);
}

/**
 * Coluna sintética com o código do registro. Não se chama `REG_BLC` porque
 * esse é o nome de um campo real do registro 9900 — a colisão tornava aquele
 * campo inalcançável na grade.
 */
export const COLUNA_REGISTRO = "REGISTRO";

/** Memoriza `registro|coluna → índice`, inclusive as ausências (`null`). */
const indicePorColuna = new Map<string, number | null>();

/** Índice do campo dentro da linha, ou `null` se o registro não tem a coluna. */
export function indiceDoCampo(reg: string, coluna: string): number | null {
  const chave = `${reg}|${coluna}`;
  const memorizado = indicePorColuna.get(chave);
  if (memorizado !== undefined) return memorizado;

  const campo = definicaoDoRegistro(reg)?.campos.find((c) => c.nome === coluna);
  const indice = campo ? campo.indice : null;
  indicePorColuna.set(chave, indice);
  return indice;
}

/**
 * Valor da coluna nesta linha, já sem espaço nas pontas.
 *
 * Devolve `null` — e não string vazia — quando o registro da linha simplesmente
 * não possui a coluna. Quem filtra precisa distinguir "esta linha não tem essa
 * coluna" de "esta linha tem a coluna e ela está vazia".
 */
export function valorDaColuna(campos: readonly string[], coluna: string): string | null {
  const reg = campos[1] ?? "";
  if (coluna === COLUNA_REGISTRO) return reg.trim();

  const indice = indiceDoCampo(reg, coluna);
  if (indice === null) return null;
  return (campos[indice] ?? "").trim();
}

/** Nomes de campo válidos para um registro, extraídos do próprio dicionário. */
export type NomeDeCampo<R extends keyof typeof LAYOUT> =
  (typeof LAYOUT)[R]["campos"][number]["nome"];

/**
 * Campo pelo nome, conferido em tempo de compilação.
 *
 * As regras de auditoria liam índices crus (`item.campos[11]` para o CFOP).
 * Bastava o layout ganhar um campo numa versão nova para todas elas passarem a
 * ler o campo vizinho — sem erro de compilação, sem teste quebrando, apontando
 * divergência falsa em massa num arquivo perfeitamente válido. Aqui, um nome
 * que não existe no registro não compila.
 */
export function campoDe<R extends keyof typeof LAYOUT>(
  reg: R,
  campos: readonly string[],
  nome: NomeDeCampo<R>
): string {
  const indice = indiceDoCampo(reg, nome);
  return indice === null ? "" : (campos[indice] ?? "");
}
