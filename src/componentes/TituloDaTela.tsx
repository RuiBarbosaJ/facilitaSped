import type { ReactNode, Ref } from "react";

interface TituloDaTelaProps {
  /** O nome da tela, curto. É um título de ferramenta, não uma chamada. */
  titulo: ReactNode;
  /**
   * A versão do que está na tela: leiaute, tabela, nomenclatura.
   *
   * Quem audita escrituração precisa saber CONTRA O QUÊ está conferindo antes
   * de olhar o primeiro dado — e essa informação normalmente fica num rodapé
   * que ninguém lê, ou em lugar nenhum. Aqui ela vem logo abaixo do título,
   * em texto discreto, e não numa caixa: o selo em fonte mono com borda era
   * mais uma pastilha disputando o olho com o dado.
   */
  versao?: ReactNode;
  /** Uma linha, quando a tela precisa de contexto. Nunca um parágrafo. */
  descricao?: ReactNode;
  /** As ações da tela — exportar, nova auditoria —, alinhadas à direita. */
  acoes?: ReactNode;
  /** Para a tela que troca de título e precisa amarrar a seção a ele. */
  id?: string;
  /**
   * Torna o título focável e o entrega a quem chama. As telas de auditoria
   * levam o foco até ele quando o resultado chega: sem isso o leitor de tela
   * não anuncia que a tela mudou, e o teclado continua lá no upload.
   */
  refTitulo?: Ref<HTMLHeadingElement>;
}

/**
 * O cabeçalho de uma tela, no registro de console de dados.
 *
 * Substitui o par "título grande + parágrafo explicativo" que toda landing page
 * usa. Quem abre esta ferramenta já sabe o que ela faz: o que ele precisa ver
 * primeiro é o nome da tela, a versão da norma e os dados. O texto que explicava
 * o óbvio ocupava a primeira dobra inteira e empurrava a tabela para baixo.
 */
export function TituloDaTela({ titulo, versao, descricao, acoes, id, refTitulo }: TituloDaTelaProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 md:flex-nowrap">
      <div className="flex min-w-0 basis-full flex-col gap-1 md:basis-auto md:flex-1">
        <h1
          id={id}
          ref={refTitulo}
          tabIndex={refTitulo ? -1 : undefined}
          className="text-xl font-semibold tracking-tight text-text-primary focus:outline-none"
        >
          {titulo}
        </h1>
        {versao && <p className="text-xs text-text-tertiary">{versao}</p>}
        {descricao && <p className="mt-1 max-w-3xl text-sm text-text-secondary">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2 md:shrink-0">{acoes}</div>}
    </header>
  );
}
