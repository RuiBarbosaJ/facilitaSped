import type { Metadata } from "next";

import { Cabecalho } from "@/componentes/Cabecalho";
import { Rodape } from "@/componentes/Rodape";
import { TituloDaTela } from "@/componentes/TituloDaTela";
import { Aviso, Cod, Paragrafo, Secao } from "@/criterios/ui/Secao";
import { Comparativo } from "@/criterios/ui/Comparativo";
import { Sumario } from "@/criterios/ui/Sumario";
import { LegendaDeConserto, ListaDeRegras } from "@/criterios/ui/TabelaDeRegras";
import { regrasImplementadas, resumoDoDicionario } from "@/criterios/regras";
import { BENEFICIOS } from "@/pis-cofins/auditoria";
import { LEIAUTE_CONFERIDO } from "@/icms-ipi/leiaute/versao";

export const metadata: Metadata = {
  title: "Critérios — Facilita Sped",
  description:
    "O que cada tela confere, contra qual norma, e o que a ferramenta corrige sozinha.",
};

/**
 * O documento de critérios.
 *
 * Existe porque a pergunta que o contador faz antes de assinar não é "o sistema
 * achou erro?", e sim "com base em quê?". Sem uma resposta escrita, a única
 * saída honesta dele é reconferir tudo à mão — e aí a ferramenta não economizou
 * nada.
 *
 * É um componente de SERVIDOR de propósito: a seção de regras é lida do
 * dicionário na montagem da página estática. `src/regras/` não pode entrar em
 * componente `"use client"` — o bundler arrastaria o dicionário e as tabelas
 * para o pacote que o navegador baixa.
 */
export default function PaginaCriterios() {
  const regras = regrasImplementadas();
  const dicionario = resumoDoDicionario();
  const porSeveridade = (s: string) => regras.filter((r) => r.severidade === s).length;

  return (
    <div className="flex min-h-screen flex-col bg-surface-page font-sans text-text-primary">
      <Cabecalho />

      <main
        id="conteudo-principal"
        className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8"
      >
        <TituloDaTela
          titulo="Critérios — o que o sistema confere e o que ele corrige"
          versao={<>Leiaute {LEIAUTE_CONFERIDO} · EFD-Contribuições</>}
          descricao="Este documento é o critério da ferramenta, escrito para ser conferido contra a norma. Pode ser impresso e anexado ao papel de trabalho."
        />

        <div className="grid gap-10 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
          <Sumario />

          <article className="flex min-w-0 max-w-4xl flex-col gap-10">
            {/* ───────────────────────────────────────────────────────── 01 */}
            <Secao
              id="visao-geral"
              numero="01"
              titulo="O que a ferramenta faz"
              resumo="Três coisas governam tudo o que vem depois. Se alguma delas não for aceitável para o seu escritório, o resto não interessa."
            >
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    titulo: "Nada sai do seu computador",
                    texto:
                      "A planilha e o arquivo do SPED são lidos dentro do navegador, numa thread separada. Não há upload: nenhum byte da escrituração do seu cliente chega a servidor nenhum — nem ao nosso. O que a ferramenta baixa são as tabelas públicas da Receita.",
                  },
                  {
                    titulo: "A ferramenta aponta; quem assina decide",
                    texto:
                      "O TXT vai assinado à Receita Federal. Por isso a régua é conservadora por construção: só é corrigido sozinho o que a própria escrituração já determina. Tudo que exige julgamento nasce desmarcado e espera aprovação linha a linha.",
                  },
                  {
                    titulo: "A norma vem antes do código",
                    texto:
                      "As regras vivem num dicionário separado do motor, em texto legível: cada uma declara a condição, a expressão, a severidade e a referência normativa. A seção 07 desta página é gerada desse dicionário — ela não pode divergir do que a ferramenta executa.",
                  },
                ].map((c) => (
                  <div key={c.titulo} className="rounded-md border border-border-subtle bg-surface-card p-4">
                    <p className="text-sm font-semibold text-text-primary">{c.titulo}</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">{c.texto}</p>
                  </div>
                ))}
              </div>

              <Aviso titulo="O que esta ferramenta não é">
                <p>
                  Ela não substitui o PVA nem o parecer de quem assina. Ela confere o que é
                  conferível por regra escrita — classificação, coerência de valores, integridade
                  do leiaute — e diz em que se baseou. Julgamento sobre o negócio do cliente,
                  contrato, destinação da mercadoria e regime da empresa continua sendo do
                  contador.
                </p>
              </Aviso>
            </Secao>

            {/* ───────────────────────────────────────────────────────── 02 */}
            <Secao
              id="as-tres-telas"
              numero="02"
              titulo="As três telas, lado a lado"
              resumo="Duas auditam e uma consulta. O que muda entre elas é o que entra, contra o que se confere e quanto a ferramenta se permite corrigir."
            >
              <Comparativo />
            </Secao>

            {/* ───────────────────────────────────────────────────────── 03 */}
            <Secao
              id="tabelas"
              numero="03"
              titulo="Tabelas oficiais — de onde vêm os dados"
              resumo="A tela de consulta não audita nada: ela abre as tabelas da Receita que sustentam as outras duas."
            >
              <Paragrafo>
                São as tabelas <Cod>4.3.x</Cod> da EFD-Contribuições — as listas em que a Receita
                declara qual NCM tem alíquota zero, qual é monofásico, qual está em substituição
                tributária, e com que natureza de receita cada um é escriturado. Elas são
                sincronizadas do site do SPED e trazem a vigência de cada regra.
              </Paragrafo>
              <Paragrafo>
                A vigência é o que a consulta respeita e o olho costuma esquecer. Uma regra de
                alíquota zero encerrada em 2020 continua na tabela; ela só não vale hoje. É por isso
                que cada linha mostra o período, e por isso a auditoria de PIS/COFINS descarta a
                regra encerrada antes de cobrar qualquer código.
              </Paragrafo>

              <Aviso titulo="Nem toda regra tem NCM" tom="atencao">
                <p>
                  Cerca de <strong>28% das regras do SPED descrevem o produto por texto</strong>, sem
                  citar código algum: &ldquo;leite fluido pasteurizado&rdquo;, &ldquo;queijo do
                  reino&rdquo;, autopeças, revenda de combustíveis. Para essas, procurar pelo NCM não
                  encontra nada — e &ldquo;não consta nas tabelas&rdquo; nunca significa &ldquo;o
                  produto é tributado&rdquo;. A busca por descrição existe justamente para esses
                  casos.
                </p>
              </Aviso>
            </Secao>

            {/* ───────────────────────────────────────────────────────── 04 */}
            <Secao
              id="pis-cofins"
              numero="04"
              titulo="PIS/COFINS — como a planilha é conferida"
              resumo="Cada linha da planilha passa por uma sequência fixa de perguntas. A primeira que falha decide a situação da linha e interrompe as demais."
            >
              <ol className="flex max-w-3xl flex-col gap-3">
                {[
                  {
                    t: "O NCM tem oito dígitos?",
                    d: "Abaixo disso não é classificação fiscal — é código truncado, ou a coluna errada. A linha sai como NCM inválido, em vermelho, e nada mais é cobrado dela. O zero à esquerda que o Excel derruba ao formatar a célula como número é recuperado antes desta pergunta.",
                  },
                  {
                    t: "Esse NCM existe na nomenclatura vigente?",
                    d: "Conferido contra a tabela NCM oficial (Siscomex). Código revogado aparece com a data da revogação: é o erro que mais passa despercebido, porque o produto continua sendo vendido com o código antigo no cadastro.",
                  },
                  {
                    t: "Há regra de benefício vigente para ele no SPED?",
                    d: "A busca vai do código completo até o capítulo de dois dígitos, e a mais específica vence. Uma regra encerrada mais específica não esconde uma vigente mais genérica — medicamentos tiveram alíquota zero até 2020, mas a regra monofásica da posição continua valendo.",
                  },
                  {
                    t: "A regra é forte o bastante para cobrar código?",
                    d: "Regra que cita um capítulo inteiro na descrição, ou que vale só para um Ex tarifário, sinaliza um benefício possível mas não autoriza cobrar CST nem natureza. Essas linhas aparecem como “possível”, sem realce de divergência.",
                  },
                  {
                    t: "O CST informado é o da ponta certa da operação?",
                    d: "As tabelas 4.3.3 e 4.3.4 usam 01 a 49 para descrever a receita e 50 a 99 para a aquisição. O mesmo produto de alíquota zero sai com CST 06 e entra com 73. Auditar uma planilha de compras contra a coluna de saída reprovaria todas as linhas.",
                  },
                  {
                    t: "A natureza da receita bate com a que a regra indica?",
                    d: "Um mesmo NCM pode ter mais de uma natureza vigente, porque elas descrevem produtos ou papéis diferentes — a água mineral é uma natureza até 9,999 L e outra acima de 10 L. Quando há mais de uma, a ferramenta lista todas.",
                  },
                ].map((p, i) => (
                  <li key={p.t} className="flex gap-3">
                    <span className="mt-0.5 shrink-0 rounded border border-border-subtle bg-surface-head px-1.5 py-0.5 font-mono text-[11px] text-text-tertiary tabular-nums">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-text-primary">{p.t}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-text-secondary">{p.d}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <h3 className="mt-2 text-sm font-semibold text-text-primary">
                Cada regime e o código que ele pede nas duas pontas
              </h3>
              <Paragrafo>
                A tabela do SPED diz qual é o <em>regime</em> do produto; ela não diz o código,
                porque o código depende de quem está escriturando. É esta correspondência que a
                auditoria aplica:
              </Paragrafo>

              <div className="overflow-hidden rounded-md border border-border-subtle">
                <table className="w-full border-collapse text-left text-sm">
                  <caption className="sr-only">
                    Tabela do SPED, regime que ela representa e os CSTs de saída e de entrada.
                  </caption>
                  <thead>
                    <tr className="bg-surface-head text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                      <th scope="col" className="px-3 py-2">Tabela</th>
                      <th scope="col" className="px-3 py-2">Regime</th>
                      <th scope="col" className="px-3 py-2">CST na saída</th>
                      <th scope="col" className="px-3 py-2">CST na entrada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(BENEFICIOS).map(([tabela, b]) => (
                      <tr key={tabela} className="border-t border-border-subtle odd:bg-surface-page/50">
                        <td className="px-3 py-2 font-mono text-text-secondary">{tabela}</td>
                        <td className="px-3 py-2 text-text-primary">{b.rotulo}</td>
                        <td className="px-3 py-2 font-mono text-text-secondary">{b.csts.join(" ou ")}</td>
                        <td className="px-3 py-2 font-mono text-text-secondary">{b.cstsEntrada.join(" ou ")}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-border-subtle odd:bg-surface-page/50">
                      <td className="px-3 py-2 font-mono text-text-tertiary">—</td>
                      <td className="px-3 py-2 text-text-primary">Sem benefício</td>
                      <td className="px-3 py-2 font-mono text-text-secondary">01</td>
                      <td className="px-3 py-2 font-mono text-text-secondary">50 ou 70</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <Aviso titulo="Por que a entrada sem benefício tem dois códigos" tom="atencao">
                <p>
                  <Cod>50</Cod> é aquisição <strong>com</strong> direito a crédito; <Cod>70</Cod> é
                  aquisição <strong>sem</strong> direito a crédito. Quem apura pelo não cumulativo
                  toma o crédito; quem apura pelo cumulativo não toma. A planilha não diz qual é o
                  caso, e a diferença entre os dois códigos é crédito tomado ou crédito perdido — por
                  isso a ferramenta <strong>pergunta o regime de apuração</strong> em vez de
                  escolher por você.
                </p>
                <p>
                  Na aquisição de produto monofásico para revenda a lei veda o crédito (Lei
                  10.637/02, art. 3º, § 2º, II, e Lei 10.833/03, art. 3º, § 2º, II): o código é o{" "}
                  <Cod>70</Cod>, e não o 50.
                </p>
              </Aviso>

              <h3 className="mt-2 text-sm font-semibold text-text-primary">
                Como a ferramenta descobre se a planilha é de entrada ou de saída
              </h3>
              <Paragrafo>
                Na ordem em que as pistas merecem fé, parando na primeira que responde: o{" "}
                <strong>título da coluna</strong>, quando declara (&ldquo;CST PIS Entrada&rdquo;) —
                é o ERP dizendo o que exportou; o <strong>CFOP</strong>, quando a planilha o traz —
                1, 2 e 3 entram, 5, 6 e 7 saem; a <strong>faixa dos CSTs informados</strong> — 50 a
                99 só existem na aquisição; e, se nada disso responder, vale saída. A tela sempre
                mostra em que se baseou, e o botão para trocar fica ao lado — uma detecção
                silenciosa que errasse trocaria todos os códigos da planilha pelos da outra ponta.
              </Paragrafo>

              <h3 className="mt-2 text-sm font-semibold text-text-primary">O critério de correção</h3>
              <Paragrafo>
                O critério é uma chave geral: você escolhe o regime-alvo, e a ferramenta grava o CST
                daquele regime nos NCMs que a tabela do SPED enquadra nele, e o CST de &ldquo;sem
                benefício&rdquo; nos demais. A linha cujo NCM tem <em>outro</em> regime vigente
                aceitando o código informado é mantida como veio — sem essa exceção, escolher
                &ldquo;alíquota zero&rdquo; tributaria a plena todos os medicamentos monofásicos da
                mesma planilha.
              </Paragrafo>
              <Paragrafo>
                Quando o NCM admite mais de uma natureza de receita e a planilha não informou
                nenhuma delas, a ferramenta aplica a primeira <strong>e diz que escolheu</strong>,
                em vez de decidir calada: gravar o código de outro produto na escrituração do
                cliente é pior do que dar trabalho de conferência.
              </Paragrafo>
            </Secao>

            {/* ───────────────────────────────────────────────────────── 05 */}
            <Secao
              id="icms-ipi"
              numero="05"
              titulo="ICMS/IPI — como a escrituração é auditada"
              resumo={`O arquivo é lido linha a linha contra um dicionário do leiaute ${LEIAUTE_CONFERIDO}. Hoje ele cobre ${dicionario.registros.join(", ")} — ${dicionario.campos} campos, com ${dicionario.declaradas} regras declaradas, das quais ${dicionario.implementadas} já rodam.`}
            >
              <h3 className="text-sm font-semibold text-text-primary">
                Três armadilhas que governam quase toda regra
              </h3>
              <Paragrafo>
                Não são detalhes de implementação: são os três pontos em que uma auditoria mal feita
                acusa erro em massa sobre arquivo correto. Vale conhecê-los para saber o que a
                ferramenta <em>não</em> vai apontar.
              </Paragrafo>

              <ul className="flex max-w-3xl flex-col gap-3">
                {[
                  {
                    t: "Campo de valor vazio vale zero",
                    d: "No leiaute da EFD, “obrigatório” num campo de valor significa que o delimitador tem de estar lá — não que exista conteúdo. Campo vazio vale 0,00 e o PVA aceita. Cobrar preenchimento ali transformaria toda escrituração normal num relatório de erros.",
                  },
                  {
                    t: "O CST do ICMS tem três dígitos, não dois",
                    d: "É origem da mercadoria (Tabela A) mais tributação (Tabela B): o CST real é 000 ou 110, nunca 00 ou 10. Toda regra que fala em “CST 40” fala dos dois últimos dígitos — e uma comparação ingênua com “40” simplesmente nunca casa, sem quebrar nada e sem avisar.",
                  },
                  {
                    t: "Documento cancelado sai do confronto",
                    d: "Cancelado, denegado e inutilizado (COD_SIT 02 a 05) não entram em totalizador nenhum. Uma regra de totais que não os exclua acusa divergência em massa no varejo, que é justamente onde mais se cancela nota.",
                  },
                ].map((a) => (
                  <li key={a.t} className="rounded-md border border-border-subtle bg-surface-card p-4">
                    <p className="text-sm font-medium text-text-primary">{a.t}</p>
                    <p className="mt-1 text-sm leading-relaxed text-text-secondary">{a.d}</p>
                  </li>
                ))}
              </ul>

              <h3 className="mt-2 text-sm font-semibold text-text-primary">
                O dominó: item → analítico → documento
              </h3>
              <Paragrafo>
                A nota fiscal aparece três vezes no arquivo, em três níveis, e os três têm de fechar
                entre si. O <Cod>C170</Cod> é o item; o <Cod>C190</Cod> é a consolidação por CST,
                CFOP e alíquota; o <Cod>C100</Cod> é o total do documento. Corrigir um valor no item
                sem refazer o analítico e o total apenas troca um erro por outro — e é por isso que
                uma correção aprovada num item pode arrastar consigo os dois níveis acima.
              </Paragrafo>

              <Aviso titulo="O arquivo volta byte a byte">
                <p>
                  O TXT gerado é o original com as correções que <em>você</em> aprovou, e nada mais:
                  mesma ordem de linhas, mesmo delimitador, mesma codificação de caracteres, mesmo
                  fim de linha. Os totalizadores de bloco são recalculados porque a própria norma os
                  define como contagem — todo o resto que não foi aprovado volta idêntico ao que
                  entrou. Uma correção que não caiba na linha sem mudar a estrutura é{" "}
                  <strong>recusada</strong> e aparece no relatório do download, em vez de ser
                  aplicada calada.
                </p>
              </Aviso>
            </Secao>

            {/* ───────────────────────────────────────────────────────── 06 */}
            <Secao
              id="regua"
              numero="06"
              titulo="A régua de correção"
              resumo="A diferença entre corrigir uma planilha e corrigir um SPED. A planilha volta ao ERP e passa por revisão humana; o TXT vai assinado à Receita."
            >
              <LegendaDeConserto />

              <div className="grid max-w-3xl gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-border-subtle border-l-2 border-l-success bg-surface-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-primary">
                    Seguro corrigir sozinho
                  </p>
                  <p className="mt-1 text-xs text-text-tertiary">
                    O valor certo é dedutível do próprio arquivo.
                  </p>
                  <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-4 text-sm leading-relaxed text-text-secondary">
                    <li>Contagem de linhas de bloco e o bloco 9 inteiro — é aritmética sobre o arquivo.</li>
                    <li>Campo que só pode ter um valor dada a situação declarada, como imposto zerado em operação isenta.</li>
                    <li>Formatação que não muda conteúdo: zero à esquerda em código de domínio fechado, delimitador final ausente.</li>
                  </ul>
                </div>

                <div className="rounded-md border border-border-subtle border-l-2 border-l-danger bg-surface-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-primary">
                    Nunca corrigido sozinho
                  </p>
                  <p className="mt-1 text-xs text-text-tertiary">
                    Exige decisão de quem assina a escrituração.
                  </p>
                  <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-4 text-sm leading-relaxed text-text-secondary">
                    <li><strong>CST, CFOP e NCM</strong> — mudar isso é reclassificar a operação, e a classificação depende do contrato, da mercadoria e do destinatário; nada disso está no arquivo.</li>
                    <li><strong>Base, alíquota e valor de imposto</strong> — alterar é refazer a apuração e mudar quanto se deve.</li>
                    <li><strong>Cadastro ausente</strong> — inventar o cadastro que falta é inventar o dado, não corrigi-lo.</li>
                    <li>Qualquer campo cujo valor certo venha de tabela externa que não esteja carregada e vigente para o período.</li>
                  </ul>
                </div>
              </div>

              <Paragrafo>
                Na dúvida, a regra nasce sem correção automática e com o motivo escrito. Um
                apontamento honesto vale mais que uma correção que o contador vai assinar sem
                conferir — e é por isso que, das {regras.length} regras que rodam hoje no ICMS/IPI,
                nenhuma altera CST, CFOP ou NCM por conta própria.
              </Paragrafo>
            </Secao>

            {/* ───────────────────────────────────────────────────────── 07 */}
            <Secao
              id="regras"
              numero="07"
              titulo="As regras que rodam hoje"
              resumo={`${regras.length} regras do ICMS/IPI — ${porSeveridade("erro")} classificadas como erro e ${porSeveridade("alerta")} como alerta. A condição e a expressão abaixo são as do dicionário, palavra por palavra, para poderem ser conferidas contra o Guia Prático.`}
            >
              <ListaDeRegras regras={regras} />

              <Aviso titulo="Erro e alerta não são a mesma coisa">
                <p>
                  <strong>Erro</strong> é o que a norma contradiz: operação isenta com imposto
                  destacado, CST que não existe na tabela. <strong>Alerta</strong> é o que
                  provavelmente está errado mas tem explicação legítima possível — um somatório que
                  não fecha por centavos de arredondamento, uma divergência que depende de critério
                  de rateio que o arquivo não declara. Alerta não precisa de correção; precisa de
                  olhada.
                </p>
              </Aviso>
            </Secao>

            {/* ───────────────────────────────────────────────────────── 08 */}
            <Secao
              id="limites"
              numero="08"
              titulo="O que ainda não é conferido"
              resumo="Esta lista existir é o que separa um critério honesto de um que finge certeza. Ela vem do próprio dicionário e encolhe a cada conferência."
            >
              <Paragrafo>
                O dicionário do ICMS/IPI cobre hoje os registros{" "}
                <Cod>{dicionario.registros.join(", ")}</Cod>. Inventário, produção, CIAP, CT-e,
                energia e o bloco de apuração ainda não têm regra rodando — o que a ferramenta não
                aponta nesses blocos não significa que esteja certo, significa que não foi olhado.
              </Paragrafo>

              <details className="max-w-3xl rounded-md border border-border-subtle bg-surface-card">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-text-primary marker:content-none hover:bg-surface-hover">
                  <span className="font-mono text-xs text-text-tertiary">
                    {dicionario.pendencias.length}
                  </span>{" "}
                  pontos ainda por conferir contra a fonte oficial
                  <span className="float-right text-text-tertiary" aria-hidden>
                    ▾
                  </span>
                </summary>
                <ul className="flex list-disc flex-col gap-2 border-t border-border-subtle px-4 py-3 pl-8 text-sm leading-relaxed text-text-secondary">
                  {dicionario.pendencias.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </details>

              <Paragrafo>
                A referência normativa está em{" "}
                <a
                  href={dicionario.fonte}
                  className="rounded-sm text-accent underline underline-offset-2 hover:text-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  target="_blank"
                  rel="noreferrer"
                >
                  gov.br/sped
                </a>
                , e o leiaute conferido é o <Cod>{LEIAUTE_CONFERIDO}</Cod>. Quando o arquivo declara
                uma versão diferente dessa, a ferramenta avisa em vez de auditar calada contra o
                leiaute errado.
              </Paragrafo>
            </Secao>

            {/* ───────────────────────────────────────────────────────── 09 */}
            <Secao id="glossario" numero="09" titulo="Glossário">
              <dl className="grid max-w-3xl gap-x-6 gap-y-3 sm:grid-cols-[9rem_1fr]">
                {[
                  ["NCM", "Nomenclatura Comum do Mercosul: oito dígitos que classificam a mercadoria. É por ele que se descobre o regime tributário do produto."],
                  ["CST", "Código de Situação Tributária. No PIS/COFINS tem dois dígitos e muda conforme a ponta da operação; no ICMS tem três — origem da mercadoria mais tributação."],
                  ["CFOP", "Código Fiscal de Operações e Prestações: diz o que a operação é e para onde vai. O primeiro dígito indica o sentido — 1, 2 e 3 entram; 5, 6 e 7 saem."],
                  ["Natureza da receita", "Código de três dígitos das tabelas 4.3.x que identifica qual regra de benefício está sendo aplicada. Um mesmo NCM pode ter mais de uma."],
                  ["Monofásico", "Regime em que o tributo é recolhido inteiro numa etapa da cadeia. Quem revende não tributa de novo — e, na compra para revenda, não toma crédito."],
                  ["C100", "O registro do documento fiscal na EFD ICMS/IPI: os totais da nota."],
                  ["C170", "O item da nota — uma linha por produto, com CST, CFOP, base e imposto."],
                  ["C190", "A consolidação da nota por CST, CFOP e alíquota. É o que o fisco soma."],
                  ["PVA", "Programa Validador e Assinador: o software da Receita que valida o arquivo antes da entrega."],
                  ["Vigência", "O período em que uma regra vale. Regra encerrada continua na tabela e não se aplica mais."],
                ].map(([termo, texto]) => (
                  <div key={termo} className="contents">
                    <dt className="font-mono text-sm font-semibold text-text-primary">{termo}</dt>
                    <dd className="text-sm leading-relaxed text-text-secondary">{texto}</dd>
                  </div>
                ))}
              </dl>
            </Secao>
          </article>
        </div>
      </main>

      <Rodape />
    </div>
  );
}
