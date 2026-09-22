"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Download, FileText, Loader2, ShieldCheck, Trash2 } from "lucide-react";

import { ZonaUpload } from "@/componentes/ZonaUpload";
import { GradeRegistro } from "./GradeRegistro";
import { PainelIcmsIpi } from "./PainelIcmsIpi";
import { RevisaoCorrecoes } from "./RevisaoCorrecoes";
import { TabelaAchados } from "./TabelaAchados";
import { TituloDaTela } from "@/componentes/TituloDaTela";
import { LEIAUTE_CONFERIDO } from "../leiaute/versao";
import { useAbaIcmsIpi } from "./useAbaIcmsIpi";
import type { CodFin } from "../leitura/protocolo";

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

  return (
    <div className="flex flex-col gap-6">
      <TituloDaTela
        titulo="ICMS/IPI — auditoria da escrituração"
        versao={<>EFD ICMS/IPI · Leiaute {LEIAUTE_CONFERIDO}</>}
        descricao="Aponta as divergências da escrituração e regrava o arquivo no mesmo leiaute. Nada é enviado para nenhum servidor."
      />

      {erro && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm text-danger"
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden />
          <div>
            <h2 ref={etapaRef} tabIndex={-1} className="font-semibold focus:outline-none">
              Não deu para ler este arquivo.
            </h2>
            <p className="mt-0.5">{erro}</p>
          </div>
        </div>
      )}

      {aviso && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-success/30 bg-success-soft p-4 text-sm text-success"
        >
          <ShieldCheck size={18} className="mt-0.5 shrink-0" aria-hidden />
          <p className="min-w-0 break-all">{aviso}</p>
        </div>
      )}

      {etapa === "upload" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
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
              descricao={`ou clique para escolher um arquivo .txt de até ${limiteEmMb} MB. O arquivo é processado dentro do seu navegador e não é enviado para nenhum servidor.`}
            />
          </div>
        </div>
      )}

      {progresso && (
        <section
          aria-labelledby="titulo-progresso"
          className="mx-auto flex w-full max-w-xl flex-col gap-4 rounded-xl border border-border-subtle bg-surface-card p-6 text-center shadow-(--shadow-card)"
        >
          <h2
            id="titulo-progresso"
            ref={etapaRef}
            tabIndex={-1}
            className="flex items-center justify-center gap-2 text-lg font-semibold focus:outline-none"
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
            className="h-2.5 w-full overflow-hidden rounded-sm bg-surface-head"
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
            className="mx-auto rounded-lg border border-border-strong px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
          >
            Cancelar leitura
          </button>
        </section>
      )}

      {resumo && !progresso && (
        <>
          <section
            aria-labelledby="titulo-resumo"
            className="flex flex-col gap-4 rounded-xl border border-border-subtle bg-surface-card p-4 shadow-(--shadow-card)"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                  <FileText size={20} aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2
                    id="titulo-resumo"
                    ref={etapaRef}
                    tabIndex={-1}
                    className="truncate font-medium focus:outline-none"
                    title={resumo.empresa}
                  >
                    {resumo.empresa}
                  </h2>
                  <p className="text-xs text-text-tertiary">
                    CNPJ {resumo.cnpj} · {resumo.uf} · período {resumo.periodo} · perfil{" "}
                    {resumo.perfil} · leiaute {resumo.versaoLeiaute}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    {resumo.totalLinhas.toLocaleString("pt-BR")} linhas ·{" "}
                    {achados.length.toLocaleString("pt-BR")}{" "}
                    {achados.length === 1 ? "apontamento" : "apontamentos"}
                    {resumo.codFinOriginal === "1" ? " · o arquivo importado é uma retificadora" : ""}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  acoes.encerrar();
                  requestAnimationFrame(() => zonaRef.current?.focus());
                }}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border-strong px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
              >
                <Trash2 size={16} aria-hidden />
                Encerrar análise
              </button>
            </div>

            <p className="text-xs text-text-tertiary">
              Empresa, CNPJ, UF, período e perfil vêm do registro 0000 do próprio arquivo — a
              ferramenta não pergunta nada sobre o contribuinte.
            </p>

            <p className="text-xs text-text-tertiary">
              Encerrar apaga o arquivo da memória deste navegador. Enquanto a análise estiver aberta,
              os dados do cliente continuam disponíveis para quem usar este computador.
            </p>

            <div className="rounded-lg border border-border-subtle bg-surface-page p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                SHA-256 do arquivo importado
              </p>
              <p className="mt-1 break-all font-mono text-xs text-text-tertiary">{resumo.hash}</p>
              <p className="mt-1 text-xs text-text-tertiary">
                É o hash dos bytes do arquivo como ele veio do disco: confere com{" "}
                <code className="font-mono">sha256sum</code>.
              </p>
            </div>

            {resumo.achadosOmitidos > 0 && (
              <p className="text-xs text-warning">
                {resumo.achadosOmitidos.toLocaleString("pt-BR")} apontamentos repetidos foram
                omitidos: cada código exibe no máximo{" "}
                {limites.ACHADOS_POR_CODIGO.toLocaleString("pt-BR")} ocorrências.
              </p>
            )}
          </section>

          {/*
            A revisão vem ANTES do botão que gera o arquivo.

            A grade também aprova, uma linha por vez, e é onde se confere o
            conserto no contexto do registro. O que faltava era a outra leitura:
            a lista do que vai mudar, agrupada por código, com o motivo e o
            de → para de cada item — e o "aprovar todas" que a grade só oferece
            dentro do recorte. Quem vai assinar precisa poder ler o diff inteiro
            sem caçá-lo coluna a coluna.
          */}
          <RevisaoCorrecoes
            propostas={propostas}
            aprovadas={aprovadas}
            onAlternar={acoes.alternarCorrecao}
            onAlternarCodigo={acoes.alternarPorCodigo}
          />

          <section
            aria-labelledby="titulo-exportacao"
            className="flex flex-col gap-4 rounded-xl border border-border-subtle bg-surface-card p-4 shadow-(--shadow-card)"
          >
            <h2 id="titulo-exportacao" className="text-base font-semibold">
              Gerar o arquivo para o PVA
            </h2>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm text-text-secondary">
                Finalidade da escrituração (campo COD_FIN do registro 0000)
              </legend>

              {(
                [
                  { valor: "0", rotulo: "Original", nota: "Escrituração ainda não entregue para este período." },
                  { valor: "1", rotulo: "Retificadora", nota: "Substitui uma escrituração já entregue ao fisco." },
                ] as const
              ).map((opcao) => (
                <label key={opcao.valor} className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="finalidade"
                    value={opcao.valor}
                    checked={finalidade === opcao.valor}
                    onChange={() => setEscolha({ arquivo: resumo.hash, codFin: opcao.valor })}
                    className="mt-1 accent-accent"
                  />
                  <span>
                    <span className="font-medium">{opcao.rotulo}</span>
                    <span className="block text-xs text-text-tertiary">{opcao.nota}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {finalidade === "1" && resumo.codFinOriginal !== "1" && (
              <p
                role="status"
                className="rounded-lg border border-warning/30 bg-warning-soft p-3 text-xs text-warning"
              >
                O arquivo importado está marcado como original. Gerar uma retificadora só faz sentido
                se esta escrituração já foi entregue — e o arquivo gerado ainda precisa ser validado
                e assinado no PVA antes da transmissão.
              </p>
            )}

            {/*
              OS DOIS BOTÕES BAIXAM ARQUIVOS DIFERENTES, e a confusão entre eles
              é a mais cara que esta tela pode causar: quem aprova correções e
              baixa a cópia fiel leva o arquivo SEM elas — e transmite achando
              que corrigiu. Cada um passou a dizer, embaixo, o que faz.
            */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex min-w-0 flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => acoes.gerarTxt(finalidade)}
                  disabled={gerando}
                  aria-busy={gerando}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-contrast hover:bg-accent-hover disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 transition-colors"
                >
                  {gerando ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden />
                  ) : (
                    <Download size={16} aria-hidden />
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
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-border-strong px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
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

            <p className="text-xs text-text-tertiary">
              O TXT gerado sai no mesmo charset, com a mesma quebra de linha e a mesma estrutura do
              arquivo importado. Mudam os fechamentos de bloco, o bloco 9, a finalidade — e os campos
              das correções que você aprovou, um a um, listados no relatório que acompanha o
              download. Nenhum outro campo é reescrito. Valide no PVA antes de transmitir.
            </p>
          </section>

          <section aria-labelledby="titulo-grade" className="flex flex-col gap-3">
            <h2 id="titulo-grade" className="text-base font-semibold">
              Registros do arquivo
            </h2>
            <GradeRegistro
              worker={worker}
              contagens={resumo.contagemPorRegistro}
              achados={achados}
              propostas={propostas}
              aprovadas={aprovadas}
              onAlternarLinhas={acoes.alternarCorrecoesDeLinhas}
            />
          </section>

          <section aria-labelledby="titulo-achados" className="flex flex-col gap-3">
            <h2 id="titulo-achados" className="text-base font-semibold">
              Apontamentos ({achados.length.toLocaleString("pt-BR")})
            </h2>

            {achados.length === 0 ? (
              <div
                role="status"
                className="flex items-start gap-3 rounded-xl border border-success/30 bg-success-soft p-4 text-sm text-success"
              >
                <ShieldCheck size={18} className="mt-0.5 shrink-0" aria-hidden />
                <p>
                  Nenhum problema encontrado. A estrutura dos registros, o cadastro de itens e
                  participantes, o CFOP e os totalizadores de bloco batem com o layout.
                </p>
              </div>
            ) : (
              <TabelaAchados achados={achados} />
            )}
          </section>
        </>
      )}
    </div>
  );
}
