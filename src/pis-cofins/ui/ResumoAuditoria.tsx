import type { ResumoAuditoria as Resumo } from "@/pis-cofins/auditoria";
import { ListaDeRecortes, type Recorte } from "@/componentes/ListaDeRecortes";

export type FiltroAuditoria = "todos" | "beneficio" | "possivel" | "tributado" | "invalido" | "divergencias" | "coerente";

interface ResumoAuditoriaProps {
  resumo: Resumo;
  filtro: FiltroAuditoria;
  onFiltrar: (filtro: FiltroAuditoria) => void;
  /**
   * Com o critério de correção ligado, "Divergências" e "Coerente" contam a
   * planilha original (o que veio errado x certo no arquivo), e o rótulo
   * muda para dizer isso — senão o contador lê "0 divergências" e conclui
   * que o arquivo estava limpo.
   */
  correcaoAtiva?: boolean;
}

/**
 * Os contadores da auditoria — e o filtro da tabela.
 *
 * Eram sete cartões com o número em 24px, lado a lado no topo: o painel de
 * indicadores que toda tela de sistema tem, e que empurrava a tabela para
 * baixo da dobra. A informação é a mesma, mas em sequência ela conta uma
 * história em ordem: primeiro o que pede conferência — divergência, NCM
 * inválido, benefício possível —, depois como a planilha se distribui no SPED,
 * e por fim o que já está certo. Só o que pede atenção leva cor.
 */
export function ResumoAuditoria({ resumo, filtro, onFiltrar, correcaoAtiva = false }: ResumoAuditoriaProps) {
  const itens: Recorte[] = [
    { valor: "todos", nome: "Todas as linhas", total: resumo.total },
    {
      valor: "divergencias",
      nome: correcaoAtiva ? "Divergências corrigidas" : "Divergências",
      dica: correcaoAtiva
        ? "Linhas que divergiam do SPED na planilha original e que o critério corrigiu"
        : "CST ou natureza da receita diferente do que o SPED indica para o NCM",
      total: resumo.divergencias,
      tom: correcaoAtiva ? undefined : "atencao",
      grupo: "Para conferir",
    },
    {
      valor: "invalido",
      nome: "NCM inválido",
      dica: "NCM sem oito dígitos ou fora da nomenclatura vigente",
      total: resumo.invalido,
      tom: "perigo",
    },
    {
      valor: "possivel",
      nome: "Possível benefício",
      dica: "A regra do SPED sinaliza um benefício, mas não basta para cobrar código: confira a descrição",
      total: resumo.possivel,
      tom: "destaque",
    },
    {
      valor: "beneficio",
      nome: "Alíquota zero / monofásico",
      dica: "NCM com regra de benefício vigente no SPED",
      total: resumo.beneficio,
      grupo: "Classificação no SPED",
    },
    { valor: "tributado", nome: "Tributado", total: resumo.tributado },
    {
      valor: "coerente",
      nome: correcaoAtiva ? "Já coerentes na planilha" : "Coerente com o SPED",
      total: resumo.coerente,
      separado: true,
    },
  ];

  return (
    <ListaDeRecortes
      rotulo="Situação"
      // Em faixa, e não em coluna: a tabela da auditoria tem oito colunas e
      // precisa da largura inteira — ao lado de uma coluna de recortes, as
      // observações, que explicam cada divergência, ficavam fora da tela.
      disposicao="faixa"
      itens={itens}
      valor={filtro}
      onChange={(valor) => onFiltrar(valor as FiltroAuditoria)}
    />
  );
}
