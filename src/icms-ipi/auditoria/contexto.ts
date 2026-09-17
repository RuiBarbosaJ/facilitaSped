import { valorDe } from "@/regras/nucleo/acesso";
import type {
  ContextoValidacao,
  Documento,
  DocumentoFiscal,
  LinhaSped as LinhaDaRegra,
} from "@/regras/nucleo/contrato";
import { DICIONARIO_SPED_ICMS_IPI } from "@/regras/icms-ipi/dicionario-sped-icms-ipi";
import type { EstruturaSped, NotaC100 } from "../leitura/parser";

/**
 * A ponte entre o LEITOR e as REGRAS.
 *
 * `src/regras/` é a autoridade normativa e não conhece o parser: ele declara o
 * que precisa receber (`ContextoValidacao`) e nada mais. `EstruturaSped` é a
 * representação interna do leitor, feita para caber em memória num arquivo de
 * 150 MB. As duas descrevem a mesma escrituração e não se encaixam sozinhas —
 * é o que este arquivo resolve, e é por isso que ele mora aqui, do lado do
 * leitor, e não lá: quem muda de forma por performance é o leitor, e a tradução
 * acompanha quem muda.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE UM ENVOLTÓRIO PREGUIÇOSO, E NÃO UMA CÓPIA
 *
 * A conversão óbvia — percorrer as notas e montar objetos novos com os filhos
 * já indexados por registro — CÓPIA a estrutura inteira. Num arquivo grande são
 * dezenas de milhares de documentos, cada um ganhando um `Map` que quase
 * nenhuma regra vai abrir: as regras de mercadoria usam `itens` e `analiticos`,
 * que o leitor já separa. O envoltório custa um objeto por documento e só monta
 * o `Map` de filhos quando alguém pede — que hoje é ninguém.
 *
 * O envoltório também não copia `campos`: as regras leem, nunca escrevem, e a
 * regravação depende de o array original continuar sendo o do arquivo. Uma
 * cópia aqui abriria a porta para uma regra alterar a cópia e o arquivo
 * exportado sair sem a alteração — ou, pior, com ela.
 */

class DocumentoDaNota implements DocumentoFiscal {
  readonly reg = "C100";
  private indice: ReadonlyMap<string, readonly LinhaDaRegra[]> | null = null;

  constructor(private readonly nota: NotaC100) {}

  get nl(): number {
    return this.nota.nl;
  }

  get campos(): readonly string[] {
    return this.nota.campos;
  }

  get itens(): readonly LinhaDaRegra[] {
    return this.nota.itens;
  }

  get analiticos(): readonly LinhaDaRegra[] {
    return this.nota.analiticos;
  }

  /** Filhos agrupados por registro, montados na primeira consulta e guardados. */
  get filhos(): ReadonlyMap<string, readonly LinhaDaRegra[]> {
    if (this.indice) return this.indice;

    const porRegistro = new Map<string, LinhaDaRegra[]>();
    const guardar = (linha: LinhaDaRegra) => {
      const lista = porRegistro.get(linha.reg);
      if (lista) lista.push(linha);
      else porRegistro.set(linha.reg, [linha]);
    };

    for (const item of this.nota.itens) guardar(item);
    for (const analitico of this.nota.analiticos) guardar(analitico);
    for (const outro of this.nota.filhos) guardar(outro);

    this.indice = porRegistro;
    return porRegistro;
  }
}

/**
 * A estrutura lida, vista como as regras precisam vê-la.
 *
 * `grupos` traz só a chave `C100` porque é só isso que o parser monta hoje —
 * documento de CT-e, de energia, de inventário e de produção ainda não são
 * agrupados por registro-raiz. Chave ausente significa "o arquivo não tem esse
 * tipo de documento", e é assim que as regras precisam lê-la: uma regra de
 * inventário não deve apontar nada por não achar o grupo.
 */
export function contextoDaEstrutura(estrutura: EstruturaSped): ContextoValidacao {
  const documentos: readonly DocumentoFiscal[] = estrutura.notas.map(
    (nota) => new DocumentoDaNota(nota)
  );

  const grupos = new Map<string, readonly Documento[]>();
  if (documentos.length > 0) grupos.set("C100", documentos);

  const uf = estrutura.cabecalho
    ? valorDe(DICIONARIO_SPED_ICMS_IPI, estrutura.cabecalho.campos, "UF") ?? ""
    : "";

  return {
    dicionario: DICIONARIO_SPED_ICMS_IPI,
    cabecalho: estrutura.cabecalho,
    participantes: estrutura.participantes,
    produtos: estrutura.produtos,
    unidades: estrutura.unidades,
    naturezas: estrutura.naturezas,
    grupos,
    documentos,
    apuracao: estrutura.apuracao,
    linhas: estrutura.linhas,
    contagemPorRegistro: estrutura.contagemPorRegistro,
    uf,
  };
}
