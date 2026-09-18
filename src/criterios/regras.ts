import { DICIONARIO_SPED_ICMS_IPI } from "@/regras/icms-ipi/dicionario-sped-icms-ipi";
import { REGRAS_ICMS_IPI } from "@/regras/icms-ipi/validacoes";
import type { RegraValidacaoCustomizada, Severidade } from "@/regras/nucleo/tipos";

/**
 * O que a tela de critérios sabe sobre o ICMS/IPI — LIDO DO DICIONÁRIO.
 *
 * Nada aqui é transcrito à mão. Uma página que explica as regras e é escrita à
 * parte delas começa certa e envelhece calada: a regra muda de severidade, ganha
 * proposta de correção, deixa de existir — e o texto continua afirmando o que
 * era verdade no dia em que foi escrito. Como o contador vai levar isto ao
 * fisco, a página precisa ser DERIVADA da mesma fonte que o motor executa.
 *
 * Roda só no servidor, na montagem da página estática: `src/regras/` não pode
 * entrar em componente `"use client"` — o bundler arrastaria o dicionário
 * inteiro e as tabelas para o pacote do navegador.
 */

/** Como o erro se conserta, na linguagem da tela. */
export type Conserto = "automatica" | "sugerida" | "manual";

export interface RegraExplicada {
  readonly id: string;
  /** Registro do SPED onde a regra age: C100, C170, C190… */
  readonly registro: string;
  readonly nome: string;
  readonly descricao: string;
  readonly severidade: Severidade;
  /** Quando a regra se aplica. Vazio = sempre. */
  readonly condicao?: string;
  /** O que precisa ser verdade quando a condição vale. */
  readonly expressao: string;
  readonly campos: readonly string[];
  readonly conserto: Conserto;
  /** O texto que a norma escreveu sobre o conserto — é o que o contador lê. */
  readonly motivoDoConserto?: string;
  readonly campoCorrigido?: string;
  /** Referência normativa, quando a regra a declara. */
  readonly procedencia: string;
}

/**
 * A mesma régua que `regravacao/propostas.ts` aplica na hora de gerar o TXT.
 *
 * Duplicar a decisão aqui seria a forma mais provável de a página mentir, então
 * ela é uma leitura do MESMO bloco `correcao` que o gerador consulta:
 * automatizável e sem confirmação vira conserto automático; qualquer outro caso
 * com correção declarada nasce como sugestão que espera aprovação; sem bloco de
 * correção, o conserto é na origem.
 */
function consertoDe(regra: RegraValidacaoCustomizada): Conserto {
  const c = regra.correcao;
  if (!c) return "manual";
  if (c.automatizavel && c.exigeConfirmacao === false) return "automatica";
  return "sugerida";
}

/** Só as regras que de fato rodam — as declaradas sem implementação ficam de fora. */
export function regrasImplementadas(): RegraExplicada[] {
  const executadas = new Set(REGRAS_ICMS_IPI.map((r) => r.codigo));
  const saida: RegraExplicada[] = [];

  for (const [registro, definicao] of Object.entries(DICIONARIO_SPED_ICMS_IPI.registros)) {
    // Uma regra pode estar declarada no registro ou pendurada num campo dele.
    const declaradas: RegraValidacaoCustomizada[] = [
      ...(definicao.regrasDoRegistro ?? []),
      ...definicao.campos.flatMap((c) => c.regrasValidacaoCustomizadas ?? []),
    ];

    for (const r of declaradas) {
      if (!r.implementadaEm || !executadas.has(r.implementadaEm)) continue;
      saida.push({
        id: r.id,
        registro,
        nome: r.nome,
        descricao: r.descricao,
        severidade: r.severidade,
        condicao: r.condicao,
        expressao: r.expressao,
        campos: r.camposEnvolvidos,
        conserto: consertoDe(r),
        motivoDoConserto: r.correcao?.motivo,
        campoCorrigido: r.correcao?.campoCorrigido,
        procedencia: r.procedencia,
      });
    }
  }

  return saida.sort((a, b) => a.id.localeCompare(b.id, "pt-BR"));
}

/** Os números que a página cita sobre a cobertura do dicionário. */
export function resumoDoDicionario() {
  const registros = Object.values(DICIONARIO_SPED_ICMS_IPI.registros);
  const declaradas = registros.reduce(
    (total, r) =>
      total +
      (r.regrasDoRegistro?.length ?? 0) +
      r.campos.reduce((n, c) => n + (c.regrasValidacaoCustomizadas?.length ?? 0), 0),
    0
  );

  return {
    versaoLeiaute: DICIONARIO_SPED_ICMS_IPI.versaoLeiaute,
    fonte: DICIONARIO_SPED_ICMS_IPI.fonte,
    registros: registros.map((r) => r.reg),
    campos: registros.reduce((n, r) => n + r.campos.length, 0),
    declaradas,
    implementadas: regrasImplementadas().length,
    /*
     * A lista de pendências é exibida de propósito. Ela é o que separa um
     * dicionário honesto de um que finge certeza — e quem assina a escrituração
     * tem direito de saber o que a ferramenta ainda não conferiu.
     */
    pendencias: DICIONARIO_SPED_ICMS_IPI.pendenciasDeConferencia,
  };
}
