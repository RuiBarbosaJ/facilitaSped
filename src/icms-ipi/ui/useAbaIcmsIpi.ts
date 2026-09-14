"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { esquecerEstadoMemoria, useEstadoMemoria } from "@/ganchos/useEstadoMemoria";
import { LIMITES } from "../limites";
import type { Achado } from "@/regras/nucleo/contrato";
import type { CodFin, DoWorker, ParaWorker, ResumoArquivo } from "../leitura/protocolo";

export interface ProgressoLeitura {
  bytesLidos: number;
  bytesTotal: number;
  linhas: number;
}

/** Prefixo de todas as chaves de estado desta aba, para poder esquecê-las juntas. */
const PREFIXO_ESTADO = "icms_ipi_";

/**
 * O worker é compartilhado entre montagens.
 *
 * Sair para outra aba e voltar não pode custar um novo parse de 150 MB, então o
 * worker (e a árvore do SPED dentro dele) sobrevive à desmontagem. O preço
 * disso é que a memória só é devolvida quando alguém manda encerrar — daí
 * `encerrarWorker` existir e a tela oferecer o botão que o chama.
 */
let workerCompartilhado: Worker | null = null;

/**
 * O arquivo importado nesta visita, para poder devolvê-lo byte a byte.
 *
 * Fica ao lado do worker, e não numa ref do componente, porque a vida dele é a
 * da sessão de análise — não a da montagem da tela. Guardado numa ref, sair
 * para outra aba e voltar deixava o botão de cópia fiel habilitado com o
 * arquivo já perdido.
 */
let arquivoDaSessao: File | null = null;

function obterWorker(): Worker {
  workerCompartilhado ??= new Worker(new URL("../leitura/icms-ipi.worker.ts", import.meta.url), {
    type: "module",
  });
  return workerCompartilhado;
}

function encerrarWorker(): void {
  workerCompartilhado?.terminate();
  workerCompartilhado = null;
  arquivoDaSessao = null;
}

export function useAbaIcmsIpi() {
  /*
   * O worker nasce no inicializador do useState, não num efeito: chamar
   * setState dentro de um efeito só para publicar o worker provocava um render
   * em cascata a cada montagem. No servidor não há `window`, e nesse render
   * ninguém precisa do worker.
   *
   * O SETTER é obrigatório, e a falta dele custou caro: "Encerrar análise"
   * chama `encerrarWorker()`, que termina o worker e zera a variável de módulo
   * — mas o componente continuava segurando a instância JÁ TERMINADA, porque
   * ela fora capturada uma única vez aqui. O próximo arquivo importado era
   * postado num worker morto: nenhum erro, nenhuma resposta, a barra parada em
   * 0% para sempre. A aba inteira ficava inutilizável até alguém recarregar a
   * página, e nada na tela dizia por quê — logo depois de apertar justamente o
   * botão que a tela anuncia como garantia de privacidade.
   */
  const [worker, setWorker] = useState<Worker | null>(() =>
    typeof window === "undefined" ? null : obterWorker()
  );

  const [progresso, setProgresso] = useEstadoMemoria<ProgressoLeitura | null>(
    "icms_ipi_progresso",
    null
  );
  const [resumo, setResumo] = useEstadoMemoria<ResumoArquivo | null>("icms_ipi_resumo", null);
  const [achados, setAchados] = useEstadoMemoria<Achado[]>("icms_ipi_achados", []);
  const [erro, setErro] = useEstadoMemoria<string | null>("icms_ipi_erro", null);
  const [gerando, setGerando] = useEstadoMemoria("icms_ipi_gerando", false);
  const [aviso, setAviso] = useEstadoMemoria<string | null>("icms_ipi_aviso", null);

  /** Espelha `arquivoDaSessao` para a tela, sem ler uma ref durante o render. */
  const [temArquivoOriginal, setTemArquivoOriginal] = useEstadoMemoria(
    "icms_ipi_tem_original",
    false
  );
  const requisicaoRef = useRef(0);

  useEffect(() => {
    if (!worker) return;

    const aoReceber = (evento: MessageEvent<DoWorker>) => {
      const msg = evento.data;

      switch (msg.tipo) {
        case "PROGRESSO":
          setProgresso({
            bytesLidos: msg.bytesLidos,
            bytesTotal: msg.bytesTotal,
            linhas: msg.linhas,
          });
          return;

        case "PRONTO":
          setProgresso(null);
          setResumo(msg.resumo);
          setAchados(msg.achados);
          setErro(null);
          return;

        case "CANCELADO":
          setProgresso(null);
          setGerando(false);
          arquivoDaSessao = null;
          setTemArquivoOriginal(false);
          return;

        case "ERRO":
          setErro(msg.mensagem);
          setProgresso(null);
          setGerando(false);
          return;

        case "TXT_OK": {
          setGerando(false);
          baixar(msg.blob, msg.nomeSugerido);
          setAviso(
            `Arquivo ${msg.nomeSugerido} gerado. SHA-256 do arquivo exportado: ${msg.hash}`
          );
          return;
        }
      }
    };

    worker.addEventListener("message", aoReceber);
    return () => worker.removeEventListener("message", aoReceber);
  }, [worker, setProgresso, setResumo, setAchados, setErro, setGerando, setAviso, setTemArquivoOriginal]);

  const enviar = useCallback(
    (mensagem: ParaWorker) => {
      worker?.postMessage(mensagem);
    },
    [worker]
  );

  const importar = useCallback(
    (arquivo: File) => {
      /*
       * Os filtros da grade moram no store de memória e sobrevivem à troca de
       * arquivo. Sem esta limpeza, quem filtrou CFOP 5102 em janeiro abria
       * fevereiro numa grade vazia, sem nenhum filtro visível para desfazer.
       */
      esquecerEstadoMemoria("icms_ipi_grade_");

      arquivoDaSessao = arquivo;
      setTemArquivoOriginal(true);
      setErro(null);
      setAviso(null);
      setResumo(null);
      setAchados([]);
      setProgresso({ bytesLidos: 0, bytesTotal: arquivo.size, linhas: 0 });
      enviar({ tipo: "INICIAR", arquivo });
    },
    [enviar, setErro, setAviso, setResumo, setAchados, setProgresso, setTemArquivoOriginal]
  );

  const cancelar = useCallback(() => {
    enviar({ tipo: "CANCELAR" });
    setProgresso(null);
    setGerando(false);
    arquivoDaSessao = null;
    setTemArquivoOriginal(false);
  }, [enviar, setProgresso, setGerando, setTemArquivoOriginal]);

  /**
   * Encerra a análise e devolve a memória.
   *
   * Não é um "limpar tela": o worker é terminado, então o arquivo do cliente —
   * razão social, CNPJ, cadastro de participantes com CPF e endereço — deixa de
   * existir na aba. É o que torna honesta a frase "processado no seu navegador"
   * numa máquina de escritório compartilhada.
   */
  const encerrar = useCallback(() => {
    enviar({ tipo: "LIMPAR" });
    encerrarWorker();
    /*
     * Um worker novo, limpo, no lugar do que acabou de ser terminado.
     *
     * Sem isto a aba fica muda: o componente seguraria a instância morta e todo
     * arquivo importado depois seria postado nela. Recriar aqui devolve a aba
     * ao mesmo estado em que ela abre — e o worker novo não conhece nada da
     * escrituração anterior, que é exatamente o ponto deste botão.
     */
    setWorker(obterWorker());
    esquecerEstadoMemoria(PREFIXO_ESTADO);
    setResumo(null);
    setAchados([]);
    setProgresso(null);
    setErro(null);
    setAviso(null);
    setGerando(false);
  }, [enviar, setResumo, setAchados, setProgresso, setErro, setAviso, setGerando]);

  const gerarTxt = useCallback(
    (codFin: CodFin) => {
      setAviso(null);
      setGerando(true);
      requisicaoRef.current += 1;
      enviar({ tipo: "GERAR_TXT", requisicao: requisicaoRef.current, codFin });
    },
    [enviar, setAviso, setGerando]
  );

  /** Devolve o arquivo exatamente como ele entrou, sem passar pela regravação. */
  const baixarCopiaFiel = useCallback(() => {
    const arquivo = arquivoDaSessao;
    if (!arquivo) {
      setAviso(
        "A cópia fiel só fica disponível na mesma visita em que o arquivo foi importado. Importe-o novamente para baixá-la."
      );
      return;
    }
    baixar(arquivo, arquivo.name);
  }, [setAviso]);

  return {
    worker,
    estado: { progresso, resumo, achados, erro, aviso, gerando },
    /** Verdadeiro quando a cópia fiel do arquivo ainda está ao alcance. */
    temArquivoOriginal,
    acoes: { importar, cancelar, encerrar, gerarTxt, baixarCopiaFiel, setAviso },
    limites: LIMITES,
  };
}

function baixar(dados: Blob, nome: string): void {
  const url = URL.createObjectURL(dados);
  const ancora = document.createElement("a");
  ancora.href = url;
  ancora.download = nome;
  document.body.appendChild(ancora);
  ancora.click();
  ancora.remove();
  // O revoke imediato cancelava o download em alguns navegadores; um quadro é
  // suficiente para o clique ser processado.
  requestAnimationFrame(() => URL.revokeObjectURL(url));
}
