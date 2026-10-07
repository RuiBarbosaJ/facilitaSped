"use client";

import { ListaDeRecortes } from "@/componentes/ListaDeRecortes";
import { TODOS_CST, type OpcaoCst } from "@/consulta/ui/useFiltroCst";

/**
 * O nome que cabe numa lista.
 *
 * O nome oficial de cada CST é uma frase ("Operação Tributável com Alíquota por
 * Unidade de Medida de Produto") e, num seletor, cortava no meio — o antigo
 * mostrava "06 — Operação Tributável a Alíqu". Aqui fica o regime, que é como
 * o contador chama a tabela; o nome oficial continua na dica de cada item. CST
 * que a Receita publicar depois aparece com o nome oficial.
 */
const NOME_CURTO: Record<string, string> = {
  "02": "Alíquota diferenciada",
  "03": "Alíquota por unidade",
  "04": "Monofásica, revenda",
  "05": "Substituição tributária",
  "06": "Alíquota zero",
  "07": "Isenção",
  "08": "Sem incidência",
  "09": "Suspensão",
};

/** O nome oficial, sem o código na frente: "Operação Tributável a Alíquota Zero". */
export function nomeOficialDoCst(opcao: OpcaoCst): string {
  return opcao.rotulo.replace(/^\d+\s+—\s+/, "");
}

/**
 * O nome curto do CST. Funciona antes de os dados chegarem — o título da tela
 * já nasce certo, em vez de mostrar "CST 06" e trocar de texto um segundo
 * depois.
 */
export function nomeDoCst(cst: string, opcao?: OpcaoCst): string {
  return NOME_CURTO[cst] ?? (opcao ? nomeOficialDoCst(opcao) : `CST ${cst}`);
}

interface SeletorCstProps {
  valor: string;
  opcoes: OpcaoCst[];
  /** Quantas regras a busca atual encontra em cada CST. */
  contagem: Map<string, number>;
  /** Quantas encontra em todas as tabelas. */
  total: number;
  onChange: (cst: string) => void;
}

/**
 * Escolhe qual CST a tabela mostra — e diz quantas regras a busca acha em
 * cada um.
 *
 * O seletor antigo era uma lista suspensa que escondia as outras opções e
 * filtrava a busca calado: com alíquota zero escolhida, "cerveja" dava tabela
 * vazia, sem pista de que havia regras dela em outro CST. Com todas as opções
 * à vista e a contagem ao lado, a busca mostra de uma vez onde o produto
 * aparece.
 */
export function SeletorCst({ valor, opcoes, contagem, total, onChange }: SeletorCstProps) {
  return (
    <ListaDeRecortes
      rotulo="CST"
      unidade={["regra", "regras"]}
      valor={valor}
      onChange={onChange}
      itens={[
        ...opcoes.map((opcao) => ({
          valor: opcao.cst,
          codigo: opcao.cst,
          nome: nomeDoCst(opcao.cst, opcao),
          dica: `CST ${opcao.cst} — ${nomeOficialDoCst(opcao)}`,
          total: contagem.get(opcao.cst) ?? 0,
        })),
        {
          valor: TODOS_CST,
          nome: "Todas as tabelas",
          dica: "Todos os CSTs, inclusive as tabelas que não definem CST",
          total,
          separado: true,
        },
      ]}
    />
  );
}
