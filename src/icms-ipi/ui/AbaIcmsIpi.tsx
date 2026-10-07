"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Download, Loader2, Trash2 } from "lucide-react";

import { Banner } from "@/componentes/Banner";
import { LinhaDeAjuste } from "@/componentes/LinhaDeAjuste";
import { ZonaUpload } from "@/componentes/ZonaUpload";
import { GradeRegistro } from "./GradeRegistro";
import { PainelIcmsIpi } from "./PainelIcmsIpi";
import { RevisaoCorrecoes } from "./RevisaoCorrecoes";
import { TabelaAchados } from "./TabelaAchados";
import { ROTULO_SEVERIDADE } from "./colunasAchados";
import { TituloDaTela } from "@/componentes/TituloDaTela";
import { LEIAUTE_CONFERIDO } from "../leiaute/versao";
import { useAbaIcmsIpi } from "./useAbaIcmsIpi";
import type { CodFin } from "../leitura/protocolo";
import type { Severidade } from "@/regras/nucleo/contrato";

const TITULO = "ICMS/IPI — auditoria da escrituração";

/** "12345678000199" → "12.345.678/0001-99". O que não tem 14 dígitos fica como veio. */
function formatarCnpj(cnpj: string): string {
  return /^\d{14}$/.test(cnpj) ? cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : cnpj;
}

/**
 * "01012024 a 31012024" → "01/01/2024 a 31/01/2024". As datas do registro 0000
 * são DDMMAAAA pelo leiaute; aqui só se põem as barras, sem reler a data.
 */
function formatarPeriodo(periodo: string): string {
  return periodo.replace(/\b(\d{2})(\d{2})(\d{4})\b/g, "$1/$2/$3");
}

/** A ordem em que a frase de resumo cita as severidades: da mais grave. */
const ORDEM: Severidade[] = ["critico", "erro", "alerta", "info"];

const COR_DA_CONTAGEM: Record<Severidade, string> = {
  critico: "text-danger",
  erro: "text-danger",
  alerta: "text-warning",
  info: "text-text-secondary",
};

/** "4 erros", "1 alerta", "1 informativo" — o rótulo da severidade no plural certo. */
function contar(quantidade: number, severidade: Severidade): string {
  const rotulo = ROTULO_SEVERIDADE[severidade].toLowerCase();
  const plural = rotulo === "crítico" ? "críticos" : rotulo === "erro" ? "erros" : rotulo === "alerta" ? "alertas" : "informativos";
  return `${quantidade.toLocaleString("pt-BR")} ${quantidade === 1 ? rotulo : plural}`;
}

export function AbaIcmsIpi() {
  const { worker, estado, temArquivoOriginal, acoes, limites } = useAbaIcmsIpi();
  const { progresso, resumo, achados, propostas, aprovadas, correcoesAprovadas, erro, aviso, gerando } =
    estado;

  const zonaRef = useRef<HTMLDivElement>(null);
  const etapaRef = useRef<HTMLHeadingElement>(null);
  /*
   * A finalidade escolhida fica atrelada ao arquivo em que foi escolhida. Assim
   * ela é DERIVADA do que o arquivo declara enquanto o contador não decidir
   * nada, e a escolha não vaza para o arquivo seguinte — sem precisar de um
   * efeito que reescreve o estado a cada resumo novo.
   */
  const [escolha, setEscolha] = useState<{ arquivo: string; codFin: CodFin } | null>(null);

  const etapa = erro ? "erro" : progresso ? "progresso" : resumo ? "resumo" : "upload";

  // O foco acompanha a troca de etapa: sem isto ele voltava para o topo do
  // documento a cada transição e quem navega por teclado tinha de percorrer o
  // cabeçalho inteiro de novo — e quem usa leitor de tela nem sabia que a tela
  // havia mudado.
  useEffect(() => {
    if (etapa !== "upload") etapaRef.current?.focus();
  }, [etapa]);

  const finalidade: CodFin =
    escolha && escolha.arquivo === resumo?.hash
      ? escolha.codFin
      : resumo?.codFinOriginal === "1"
        ? "1"
        : "0";

  const percentual = progresso
    ? Math.min(100, Math.round((progresso.bytesLidos / Math.max(1, progresso.bytesTotal)) * 100))
    : 0;

  const limiteEmMb = Math.round(limites.TAMANHO_MAXIMO_BYTES / 1024 / 1024);

  const comResultado = Boolean(resumo && !progresso);

  const porSeveridade = new Map<Severidade, number>();
  for (const achado of achados) porSeveridade.set(achado.severidade, (porSeveridade.get(achado.severidade) ?? 0) + 1);

  return (
    <div className="flex flex-col gap-6">
      <TituloDaTela
        titulo={TITULO}
        versao={<>EFD ICMS/IPI · Leiaute {LEIAUTE_CONFERIDO}</>}
        descricao={
          etapa === "upload"
            ? "Aponta as divergências da escrituração e regrava o arquivo no mesmo leiaute. O arquivo é lido no seu navegador — nada é enviado."
            : undefined
        }
        acoes={
          comResultado && (
            <button
              type="button"
              onClick={() => {
                acoes.encerrar();
                requestAnimationFrame(() => zonaRef.current?.focus());
              }}
              className="inline-flex items-center gap-2 rounded-md border border-border-strong bg-surface-card px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Trash2 size={15} aria-hidden />
              Encerrar análise
            </button>
          )
        }
      />

      {erro && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <div>
            <h2 ref={etapaRef} tabIndex={-1} className="font-medium focus:outline-none">
              Não deu para ler este arquivo.
            </h2>
            <p className="mt-0.5">{erro}</p>
          </div>
        </div>
      )}

      {aviso && (
        <Banner tom="ok">
          <span className="break-all">{aviso}</span>
        </Banner>
      )}

      {etapa === "upload" && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5 lg:gap-10">
          <div className="lg:col-span-2 lg:pt-2">
            <PainelIcmsIpi />
          </div>
          <div className="lg:col-span-3">
            <ZonaUpload
              ref={zonaRef}
              onArquivo={acoes.importar}
              processando={false}
              extensoes={[".txt"]}
              accept=".txt,text/plain"
              nomeDoTipo="um arquivo .txt do SPED"
              titulo="Arraste o arquivo do SPED EFD ICMS/IPI aqui"
              descricao={`Arquivo .txt de até ${limiteEmMb} MB. Ele é lido no seu navegador — nada é enviado.`}
            />
          </div>
        </div>
      )}

      {progresso && (
        <section
          aria-labelledby="titulo-progresso"
          className="mx-auto flex w-full max-w-xl flex-col gap-4 rounded-lg border border-border-subtle bg-surface-card p-6 text-center"
        >
          <h2
            id="titulo-progresso"
            ref={etapaRef}
            tabIndex={-1}
            className="flex items-center justify-center gap-2 text-base font-semibold focus:outline-none"
          >
            <Loader2 size={18} className="animate-spin text-accent" aria-hidden />
            Lendo a escrituração…
          </h2>

          <div
            role="progressbar"
            aria-label="Progresso da leitura do arquivo SPED"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percentual}
            aria-valuetext={`${percentual}% — ${progresso.linhas.toLocaleString("pt-BR")} linhas lidas`}
            className="h-2 w-full overflow-hidden rounded-sm bg-surface-head"
          >
            <div
              className="h-full rounded-sm bg-accent transition-all duration-300"
              style={{ width: `${Math.max(2, percentual)}%` }}
            />
          </div>

          <div className="flex justify-between text-sm text-text-tertiary">
            <span>{progresso.linhas.toLocaleString("pt-BR")} linhas</span>
            <span>{percentual}%</span>
          </div>

          <button
            type="button"
            onClick={() => {
              acoes.cancelar();
              requestAnimationFrame(() => zonaRef.current?.focus());
            }}
            className="mx-auto rounded-md border border-border-strong bg-surface-card px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Cancelar leitura
          </button>
        </section>
      )}

      {resumo && !progresso && (
        <>
          {/*
            DE QUEM É O ARQUIVO, E EM QUE ESTADO ELE ESTÁ.

            Antes era um cartão com ícone, dois parágrafos sobre privacidade e o
            hash SHA-256 em destaque — tudo isso antes de dizer se o arquivo tinha
            problema. O hash e as notas continuam aqui, a um clique; o que vem à
            vista é quem é o contribuinte e a resposta que o contador veio buscar:
            quantos apontamentos, de que gravidade, e quantas correções esperam.
          */}
          <section aria-labelledby="titulo-resumo" className="flex flex-col gap-2">
            <h2
              id="titulo-resumo"
              ref={etapaRef}
              tabIndex={-1}
              className="truncate text-base font-semibold text-text-primary focus:outline-none"
              title={resumo.empresa}
            >
              {resumo.empresa}
            </h2>
            <p className="text-xs text-text-tertiary">
              CNPJ {formatarCnpj(resumo.cnpj)} · {resumo.uf} · período {formatarPeriodo(resumo.periodo)} · perfil{" "}
              {resumo.perfil} · leiaute {resumo.versaoLeiaute} · {resumo.totalLinhas.toLocaleString("pt-BR")} linhas
              {resumo.codFinOriginal === "1" ? " · o arquivo importado é uma retificadora" : ""}
            </p>

            <p className="text-sm text-text-secondary">
              {achados.length === 0 ? (
                "Nenhum apontamento."
              ) : (
                <>
                  <a
                    href="#apontamentos"
                    className="rounded-sm font-medium text-text-primary underline decoration-border-strong underline-offset-2 hover:decoration-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {achados.length.toLocaleString("pt-BR")}{" "}
                    {achados.length === 1 ? "apontamento" : "apontamentos"}
                  </a>
                  {": "}
                  {ORDEM.filter((s) => porSeveridade.get(s)).map((s, i, lista) => (
                    <span key={s}>
                      {i > 0 && (i === lista.length - 1 ? " e " : ", ")}
                      <span className={`font-medium ${COR_DA_CONTAGEM[s]}`}>{contar(porSeveridade.get(s) ?? 0, s)}</span>
                    </span>
                  ))}
                  .
                </>
              )}
              {propostas.length > 0 && (
                <>
                  {" "}
                  <a
                    href="#arquivo-pva"
                    className="rounded-sm underline decoration-border-strong underline-offset-2 hover:text-text-primary hover:decoration-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {correcoesAprovadas.length.toLocaleString("pt-BR")} de{" "}
                    {propostas.length.toLocaleString("pt-BR")}{" "}
                    {propostas.length === 1 ? "correção aprovada" : "correções aprovadas"} para o arquivo gerado
                  </a>
                  .
                </>
              )}
            </p>

            {resumo.achadosOmitidos > 0 && (
              <p className="text-xs text-warning">
                {resumo.achadosOmitidos.toLocaleString("pt-BR")} apontamentos repetidos foram
                omitidos: cada código exibe no máximo{" "}
                {limites.ACHADOS_POR_CODIGO.toLocaleString("pt-BR")} ocorrências.
              </p>
            )}

            <details className="text-xs text-text-tertiary">
              <summary className="w-fit cursor-pointer rounded-sm transition-colors hover:text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                Sobre este arquivo
              </summary>
              <div className="mt-2 flex max-w-3xl flex-col gap-2 rounded-md border border-border-subtle bg-surface-card p-3">
                <p>
                  Empresa, CNPJ, UF, período e perfil vêm do registro 0000 do próprio arquivo — a
                  ferramenta não pergunta nada sobre o contribuinte.
                </p>
                <p>
                  Encerrar apaga o arquivo da memória deste navegador. Enquanto a análise estiver aberta,
                  os dados do cliente continuam disponíveis para quem usar este computador.
                </p>
                <div>
                  <p className="font-medium text-text-secondary">SHA-256 do arquivo importado</p>
                  <p className="mt-0.5 break-all font-mono">{resumo.hash}</p>
                  <p className="mt-0.5">
                    É o hash dos bytes do arquivo como ele veio do disco: confere com{" "}
                    <code className="font-mono">sha256sum</code>.
                  </p>
                </div>
              </div>
            </details>
          </section>

          {/* O QUE ESTÁ ERRADO — a resposta que o contador veio buscar vem primeiro. */}
          <section
            id="apontamentos"
            aria-labelledby="titulo-achados"
            className="flex scroll-mt-[calc(var(--altura-cabecalho)+1.5rem)] flex-col gap-3"
          >
            <h2 id="titulo-achados" className="text-base font-semibold">
              Apontamentos
            </h2>

            {achados.length === 0 ? (
              <Banner tom="ok">
                Nenhum problema encontrado. A estrutura dos registros, o cadastro de itens e participantes, o
                CFOP e os totalizadores de bloco batem com o layout.
              </Banner>
            ) : (
              <TabelaAchados achados={achados} />
            )}
          </section>

          {/*
            O ARQUIVO PARA O PVA: rever as correções, escolher a finalidade, gerar.

            A revisão vem ANTES do botão que gera o arquivo. A grade também
            aprova, uma linha por vez, e é onde se confere o conserto no contexto
            do registro. O que faltava era a outra leitura: a lista do que vai
            mudar, agrupada por código, com o motivo e o de → para de cada item —
            e o "aprovar todas" que a grade só oferece dentro do recorte. Quem vai
            assinar precisa poder ler o diff inteiro sem caçá-lo coluna a coluna.
          */}
          <section
            id="arquivo-pva"
            aria-labelledby="titulo-exportacao"
            className="flex scroll-mt-[calc(var(--altura-cabecalho)+1.5rem)] flex-col gap-3"
          >
            <h2 id="titulo-exportacao" className="text-base font-semibold">
              Arquivo para o PVA
            </h2>

            <div className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-surface-card">
              {propostas.length > 0 && (
                <div className="p-4">
                  <RevisaoCorrecoes
                    propostas={propostas}
                    aprovadas={aprovadas}
                    onAlternar={acoes.alternarCorrecao}
                    onAlternarCodigo={acoes.alternarPorCodigo}
                  />
                </div>
              )}

              <LinhaDeAjuste rotulo="Finalidade">
                <fieldset className="flex flex-wrap gap-x-8 gap-y-2">
                  <legend className="sr-only">Finalidade da escrituração (campo COD_FIN do registro 0000)</legend>
                  {(
                    [
                      { valor: "0", rotulo: "Original", nota: "Escrituração ainda não entregue para este período." },
                      { valor: "1", rotulo: "Retificadora", nota: "Substitui uma escrituração já entregue ao fisco." },
                    ] as const
                  ).map((opcao) => (
                    <label key={opcao.valor} className="flex cursor-pointer items-start gap-2 text-sm">
                      <input
                        type="radio"
                        name="finalidade"
                        value={opcao.valor}
                        checked={finalidade === opcao.valor}
                        onChange={() => setEscolha({ arquivo: resumo.hash, codFin: opcao.valor })}
                        className="mt-1 accent-accent"
                      />
                      <span>
                        <span className="font-medium text-text-primary">{opcao.rotulo}</span>
                        <span className="block text-xs text-text-tertiary">{opcao.nota}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>

                {finalidade === "1" && resumo.codFinOriginal !== "1" && (
                  <p role="status" className="rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
                    O arquivo importado está marcado como original. Gerar uma retificadora só faz sentido
                    se esta escrituração já foi entregue — e o arquivo gerado ainda precisa ser validado
                    e assinado no PVA antes da transmissão.
                  </p>
                )}
              </LinhaDeAjuste>

              <div className="flex flex-col gap-4 p-4">
                {/*
                  OS DOIS BOTÕES BAIXAM ARQUIVOS DIFERENTES, e a confusão entre eles
                  é a mais cara que esta tela pode causar: quem aprova correções e
                  baixa a cópia fiel leva o arquivo SEM elas — e transmite achando
                  que corrigiu. Cada um passou a dizer, embaixo, o que faz.
                */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-8">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => acoes.gerarTxt(finalidade)}
                      disabled={gerando}
                      aria-busy={gerando}
                      className="inline-flex w-fit items-center justify-center gap-2 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-60"
                    >
                      {gerando ? (
                        <Loader2 size={15} className="animate-spin" aria-hidden />
                      ) : (
                        <Download size={15} aria-hidden />
                      )}
                      {/*
                        A palavra "corrigido" só aparece quando há correção aprovada.
                        Fixa no rótulo, ela prometeria conserto num arquivo em que
                        nada foi marcado — e o contador transmitiria achando que a
                        ferramenta tinha resolvido algo.
                      */}
                      {gerando
                        ? "Gerando…"
                        : `Gerar TXT ${finalidade === "1" ? "retificador" : "original"}${
                            correcoesAprovadas.length > 0 ? " corrigido" : ""
                          }`}
                    </button>
                    <p className="max-w-64 text-xs text-text-tertiary">
                      {correcoesAprovadas.length > 0 ? (
                        <>
                          É <strong className="font-semibold text-success">este</strong> que leva as{" "}
                          {correcoesAprovadas.length.toLocaleString("pt-BR")}{" "}
                          {correcoesAprovadas.length === 1 ? "correção aprovada" : "correções aprovadas"}.
                        </>
                      ) : (
                        "Nenhuma correção aprovada ainda: sai igual ao importado, só com os totais de bloco refeitos."
                      )}
                    </p>
                  </div>

                  <div className="flex min-w-0 flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={acoes.baixarCopiaFiel}
                      disabled={!temArquivoOriginal}
                      title={
                        temArquivoOriginal
                          ? "O arquivo exatamente como veio do disco, byte por byte."
                          : "Disponível apenas na mesma visita em que o arquivo foi importado."
                      }
                      className="inline-flex w-fit items-center justify-center gap-2 rounded-md border border-border-strong bg-surface-card px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
                    >
                      Baixar cópia fiel do importado
                    </button>
                    <p className="max-w-64 text-xs text-text-tertiary">
                      O arquivo como entrou, byte por byte.{" "}
                      {correcoesAprovadas.length > 0 ? (
                        <strong className="font-semibold text-warning">
                          Não leva as correções aprovadas.
                        </strong>
                      ) : (
                        "Serve para guardar o original."
                      )}
                    </p>
                  </div>
                </div>

                <p className="max-w-4xl text-xs text-text-tertiary">
                  O TXT gerado sai no mesmo charset, com a mesma quebra de linha e a mesma estrutura do
                  arquivo importado. Mudam os fechamentos de bloco, o bloco 9, a finalidade — e os campos
                  das correções que você aprovou, um a um, listados no relatório que acompanha o
                  download. Nenhum outro campo é reescrito. Valide no PVA antes de transmitir.
                </p>
              </div>
            </div>
          </section>

          {/*
            O ARQUIVO INTEIRO, POR ÚLTIMO. A grade é a ferramenta de investigação:
            conferir um apontamento no contexto do registro, aprovar uma correção
            linha a linha. Ela vinha antes da lista de apontamentos, e cento e oito
            colunas quase vazias empurravam a resposta para o fim da página.
          */}
          <section aria-labelledby="titulo-grade" className="flex flex-col gap-3">
            <div>
              <h2 id="titulo-grade" className="text-base font-semibold">
                Registros do arquivo
              </h2>
              <p className="mt-0.5 text-xs text-text-tertiary">
                O arquivo inteiro, uma coluna por campo do leiaute. Use para conferir um apontamento no
                contexto do registro ou aprovar correções linha a linha.
              </p>
            </div>
            <GradeRegistro
              worker={worker}
              contagens={resumo.contagemPorRegistro}
              achados={achados}
              propostas={propostas}
              aprovadas={aprovadas}
              onAlternarLinhas={acoes.alternarCorrecoesDeLinhas}
            />
          </section>
        </>
      )}
    </div>
  );
}
