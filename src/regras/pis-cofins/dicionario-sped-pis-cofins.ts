import type { DicionarioSped } from "../nucleo/tipos";

/**
 * Dicionário da EFD-Contribuições (PIS/COFINS) — ESQUELETO.
 *
 * Existe hoje para fixar a fronteira arquitetural, não para validar: o escopo
 * técnico entregue foi o motor de ICMS/IPI. Deixá-lo declarado e vazio é
 * honesto — um `registros: {}` não valida nada e não mente. Preenchê-lo com
 * palpites seria pior do que não tê-lo, porque a aba passaria a emitir achados
 * com a mesma aparência de autoridade dos achados conferidos.
 *
 * POR QUE É UM ARQUIVO SEPARADO, e não uma seção do dicionário de ICMS/IPI:
 *
 * As duas escriturações são leiautes distintos, publicados sob atos distintos,
 * com versões que avançam em datas distintas. O caso que decide a questão é o
 * C170: ele existe nas duas, com o mesmo nome e conteúdo diferente. Um único
 * dicionário teria de escolher uma das duas definições — e a aba que perdesse a
 * escolha passaria a ler todos os campos na posição errada, sem erro de
 * compilação, apontando divergência falsa em cima de arquivo correto.
 *
 * Ao preencher este arquivo, aproveite o que a plataforma já tem: as tabelas
 * 4.3.x (NCM × CST × alíquota × natureza da receita) já são sincronizadas
 * diariamente pelo robô em `scripts/sync-tabelas.ts` e ficam em
 * `public/data/tabelas-sped.json`. Elas são a fonte de `valoresValidos` e das
 * regras de coerência CST × NCM desta aba — não redigite nada disso à mão.
 */
export const DICIONARIO_SPED_PIS_COFINS: DicionarioSped = {
  id: "EFD-CONTRIBUICOES",
  nome: "EFD-Contribuições (PIS/PASEP e COFINS)",
  versaoLeiaute: "",
  fonte:
    "https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/declaracoes-e-demonstrativos/sped-sistema-publico-de-escrituracao-digital/escrituracao-fiscal-digital-da-contribuicao-efd-contribuicoes",
  registros: {},
  pendenciasDeConferencia: [
    "Dicionário não iniciado: o escopo entregue foi o motor de ICMS/IPI.",
    "Ao iniciar, mapear 0000, 0110, 0140, 0150, 0200, C100, C170, C181/C185, M100/M105, M200, M500/M505 e M600.",
    "Reaproveitar public/data/tabelas-sped.json (tabelas 4.3.x) para valoresValidos de CST e natureza da receita.",
  ],
};
