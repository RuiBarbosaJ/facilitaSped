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
    valores: (linha) => {
      // Sempre retorna os CSTs brutos/originais da planilha importada,
      // nunca o corrigido — assim o filtro cruza com a Situação atribuída
      // pelo SPED e permite encontrar divergências (ex.: Situação: Tributado
      // + Informado: CST 06 mostra itens que vieram 06 mas o SPED diz tributado).
      return [
        linha.cstPis && `CST ${linha.cstPis}`,
        linha.cstCofins && `CST ${linha.cstCofins}`,
        linha.cfop && `CFOP ${linha.cfop}`,
      ].filter((valor): valor is string => Boolean(valor));
    },
  },
  {
    id: "natureza",
    rotulo: "Nat. receita",
    valores: (linha) => {
      // Inclui tanto a natureza original quanto a corrigida para que o dropdown
      // mostre todos os códigos e filtre em ambas as posições (ex.: 918 aparece
      // tanto se era o valor original quanto se foi sugerido pela correção).
      const original = linha.natureza || "";
      const corrigida = linha.naturezaCorrigida;
      const valores = new Set<string>();
      if (original) valores.add(original);
      if (corrigida !== undefined && corrigida !== "" && corrigida !== original) valores.add(corrigida);
      return valores.size > 0 ? Array.from(valores) : [""];
    },
  },
  { id: "situacao", rotulo: "Situação", valores: (linha) => [linha.rotulo] },
  {
    id: "sugestao",
    rotulo: "Sugestão do SPED",
    valores: (linha) => [linha.regra?.rotulo ?? ""],
  },
  { id: "observacoes", rotulo: "Observações", valores: (linha) => [linha.observacoes.length > 0 ? linha.observacoes.join(" ") : "Coerente com o SPED"] },
];
