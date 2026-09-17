import { tributacaoDoCstIcms } from "../../nucleo/acesso";
import type { Apontar, LinhaSped, PodeApontar, RegraSped } from "../../nucleo/contrato";
import {
  CODIGOS_CSOSN,
  ORIGENS_DA_MERCADORIA,
  tributacaoDeclarada,
  type ExigenciaDeCampo,
} from "../tabelas/cst-icms";
import { comoValorSped, numero, proximo, temMovimento, texto } from "./comum";

/**
 * As regras que a Tabela A e a Tabela B do CST impõem aos valores do item.
 *
 * Todas partem do mesmo lugar: `tributacaoDoCstIcms()`. Comparar o CST inteiro
 * contra "40" nunca casa — o valor real é "040" ou "140" — e o pior é que não
 * quebra nada: a regra não dispara, não aparece em teste, e a auditoria segue
 * dizendo que está tudo certo sobre um arquivo com imposto destacado em
 * operação isenta.
 */

const OPERACAO = { ENTRADA: "0", SAIDA: "1" } as const;

/* ─────────────────────── FIS-C170-001 — o CST em si ──────────────────────── */

const CODIGO_CST_INVALIDO = "FIS-C170-001";

/**
 * O CST existe nas duas tabelas que o compõem?
 *
 * Roda antes de todas as outras porque é a que as sustenta: com CST fora da
 * tabela, a matriz de exigências não tem linha para consultar e as regras
 * seguintes ficam CALADAS sobre o item. O contador precisa saber que o item não
 * foi conferido — e não receber silêncio, que ele lê como aprovação.
 */
export const FIS_C170_001: RegraSped = {
  codigo: CODIGO_CST_INVALIDO,
  nome: "Código de situação tributária do ICMS inválido",
  regraDoDicionario: CODIGO_CST_INVALIDO,
  executar(contexto, apontar, podeApontar) {
    for (const documento of contexto.documentos) {
      for (const item of documento.itens) {
        conferirCst(item, "C170", apontar, podeApontar);
      }
      for (const analitico of documento.analiticos) {
        conferirCst(analitico, "C190", apontar, podeApontar);
      }
    }
  },
};

function conferirCst(
  linha: LinhaSped,
  reg: string,
  apontar: Apontar,
  podeApontar: PodeApontar
): void {
  const cst = texto(linha.campos, "CST_ICMS");
  if (cst === "") return; // ausência é problema de campo obrigatório, não de domínio

  const tributacao = tributacaoDoCstIcms(cst);
  const origem = tributacao === null ? null : cst.charAt(0);

  const origemValida = origem !== null && ORIGENS_DA_MERCADORIA.has(origem);
  const tributacaoValida = tributacao !== null && tributacaoDeclarada(tributacao) !== undefined;
  if (origemValida && tributacaoValida) return;

  if (!podeApontar(CODIGO_CST_INVALIDO)) return;

  apontar({
    id: `${CODIGO_CST_INVALIDO}:${linha.nl}:CST_ICMS`,
    codigo: CODIGO_CST_INVALIDO,
    severidade: "erro",
    nl: linha.nl,
    reg,
    campo: "CST_ICMS",
    mensagem: explicarCstInvalido(cst, origemValida, tributacaoValida),
    atual: cst,
    corrigivel: false,
    regra: "Tabelas A e B do art. 5º do Convênio s/nº de 1970",
  });
}

function explicarCstInvalido(cst: string, origemOk: boolean, tributacaoOk: boolean): string {
  const csosn = CODIGOS_CSOSN.get(cst);
  if (csosn) {
    return `O CST '${cst}' é um código da tabela do Simples Nacional (CSOSN: ${csosn}), que não cabe neste campo: aqui são três posições — origem mais dois dígitos de tributação —, e o CSOSN já tem três por si só. Quem copia o código da NF-e para a escrituração muda a operação de lugar na tabela.`;
  }
  if (!/^\d{3}$/.test(cst)) {
    return `O CST '${cst}' não tem a forma exigida: três dígitos, sendo o primeiro a origem da mercadoria e os dois seguintes a tributação. Zeros à esquerda são significativos.`;
  }
  if (!origemOk) {
    return `O primeiro dígito do CST '${cst}' não é uma origem válida. A Tabela A vai de 0 a 8.`;
  }
  if (!tributacaoOk) {
    return `Os dois últimos dígitos do CST '${cst}' não constam da Tabela B de tributação do ICMS.`;
  }
  return `O CST '${cst}' não consta das tabelas de origem e de tributação.`;
}

/* ──────────────── a matriz de exigências de valor (Tabela B) ─────────────── */

const CODIGO_MATRIZ = "FIS-C170-MATRIZ";

/**
 * Confere os quatro campos de valor do item contra a linha da Tabela B.
 *
 * É UMA regra que emite VÁRIOS códigos de achado, e não uma regra por código.
 * A razão é o custo: são meio milhão de itens num arquivo de 100 MB, e cada
 * regra separada refaria a leitura do CST, a conversão dos quatro valores e a
 * consulta à tabela. Um passo só, cinco perguntas — e o teto do motor continua
 * por CÓDIGO DE ACHADO, que é o que a UI agrupa, e não por regra.
 *
 * Os códigos emitidos são os declarados no dicionário: FIS-C170-010 (tributada
 * sem valores), 011 (isenta com imposto), 014 (ST exigida), 015 (ICMS já
 * retido) e 017 (ST vedada).
 */
export const MATRIZ_CST_ICMS: RegraSped = {
  codigo: CODIGO_MATRIZ,
  nome: "Valores do item incompatíveis com a tributação do CST",
  executar(contexto, apontar, podeApontar) {
    for (const documento of contexto.documentos) {
      if (!temMovimento(documento)) continue;
      const entrada = texto(documento.campos, "IND_OPER") === OPERACAO.ENTRADA;

      for (const item of documento.itens) {
        const tributacao = tributacaoDoCstIcms(texto(item.campos, "CST_ICMS"));
        const linhaDaTabela = tributacaoDeclarada(tributacao);
        if (!linhaDaTabela) continue; // CST fora da tabela: FIS-C170-001 já falou

        const baseProprio = numero(item.campos, "VL_BC_ICMS");
        const impostoProprio = numero(item.campos, "VL_ICMS");
        const baseSt = numero(item.campos, "VL_BC_ICMS_ST");
        const impostoSt = numero(item.campos, "VL_ICMS_ST");

        /*
         * Item de valor zero fica fora da exigência de imposto destacado.
         *
         * Brinde, bonificação e amostra grátis são escriturados com VL_ITEM
         * zero e CST de operação tributada. Cobrar base e imposto positivos ali
         * transforma prática corriqueira em achado — e, pior, em achado que o
         * contador não tem como resolver, porque não há o que corrigir.
         */
        const valorDoItem = numero(item.campos, "VL_ITEM") ?? 0;
        const exigirDestaque = valorDoItem > 0;

        conferirPar(
          linhaDaTabela.proprio,
          { base: baseProprio, imposto: impostoProprio },
          { campoBase: "VL_BC_ICMS", campoImposto: "VL_ICMS", campoAliquota: "ALIQ_ICMS" },
          {
            item,
            tributacao: linhaDaTabela.tributacao,
            descricao: linhaDaTabela.descricao,
            aspecto: "o ICMS próprio",
            exigir: exigirDestaque,
          },
          apontar,
          podeApontar
        );

        conferirPar(
          linhaDaTabela.substituicao,
          { base: baseSt, imposto: impostoSt },
          { campoBase: "VL_BC_ICMS_ST", campoImposto: "VL_ICMS_ST", campoAliquota: "ALIQ_ST" },
          {
            item,
            tributacao: linhaDaTabela.tributacao,
            descricao: linhaDaTabela.descricao,
            aspecto: "o ICMS retido por substituição tributária",
            /*
             * Na ENTRADA, quem retém é o remetente: o adquirente escritura o
             * documento sem ser o responsável pela retenção, e exigir dele os
             * campos de ST com CST 10 ou 70 acusaria de erro toda nota de
             * compra de mercadoria substituída.
             */
            exigir: exigirDestaque && !entrada,
          },
          apontar,
          podeApontar
        );
      }
    }
  },
};

interface ValoresDoPar {
  readonly base: number | null;
  readonly imposto: number | null;
}

interface NomesDoPar {
  readonly campoBase: string;
  readonly campoImposto: string;
  /** A alíquota que liga os dois — é ela que torna o par dedutível. */
  readonly campoAliquota: string;
}

interface ContextoDoPar {
  readonly item: LinhaSped;
  readonly tributacao: string;
  readonly descricao: string;
  readonly aspecto: string;
  /** Falso desliga só a exigência de valor positivo; a proibição continua. */
  readonly exigir: boolean;
}

function conferirPar(
  regra: ExigenciaDeCampo,
  valores: ValoresDoPar,
  nomes: NomesDoPar,
  contexto: ContextoDoPar,
  apontar: Apontar,
  podeApontar: PodeApontar
): void {
  if (regra.exigencia === "livre") return;

  const base = valores.base ?? 0;
  const imposto = valores.imposto ?? 0;

  if (regra.exigencia === "obrigatorio") {
    if (!contexto.exigir) return;
    if (base > 0 && imposto > 0) return;
    if (!podeApontar(regra.codigo)) return;

    const campo = base > 0 ? nomes.campoImposto : nomes.campoBase;

    /*
     * O LADO QUE FALTA SAI DO LADO QUE ESTÁ — quando há alíquota.
     *
     * A relação é a que o próprio dicionário declara em FIS-C170-013:
     * `VL_ICMS ≈ VL_BC_ICMS * ALIQ_ICMS / 100`. Com dois dos três termos no
     * arquivo, o terceiro não é palpite, é aritmética — e apontar sem oferecê-lo
     * deixava o contador recalculando à mão o que a regra acabara de conferir.
     *
     * Com os DOIS zerados não há o que deduzir: a alíquota sozinha não diz o
     * valor da operação, e inventar a base a partir do VL_ITEM assumiria que
     * não há frete, desconto nem redução — coisas que o item não conta.
     */
    const aliquota = numero(contexto.item.campos, nomes.campoAliquota) ?? 0;
    let esperado: string | undefined;
    let atual: string | undefined;
    if (aliquota > 0) {
      if (base > 0 && imposto === 0) {
        esperado = comoValorSped((base * aliquota) / 100);
        atual = comoValorSped(imposto);
      } else if (base === 0 && imposto > 0) {
        esperado = comoValorSped((imposto * 100) / aliquota);
        atual = comoValorSped(base);
      }
    }

    apontar({
      id: `${regra.codigo}:${contexto.item.nl}:${campo}`,
      codigo: regra.codigo,
      severidade: regra.severidade,
      nl: contexto.item.nl,
      reg: "C170",
      campo,
      mensagem:
        `A tributação ${contexto.tributacao} (${contexto.descricao}) implica ${contexto.aspecto} destacado, e ${campo} está zerado neste item.` +
        (esperado === undefined
          ? " Os dois campos estão zerados e não há alíquota que ligue um ao outro, então a auditoria não tem valor a propor."
          : ""),
      atual,
      esperado,
      corrigivel: false,
      regra: "Guia Prático EFD ICMS/IPI — Tabela B do Convênio s/nº de 1970",
    });
    return;
  }

  // proibido
  if (base === 0 && imposto === 0) return;
  if (!podeApontar(regra.codigo)) return;

  const campo = imposto !== 0 ? nomes.campoImposto : nomes.campoBase;
  const atual = imposto !== 0 ? imposto : base;
  apontar({
    id: `${regra.codigo}:${contexto.item.nl}:${campo}`,
    codigo: regra.codigo,
    severidade: regra.severidade,
    nl: contexto.item.nl,
    reg: "C170",
    campo,
    mensagem: `A tributação ${contexto.tributacao} (${contexto.descricao}) não comporta ${contexto.aspecto}, e ${campo} veio preenchido. Ou o valor está destacado indevidamente, ou o CST não é o da operação.`,
    atual: comoValorSped(atual),
    esperado: "0,00",
    corrigivel: false,
    regra: "Guia Prático EFD ICMS/IPI — Tabela B do Convênio s/nº de 1970",
  });
}

/* ──────────────────── FIS-C170-012 — base e imposto juntos ───────────────── */

const CODIGO_PAR_INCOMPLETO = "FIS-C170-012";
const TRIBUTACOES_COM_IMPOSTO_PROPRIO = new Set(["00", "10", "20", "70", "90"]);

/**
 * Base sem imposto, ou imposto sem base.
 *
 * Alerta, e não erro: alíquota zero legítima produz base positiva com imposto
 * zero, e a tributação 90 comporta arranjos próprios de cada UF. O que a regra
 * pega de verdade é o cálculo interrompido no meio — o ERP que gravou a base e
 * não gravou o imposto.
 */
export const FIS_C170_012: RegraSped = {
  codigo: CODIGO_PAR_INCOMPLETO,
  nome: "Base de cálculo sem imposto, ou imposto sem base",
  regraDoDicionario: CODIGO_PAR_INCOMPLETO,
  executar(contexto, apontar, podeApontar) {
    for (const documento of contexto.documentos) {
      if (!temMovimento(documento)) continue;

      for (const item of documento.itens) {
        const tributacao = tributacaoDoCstIcms(texto(item.campos, "CST_ICMS"));
        if (tributacao === null || !TRIBUTACOES_COM_IMPOSTO_PROPRIO.has(tributacao)) continue;

        const base = numero(item.campos, "VL_BC_ICMS") ?? 0;
        const imposto = numero(item.campos, "VL_ICMS") ?? 0;
        if (base > 0 === imposto > 0) continue;

        // Base positiva com imposto zero e alíquota zero é coerente: a operação
        // tem base e a alíquota é que a zera. Não é cálculo interrompido.
        const aliquota = numero(item.campos, "ALIQ_ICMS") ?? 0;
        if (base > 0 && imposto === 0 && aliquota === 0) continue;

        if (!podeApontar(CODIGO_PAR_INCOMPLETO)) return;

        apontar({
          id: `${CODIGO_PAR_INCOMPLETO}:${item.nl}:${base > 0 ? "VL_ICMS" : "VL_BC_ICMS"}`,
          codigo: CODIGO_PAR_INCOMPLETO,
          severidade: "alerta",
          nl: item.nl,
          reg: "C170",
          campo: base > 0 ? "VL_ICMS" : "VL_BC_ICMS",
          mensagem:
            base > 0
              ? "O item tem base de cálculo do ICMS e não tem imposto, com alíquota informada. O cálculo parece ter parado no meio."
              : "O item tem ICMS destacado e não tem base de cálculo.",
          corrigivel: false,
          regra: "Guia Prático EFD ICMS/IPI — registro C170",
        });
      }
    }
  },
};

/* ─────────────── FIS-C170-013 — o imposto confere com a conta ────────────── */

const CODIGO_CALCULO = "FIS-C170-013";
const TOLERANCIA_DO_CALCULO = 0.01;

/**
 * VL_ICMS confere com base × alíquota?
 *
 * A redução de base das tributações 20 e 70 já vem refletida na própria
 * VL_BC_ICMS — o campo guarda a base JÁ REDUZIDA —, então a fórmula continua
 * valendo sem tratamento especial. Sem a tolerância de um centavo, o
 * arredondamento faz esta regra disparar em item perfeitamente calculado.
 */
export const FIS_C170_013: RegraSped = {
  codigo: CODIGO_CALCULO,
  nome: "Imposto divergente da base multiplicada pela alíquota",
  regraDoDicionario: CODIGO_CALCULO,
  executar(contexto, apontar, podeApontar) {
    for (const documento of contexto.documentos) {
      if (!temMovimento(documento)) continue;

      for (const item of documento.itens) {
        const base = numero(item.campos, "VL_BC_ICMS") ?? 0;
        const aliquota = numero(item.campos, "ALIQ_ICMS") ?? 0;
        if (base <= 0 || aliquota <= 0) continue;

        const informado = numero(item.campos, "VL_ICMS") ?? 0;
        const calculado = (base * aliquota) / 100;
        if (proximo(informado, calculado, TOLERANCIA_DO_CALCULO)) continue;

        if (!podeApontar(CODIGO_CALCULO)) return;

        apontar({
          id: `${CODIGO_CALCULO}:${item.nl}:VL_ICMS`,
          codigo: CODIGO_CALCULO,
          severidade: "alerta",
          nl: item.nl,
          reg: "C170",
          campo: "VL_ICMS",
          mensagem:
            "O ICMS destacado no item não corresponde à base multiplicada pela alíquota informada.",
          atual: comoValorSped(informado),
          esperado: comoValorSped(calculado),
          corrigivel: false,
          regra: "Guia Prático EFD ICMS/IPI — registro C170",
        });
      }
    }
  },
};
