import type { LinhaAuditada } from "./auditoria";
import type { ColunaFiltravel } from "./filtrosColuna";

export type ColunaAuditoria = ColunaFiltravel<LinhaAuditada>;

/**
 * As colunas do resultado da auditoria e como filtrar cada uma. Coluna sem
 * `valores` não ganha menu — o número da linha é único por definição, e o nome
 * do produto e as observações são texto que vem do cliente ou traz o código da
 * própria linha no meio da frase: o menu viraria uma opção por linha. Para
 * esses dois casos a busca e os cartões de resumo servem melhor.
 */
export const COLUNAS_AUDITORIA: ColunaAuditoria[] = [
  { id: "linha", rotulo: "Linha" },
  { id: "produto", rotulo: "Produto", valores: (linha) => [linha.nome ? linha.nome.trim() : "—"] },
  {
    id: "classificacao",
    rotulo: "Classificação",
    valores: (linha) => [linha.ncm || linha.classificacaoOriginal],
  },
  {
    id: "informado",
    rotulo: "Informado",
    // Uma opção por código, com prefixo. A célula junta CST de PIS, CST de
    // COFINS, natureza e CFOP; sem separá-los o menu oferecia uma opção por
    // combinação inteira ("CST 06/06 nat. 133 CFOP 5102"), inútil para achar
    // todas as linhas de um CST. PIS e COFINS entram no mesmo balde porque é
    // assim que o contador procura — e quando divergem, as duas aparecem.
    valores: (linha) => [
      linha.cstPis && `CST ${linha.cstPis}`,
      linha.cstCofins && `CST ${linha.cstCofins}`,
      linha.natureza && `nat. ${linha.natureza}`,
      linha.cfop && `CFOP ${linha.cfop}`,
    ].filter((valor): valor is string => Boolean(valor)),
  },
  { id: "situacao", rotulo: "Situação", valores: (linha) => [linha.rotulo] },
  {
    id: "sugestao",
    rotulo: "Sugestão do SPED",
    valores: (linha) => [linha.regra?.rotulo ?? ""],
  },
  { id: "observacoes", rotulo: "Observações", valores: (linha) => [linha.observacoes.length > 0 ? linha.observacoes.join(" ") : "Coerente com o SPED"] },
];
