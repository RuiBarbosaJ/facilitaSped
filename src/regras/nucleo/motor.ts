import type { Achado, Apontar, ContextoValidacao, RegraSped } from "./contrato";
import type { DicionarioSped } from "./tipos";

/**
 * Executor de regras, agnóstico de aba.
 *
 * O motor não sabe o que é ICMS nem o que é PIS: recebe um dicionário e uma
 * lista de regras e executa. É isso que permite as duas abas compartilharem
 * infraestrutura sem compartilhar norma — cada uma monta seu `MotorSped` com
 * seu dicionário e suas regras, e uma não enxerga a outra.
 */

export interface OpcoesDoMotor {
  /**
   * Teto de achados por código de regra.
   *
   * Sem teto, uma regra que dispara em todo item de um arquivo de 100 MB gera
   * centenas de milhares de objetos, clonados para a main thread e convertidos
   * em nós de DOM: a aba morre antes de mostrar o primeiro achado. Passado o
   * teto, só o contador sobrevive e a UI mostra "e mais N ocorrências".
   */
  readonly tetoPorCodigo: number;
  /**
   * Teto global, somando todos os códigos.
   *
   * O teto por código sozinho não basta: com quarenta regras a 500 achados
   * cada, o limite real vira 20.000 objetos num único `postMessage` — vários
   * megabytes de structured clone, seguidos de uma lista que a UI tenta
   * renderizar inteira.
   */
  readonly tetoGlobal: number;
  /**
   * Consultado entre um lote de trabalho e outro. Devolver `true` interrompe.
   *
   * Existe porque o cancelamento neste projeto é cooperativo: enquanto uma
   * função síncrona roda, `self.onmessage` não é chamado no worker e a
   * mensagem CANCELAR fica parada na fila. Sem um ponto de parada aqui dentro,
   * o botão Cancelar é decorativo durante toda a execução do motor — que é
   * justamente a fase mais longa num arquivo grande.
   */
  readonly cancelado?: () => boolean;
}

export const OPCOES_PADRAO: OpcoesDoMotor = {
  // Mesmo teto já praticado pelo leitor (src/icms-ipi/limites.ts). Mudar estes
  // números é decisão de produto — quanto o navegador do contador aguenta.
  tetoPorCodigo: 500,
  tetoGlobal: 5_000,
};

export interface ResultadoDoMotor {
  readonly achados: readonly Achado[];
  /** Achados descartados pelo teto, por código. */
  readonly omitidosPorCodigo: ReadonlyMap<string, number>;
  /**
   * Regras que lançaram exceção e NÃO foram aplicadas.
   *
   * Devolvido, e não engolido num `console.error`, porque uma regra que não
   * rodou é uma auditoria incompleta. A tela dizer "nenhum problema" enquanto
   * uma regra inteira falhou faz o contador assinar a escrituração confiando
   * numa conferência que não aconteceu.
   */
  readonly regrasQueFalharam: readonly string[];
  /** O motor parou antes do fim por cancelamento do usuário. */
  readonly cancelado: boolean;
}

export class MotorSped {
  private readonly regrasPorCodigo: ReadonlyMap<string, RegraSped>;

  constructor(
    readonly dicionario: DicionarioSped,
    regras: readonly RegraSped[],
    private readonly opcoes: OpcoesDoMotor = OPCOES_PADRAO
  ) {
    const indice = new Map<string, RegraSped>();
    for (const regra of regras) {
      if (indice.has(regra.codigo)) {
        // Dois códigos iguais fazem o teto de uma regra consumir o da outra e
        // tornam o achado impossível de rastrear até sua origem.
        throw new Error(`Código de regra duplicado no motor: ${regra.codigo}`);
      }
      indice.set(regra.codigo, regra);
    }
    this.regrasPorCodigo = indice;
  }

  /** As regras registradas, na ordem em que serão executadas. */
  get regras(): readonly RegraSped[] {
    return [...this.regrasPorCodigo.values()];
  }

  executar(contexto: ContextoValidacao): ResultadoDoMotor {
    const achados: Achado[] = [];
    const emitidos = new Map<string, number>();
    const omitidos = new Map<string, number>();
    const falharam: string[] = [];
    let cancelado = false;

    const noTeto = (codigo: string): boolean =>
      achados.length >= this.opcoes.tetoGlobal ||
      (emitidos.get(codigo) ?? 0) >= this.opcoes.tetoPorCodigo;

    const apontar: Apontar = (achado) => {
      if (noTeto(achado.codigo)) {
        omitidos.set(achado.codigo, (omitidos.get(achado.codigo) ?? 0) + 1);
        return;
      }
      emitidos.set(achado.codigo, (emitidos.get(achado.codigo) ?? 0) + 1);
      achados.push(achado);
    };

    /*
     * Consultado pela regra ANTES de montar a mensagem.
     *
     * `apontar` sozinho aplica o teto tarde demais: o achado já chegou pronto,
     * com id concatenado e mensagem formatada. Uma regra que dispara em todo
     * item de um arquivo grande paga meio milhão de formatações para descartar
     * 499.500 delas. Regra de laço quente escreve
     * `if (!podeApontar(CODIGO)) continue;` antes de construir o objeto.
     */
    const podeApontar = (codigo: string): boolean => !noTeto(codigo);

    for (const regra of this.regrasPorCodigo.values()) {
      if (this.opcoes.cancelado?.()) {
        cancelado = true;
        break;
      }
      try {
        regra.executar(contexto, apontar, podeApontar);
      } catch {
        falharam.push(regra.codigo);
        apontar({
          id: `MOT-000:${regra.codigo}`,
          codigo: "MOT-000",
          severidade: "critico",
          nl: 0,
          reg: "",
          mensagem: `A regra ${regra.codigo} (${regra.nome}) falhou e não pôde ser aplicada. A auditoria deste arquivo está incompleta.`,
          corrigivel: false,
          regra: "Motor de validação",
        });
      }
    }

    return { achados, omitidosPorCodigo: omitidos, regrasQueFalharam: falharam, cancelado };
  }
}
