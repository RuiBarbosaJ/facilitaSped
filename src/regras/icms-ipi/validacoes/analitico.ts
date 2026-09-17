import { tributacaoDoCstIcms } from "../../nucleo/acesso";
import type { Apontar, LinhaSped, PodeApontar, RegraSped } from "../../nucleo/contrato";
import { tributacaoDeclarada } from "../tabelas/cst-icms";
import {
  chaveAnalitica,
  comoValorSped,
  descreverChave,
  numero,
  numeroOuZero,
  proximo,
  temMovimento,
  texto,
  toleranciaDeSoma,
} from "./comum";

/**
 * O efeito dominó do bloco C: C170 → C190 → C100.
 *
 * É a regra de ouro do PVA, e a que mais surpreende quem chega ao SPED: a
 * Receita não valida a nota pela soma dos ITENS, e sim pela soma dos registros
 * ANALÍTICOS. O C190 consolida os itens por CST + CFOP + alíquota, e o C100
 * reproduz os totais do C190. Mexer num item sem refazer os dois níveis acima
 * produz um arquivo que fecha em nenhum deles.
 *
 * As três regras deste arquivo percorrem cada documento UMA vez e montam o
 * agrupamento por chave uma vez só. Escritas como cinco regras independentes,
 * cada uma refaria o mesmo `Map` por documento — e são centenas de milhares de
 * documentos num arquivo grande.
 */

interface Acumulador {
  baseProprio: number;
  impostoProprio: number;
  baseSt: number;
  impostoSt: number;
  valorDosItens: number;
  parcelas: number;
  /** A primeira linha do grupo, para o achado ter onde pousar. */
  primeira: LinhaSped;
}

function acumular(mapa: Map<string, Acumulador>, chave: string, linha: LinhaSped): void {
  const atual = mapa.get(chave);
  const alvo: Acumulador = atual ?? {
    baseProprio: 0,
    impostoProprio: 0,
    baseSt: 0,
    impostoSt: 0,
    valorDosItens: 0,
    parcelas: 0,
    primeira: linha,
  };

  alvo.baseProprio += numeroOuZero(linha.campos, "VL_BC_ICMS");
  alvo.impostoProprio += numeroOuZero(linha.campos, "VL_ICMS");
  alvo.baseSt += numeroOuZero(linha.campos, "VL_BC_ICMS_ST");
  alvo.impostoSt += numeroOuZero(linha.campos, "VL_ICMS_ST");
  alvo.valorDosItens += numeroOuZero(linha.campos, "VL_ITEM");
  alvo.parcelas += 1;

  if (!atual) mapa.set(chave, alvo);
}

/* ────────── FIS-C170-022 e 023 — os itens contra a consolidação ─────────── */

const CODIGO_SEM_GRUPO = "FIS-C170-022";
const CODIGO_SOMA = "FIS-C170-023";

/** Os quatro campos que o C190 soma dos itens, na ordem em que são conferidos. */
const CAMPOS_SOMADOS = [
  { campo: "VL_BC_ICMS", rotulo: "a base de cálculo do ICMS", de: "baseProprio" },
  { campo: "VL_ICMS", rotulo: "o ICMS", de: "impostoProprio" },
  { campo: "VL_BC_ICMS_ST", rotulo: "a base de cálculo do ICMS-ST", de: "baseSt" },
  { campo: "VL_ICMS_ST", rotulo: "o ICMS-ST", de: "impostoSt" },
] as const;

/**
 * Cada item cai num grupo do analítico, e cada grupo fecha com seus itens.
 *
 * O VL_OPR do C190 fica FORA da conferência de propósito: ele inclui frete,
 * seguro, despesas acessórias, IPI e ST rateados pelo grupo, e nenhum desses
 * rateios está no C170. Confrontá-lo contra a soma pura de VL_ITEM acusaria
 * divergência em todo documento com frete — que é a maioria deles. O critério
 * de rateio é pendência declarada do dicionário; enquanto for, este campo não
 * entra.
 */
export const FIS_C170_ANALITICO: RegraSped = {
  codigo: "FIS-C170-ANALITICO",
  nome: "Itens do documento contra o registro analítico",
  executar(contexto, apontar, podeApontar) {
    for (const documento of contexto.documentos) {
      if (!temMovimento(documento)) continue;
      if (documento.itens.length === 0 || documento.analiticos.length === 0) continue;

      const dosItens = new Map<string, Acumulador>();
      for (const item of documento.itens) {
        if (texto(item.campos, "CST_ICMS") === "" || texto(item.campos, "CFOP") === "") continue;
        acumular(dosItens, chaveAnalitica(item.campos), item);
      }

      const doAnalitico = new Map<string, Acumulador>();
      for (const analitico of documento.analiticos) {
        acumular(doAnalitico, chaveAnalitica(analitico.campos), analitico);
      }

      for (const [chave, itens] of dosItens) {
        const grupo = doAnalitico.get(chave);

        if (!grupo) {
          if (!podeApontar(CODIGO_SEM_GRUPO)) return;
          apontar({
            id: `${CODIGO_SEM_GRUPO}:${itens.primeira.nl}:CST_ICMS`,
            codigo: CODIGO_SEM_GRUPO,
            severidade: "alerta",
            nl: itens.primeira.nl,
            reg: "C170",
            campo: "CST_ICMS",
            mensagem: `Nenhum registro analítico do documento consolida a combinação ${descreverChave(itens.primeira.campos)}. O C190 é o que a Receita soma para validar a nota: item sem grupo fica fora da conferência dela.`,
            corrigivel: false,
            regra: "Guia Prático EFD ICMS/IPI — registro C190",
          });
          continue;
        }

        const tolerancia = toleranciaDeSoma(itens.parcelas);
        for (const alvo of CAMPOS_SOMADOS) {
          const somado = itens[alvo.de];
          const consolidado = grupo[alvo.de];
          if (proximo(somado, consolidado, tolerancia)) continue;
          if (!podeApontar(CODIGO_SOMA)) return;

          apontar({
            id: `${CODIGO_SOMA}:${grupo.primeira.nl}:${alvo.campo}`,
            codigo: CODIGO_SOMA,
            severidade: "alerta",
            nl: grupo.primeira.nl,
            reg: "C190",
            campo: alvo.campo,
            mensagem: `No grupo ${descreverChave(grupo.primeira.campos)}, ${alvo.rotulo} consolidado não é a soma dos ${itens.parcelas} itens correspondentes. O PVA valida a nota pelo analítico, e não pelos itens.`,
            atual: comoValorSped(consolidado),
            esperado: comoValorSped(somado),
            corrigivel: false,
            regra: "Guia Prático EFD ICMS/IPI — registro C190, campos 06 a 09",
          });
        }
      }
    }
  },
};

/* ───────────── FIS-C190-010 a 014 — o analítico contra si mesmo ──────────── */

const CODIGO_SEM_ALIQUOTA = "FIS-C190-010";
const CODIGO_CALCULO_GRUPO = "FIS-C190-011";
const CODIGO_GRUPO_ISENTO = "FIS-C190-012";
const CODIGO_SEM_REDUCAO = "FIS-C190-013";
const CODIGO_GRUPO_DUPLICADO = "FIS-C190-014";
const TOLERANCIA_DO_CALCULO = 0.01;

export const FIS_C190_COERENCIA: RegraSped = {
  codigo: "FIS-C190-COERENCIA",
  nome: "Coerência interna do registro analítico",
  executar(contexto, apontar, podeApontar) {
    for (const documento of contexto.documentos) {
      if (!temMovimento(documento)) continue;

      const vistas = new Map<string, LinhaSped>();

      for (const analitico of documento.analiticos) {
        const base = numero(analitico.campos, "VL_BC_ICMS") ?? 0;
        const imposto = numero(analitico.campos, "VL_ICMS") ?? 0;
        const aliquota = numero(analitico.campos, "ALIQ_ICMS") ?? 0;
        const tributacao = tributacaoDoCstIcms(texto(analitico.campos, "CST_ICMS"));
        const linhaDaTabela = tributacaoDeclarada(tributacao);

        /*
         * A alíquota ausente só é achado em grupo que DEVERIA ter imposto.
         *
         * Num grupo isento com imposto consolidado a alíquota também falta — e
         * apontar as duas coisas daria dois achados para uma causa só, com o
         * segundo ("falta a alíquota") mandando o contador na direção errada.
         * Ali o que vale é FIS-C190-012, logo abaixo: o problema é o imposto,
         * não a alíquota.
         */
        const proibeImpostoProprio = linhaDaTabela?.proprio.exigencia === "proibido";

        if (imposto > 0 && aliquota <= 0 && !proibeImpostoProprio && podeApontar(CODIGO_SEM_ALIQUOTA)) {
          apontar({
            id: `${CODIGO_SEM_ALIQUOTA}:${analitico.nl}:ALIQ_ICMS`,
            codigo: CODIGO_SEM_ALIQUOTA,
            severidade: "erro",
            nl: analitico.nl,
            reg: "C190",
            campo: "ALIQ_ICMS",
            mensagem:
              "O grupo tem ICMS consolidado e não tem alíquota. A alíquota é parte da chave de agrupamento do C190: sem ela, o grupo não corresponde a item nenhum.",
            corrigivel: false,
            regra: "Guia Prático EFD ICMS/IPI — registro C190, campo 04",
          });
        }

        if (base > 0 && aliquota > 0) {
          const calculado = (base * aliquota) / 100;
          if (
            !proximo(imposto, calculado, TOLERANCIA_DO_CALCULO) &&
            podeApontar(CODIGO_CALCULO_GRUPO)
          ) {
            apontar({
              id: `${CODIGO_CALCULO_GRUPO}:${analitico.nl}:VL_ICMS`,
              codigo: CODIGO_CALCULO_GRUPO,
              severidade: "alerta",
              nl: analitico.nl,
              reg: "C190",
              campo: "VL_ICMS",
              mensagem:
                "O ICMS consolidado do grupo não corresponde à base multiplicada pela alíquota.",
              atual: comoValorSped(imposto),
              esperado: comoValorSped(calculado),
              corrigivel: false,
              regra: "Guia Prático EFD ICMS/IPI — registro C190",
            });
          }
        }

        if (
          proibeImpostoProprio &&
          linhaDaTabela &&
          linhaDaTabela.proprio.severidade === "erro" &&
          imposto !== 0 &&
          podeApontar(CODIGO_GRUPO_ISENTO)
        ) {
          apontar({
            id: `${CODIGO_GRUPO_ISENTO}:${analitico.nl}:VL_ICMS`,
            codigo: CODIGO_GRUPO_ISENTO,
            severidade: "erro",
            nl: analitico.nl,
            reg: "C190",
            campo: "VL_ICMS",
            mensagem: `O grupo consolida operações de tributação ${linhaDaTabela.tributacao} (${linhaDaTabela.descricao}), que não comporta ICMS próprio, e traz imposto consolidado.`,
            atual: comoValorSped(imposto),
            esperado: "0,00",
            corrigivel: false,
            regra: "Guia Prático EFD ICMS/IPI — Tabela B do Convênio s/nº de 1970",
          });
        }

        if (linhaDaTabela?.reduzBase && podeApontar(CODIGO_SEM_REDUCAO)) {
          const reducao = numero(analitico.campos, "VL_RED_BC") ?? 0;
          if (reducao <= 0) {
            apontar({
              id: `${CODIGO_SEM_REDUCAO}:${analitico.nl}:VL_RED_BC`,
              codigo: CODIGO_SEM_REDUCAO,
              severidade: "alerta",
              nl: analitico.nl,
              reg: "C190",
              campo: "VL_RED_BC",
              mensagem: `A tributação ${linhaDaTabela.tributacao} é de operação com redução da base de cálculo, e o grupo não registra quanto foi reduzido.`,
              corrigivel: false,
              regra: "Guia Prático EFD ICMS/IPI — registro C190, campo 10",
            });
          }
        }

        /*
         * A duplicidade só é apontada quando o COD_OBS também coincide.
         *
         * Não está conferido se o COD_OBS integra a chave de agrupamento do
         * C190 — é pendência declarada. Se integrar, duas combinações iguais
         * com observações distintas são legítimas e viram duas linhas. Exigir
         * o mesmo COD_OBS deixa a regra correta nas duas hipóteses.
         */
        const chaveComObs = `${chaveAnalitica(analitico.campos)}|${texto(analitico.campos, "COD_OBS")}`;
        const anterior = vistas.get(chaveComObs);
        if (!anterior) {
          vistas.set(chaveComObs, analitico);
        } else if (podeApontar(CODIGO_GRUPO_DUPLICADO)) {
          apontar({
            id: `${CODIGO_GRUPO_DUPLICADO}:${analitico.nl}:CST_ICMS`,
            codigo: CODIGO_GRUPO_DUPLICADO,
            severidade: "alerta",
            nl: analitico.nl,
            reg: "C190",
            campo: "CST_ICMS",
            mensagem: `O documento traz dois registros analíticos com a mesma combinação ${descreverChave(analitico.campos)} e a mesma observação — o primeiro na linha ${anterior.nl}. O C190 consolida: deveriam ser um só.`,
            corrigivel: false,
            regra: "Guia Prático EFD ICMS/IPI — registro C190",
          });
        }
      }
    }
  },
};

/* ────────────── FIS-C100-011, 012 e 018 — a nota contra o resto ──────────── */

const CODIGO_MERCADORIAS = "FIS-C100-011";
const CODIGO_TOTAIS = "FIS-C100-012";
const CODIGO_SEM_ANALITICO = "FIS-C100-018";

/** Os campos do C100 que reproduzem a soma dos C190 do documento. */
const TOTAIS_DA_NOTA = [
  { campo: "VL_BC_ICMS", rotulo: "a base de cálculo do ICMS" },
  { campo: "VL_ICMS", rotulo: "o ICMS" },
  { campo: "VL_BC_ICMS_ST", rotulo: "a base de cálculo do ICMS-ST" },
  { campo: "VL_ICMS_ST", rotulo: "o ICMS-ST" },
  { campo: "VL_IPI", rotulo: "o IPI" },
] as const;

export const FIS_C100_TOTAIS: RegraSped = {
  codigo: "FIS-C100-TOTAIS",
  nome: "Totais do documento contra itens e analítico",
  executar(contexto, apontar, podeApontar) {
    for (const documento of contexto.documentos) {
      if (!temMovimento(documento)) continue;

      if (documento.analiticos.length === 0) {
        if (!podeApontar(CODIGO_SEM_ANALITICO)) return;
        apontar({
          id: `${CODIGO_SEM_ANALITICO}:${documento.nl}:COD_SIT`,
          codigo: CODIGO_SEM_ANALITICO,
          severidade: "alerta",
          nl: documento.nl,
          reg: "C100",
          campo: "COD_SIT",
          mensagem:
            "Documento com movimento e sem nenhum registro analítico C190. É pelo analítico que a Receita valida os totais da nota.",
          corrigivel: false,
          regra: "Guia Prático EFD ICMS/IPI — registro C190",
        });
        continue;
      }

      conferirTotaisDoAnalitico(documento.campos, documento.nl, documento.analiticos, apontar, podeApontar);

      if (documento.itens.length > 0) {
        let soma = 0;
        for (const item of documento.itens) soma += numeroOuZero(item.campos, "VL_ITEM");

        const informado = numero(documento.campos, "VL_MERC") ?? 0;
        const tolerancia = toleranciaDeSoma(documento.itens.length);
        if (!proximo(informado, soma, tolerancia) && podeApontar(CODIGO_MERCADORIAS)) {
          apontar({
            id: `${CODIGO_MERCADORIAS}:${documento.nl}:VL_MERC`,
            codigo: CODIGO_MERCADORIAS,
            severidade: "alerta",
            nl: documento.nl,
            reg: "C100",
            campo: "VL_MERC",
            mensagem: `O valor das mercadorias do documento não é a soma dos ${documento.itens.length} itens escriturados. Diferentemente do VL_DOC, o VL_MERC não inclui frete, seguro, despesas nem impostos.`,
            atual: comoValorSped(informado),
            esperado: comoValorSped(soma),
            corrigivel: false,
            regra: "Guia Prático EFD ICMS/IPI — registro C100, campo 16",
          });
        }
      }
    }
  },
};

function conferirTotaisDoAnalitico(
  campos: readonly string[],
  nl: number,
  analiticos: readonly LinhaSped[],
  apontar: Apontar,
  podeApontar: PodeApontar
): void {
  const tolerancia = toleranciaDeSoma(analiticos.length);

  for (const alvo of TOTAIS_DA_NOTA) {
    let soma = 0;
    for (const analitico of analiticos) soma += numeroOuZero(analitico.campos, alvo.campo);

    const informado = numero(campos, alvo.campo);
    if (informado === null) continue; // conteúdo não numérico é achado de tipo
    if (proximo(informado, soma, tolerancia)) continue;
    if (!podeApontar(CODIGO_TOTAIS)) return;

    apontar({
      id: `${CODIGO_TOTAIS}:${nl}:${alvo.campo}`,
      codigo: CODIGO_TOTAIS,
      severidade: "alerta",
      nl,
      reg: "C100",
      campo: alvo.campo,
      mensagem: `No total do documento, ${alvo.rotulo} não reproduz a soma dos ${analiticos.length} registros analíticos. A Receita valida a nota pela soma dos C190.`,
      atual: comoValorSped(informado),
      esperado: comoValorSped(soma),
      corrigivel: false,
      regra: "Guia Prático EFD ICMS/IPI — registro C100, campos 21 a 25",
    });
  }
}
