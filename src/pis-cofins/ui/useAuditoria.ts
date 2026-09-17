import { useCallback, useMemo, useState } from "react";
import { useEstadoMemoria } from "@/ganchos/useEstadoMemoria";
import { useFiltrosColuna } from "@/ganchos/useFiltrosColuna";
import { COLUNAS_AUDITORIA } from "@/pis-cofins/colunas";
import {
  ERRO_LAYOUT,
  auditarLinha,
  corrigirLinhas,
  cstTributadoDe,
  detectarSentido,
  extrairLinhas,
  indexarBase,
  indexarNcm,
  indexarRegrasSemNcm,
  localizarCabecalho,
  resumir,
  type LinhaAuditada,
  type RegimeDeApuracao,
  type Sentido,
  type SentidoDetectado,
} from "@/pis-cofins/auditoria";
import { TAMANHO_MAXIMO, descreverErroDeLeitura, lerAbas, tipoDeArquivo } from "@/pis-cofins/planilha";
import { SEM_CORRECAO } from "@/pis-cofins/ui/CriterioCorrecao";
import type { FiltroAuditoria } from "@/pis-cofins/ui/ResumoAuditoria";
import type { EstadoTabelaNcm } from "@/pis-cofins/ui/useTabelaNcm";
import type { RegraTabelaSped } from "@/tipos/tabelas-receita";

export const PAGINA = 100;

export interface ResultadoAuditoria {
  arquivo: string;
  aba: string;
  linhas: LinhaAuditada[];
  colunasOriginais: string[];
  indiceCstPis?: number;
  indiceCstCofins?: number;
  indiceNatureza?: number;
  /** A ponta da operação com que esta planilha foi lida, e por quê. */
  deteccao: SentidoDetectado;
}

/**
 * `spedPronto` entra como parâmetro porque a auditoria depende de DUAS bases: a
 * nomenclatura NCM e as tabelas do SPED. Quando o hook olhava só o NCM, a zona
 * de upload liberava enquanto as tabelas do SPED ainda carregavam — ou depois
 * de elas falharem —, e a planilha era auditada contra uma base vazia: tudo
 * saía "sem benefício", sem nenhum aviso.
 */
export function useAuditoria(registros: RegraTabelaSped[], ncm: EstadoTabelaNcm, spedPronto: boolean) {
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useEstadoMemoria<string | null>("auditoria_erro", null);
  const [resultado, setResultado] = useEstadoMemoria<ResultadoAuditoria | null>("auditoria_resultado", null);
  const [filtro, setFiltro] = useEstadoMemoria<FiltroAuditoria>("auditoria_filtro", "todos");
  const [visiveis, setVisiveis] = useEstadoMemoria("auditoria_visiveis", PAGINA);
  const [consulta, setConsulta] = useEstadoMemoria("auditoria_consulta", "");
  const [cfopFiltro, setCfopFiltro] = useEstadoMemoria("auditoria_cfopFiltro", "todos");
  const [criterioCorrecao, setCriterioCorrecao] = useEstadoMemoria("auditoria_criterio", SEM_CORRECAO);
  /**
   * A ponta escolhida À MÃO, quando o usuário discorda da detecção.
   *
   * Fica separada do resultado de propósito: trocar a ponta reaudita a mesma
   * planilha em memória, sem pedir o arquivo de novo, e voltar para `null`
   * devolve a decisão à detecção — que é o que ele espera ao abrir outra
   * planilha.
   */
  const [sentidoManual, setSentidoManual] = useEstadoMemoria<Sentido | null>(
    "auditoria_sentido",
    null
  );
  const [regime, setRegime] = useEstadoMemoria<RegimeDeApuracao>(
    "auditoria_regime",
    "nao-cumulativo"
  );

  const indiceBase = useMemo(() => indexarBase(registros), [registros]);
  const indiceSemNcm = useMemo(() => indexarRegrasSemNcm(registros), [registros]);
  const indiceNcm = useMemo(() => (ncm.tabela ? indexarNcm(ncm.tabela.codigos) : null), [ncm.tabela]);

  const pronto = spedPronto && !ncm.carregando;

  const auditar = useCallback(
    async (arquivo: File) => {
      setErro(null);
      setResultado(null);
      setFiltro("todos");
      setVisiveis(PAGINA);
      setConsulta("");
      setCfopFiltro("todos");
      setCriterioCorrecao(SEM_CORRECAO);
      // Planilha nova, detecção nova: a ponta escolhida à mão valia para a
      // anterior, e carregá-la adiante auditaria compras como vendas em silêncio.
      setSentidoManual(null);

      if (arquivo.size === 0) {
        setErro("O arquivo está vazio (0 bytes).");
        return;
      }
      if (arquivo.size > TAMANHO_MAXIMO) {
        setErro(`O arquivo tem ${(arquivo.size / 1024 / 1024).toFixed(1)} MB; o limite é 25 MB.`);
        return;
      }

      setProcessando(true);
      try {
        const buffer = await arquivo.arrayBuffer();
        if (tipoDeArquivo(buffer) === "desconhecido") {
          setErro(
            `"${arquivo.name}" não é uma planilha do Excel de verdade — parece texto ou CSV com a extensão trocada. Exporte novamente em .xls ou .xlsx.`
          );
          return;
        }

        const abas = await lerAbas(buffer);
        const encontrada = abas
          .map((aba) => ({ aba, cabecalho: localizarCabecalho(aba.linhas) }))
          .find((x) => x.cabecalho !== null);
        
        if (!encontrada || !encontrada.cabecalho) {
          setErro(abas.length > 1 ? `${ERRO_LAYOUT} (Nenhuma das ${abas.length} abas tem esse cabeçalho.)` : ERRO_LAYOUT);
          return;
        }

        /*
         * A ponta é decidida ANTES de auditar, sobre as linhas já extraídas: é
         * ela que escolhe contra qual coluna da tabela do SPED cada CST é
         * medido. Auditar primeiro e corrigir depois significaria reprovar a
         * planilha inteira e desfazer.
         */
        const brutas = extrairLinhas(encontrada.aba.linhas, encontrada.cabecalho);
        const deteccao = detectarSentido(brutas, encontrada.cabecalho.colunas.sentidoDeclarado);
        const contexto = {
          base: indiceBase,
          semNcm: indiceSemNcm,
          ncm: indiceNcm,
          hoje: new Date(),
          sentido: deteccao.sentido,
        };
        const linhas = brutas.map((l) => auditarLinha(l, contexto));
        
        if (linhas.length === 0) {
          setErro("A planilha tem o cabeçalho certo, mas nenhuma linha de produto abaixo dele.");
          return;
        }
        
        const cabecalhoOriginal = (encontrada.aba.linhas[encontrada.cabecalho.indice] ?? []).map((c, i) =>
          String(c ?? "").trim() || `Coluna ${i + 1}`
        );

        const { cstPis: indiceCstPis, cstCofins: indiceCstCofins, natureza: indiceNatureza } = encontrada.cabecalho.colunas;

        setResultado({
          arquivo: arquivo.name,
          aba: encontrada.aba.nome,
          linhas,
          colunasOriginais: cabecalhoOriginal,
          indiceCstPis,
          indiceCstCofins,
          indiceNatureza,
          deteccao,
        });
      } catch (excecao) {
        setErro(descreverErroDeLeitura(excecao));
      } finally {
        setProcessando(false);
      }
    },
    [indiceBase, indiceSemNcm, indiceNcm, setErro, setResultado, setFiltro, setVisiveis, setConsulta, setCfopFiltro, setCriterioCorrecao, setSentidoManual]
  );

  /** A ponta que vale agora: a escolha do usuário vence a detecção. */
  const sentido: Sentido = sentidoManual ?? resultado?.deteccao.sentido ?? "saida";

  /**
   * Trocar a ponta REAUDITA a planilha que já está em memória.
   *
   * Sem isso, a troca mudaria só o critério de correção e a lista continuaria
   * mostrando "o SPED indica 06" ao lado de um CST 73 correto — a tela diria
   * uma coisa e a correção faria outra.
   */
  const linhasDaPonta = useMemo(() => {
    if (!resultado) return [];
    if (sentido === resultado.deteccao.sentido) return resultado.linhas;
    const contexto = {
      base: indiceBase,
      semNcm: indiceSemNcm,
      ncm: indiceNcm,
      hoje: new Date(),
      sentido,
    };
    return resultado.linhas.map((l) =>
      auditarLinha(
        {
          linha: l.linha,
          original: l.original,
          nome: l.nome,
          classificacao: l.classificacaoOriginal,
          natureza: l.natureza,
          cstPis: l.cstPis,
          cstCofins: l.cstCofins,
          cfop: l.cfop,
        },
        contexto
      )
    );
  }, [resultado, sentido, indiceBase, indiceSemNcm, indiceNcm]);

  /** O CST que o critério grava nas linhas sem benefício, nesta ponta. */
  const cstTributado = useMemo(() => cstTributadoDe(sentido, regime), [sentido, regime]);

  /**
   * Trocar a ponta ZERA o critério de correção.
   *
   * Os códigos não se traduzem entre as pontas: "CST 06" não existe na
   * aquisição. Manter o critério ligado deixaria a tela oferecendo um alvo que
   * nenhuma linha pode receber — e o resumo diria "0 linhas corrigidas" sem
   * explicar por quê. Zerar obriga a escolher de novo, que é exatamente a
   * decisão que mudou.
   */
  const escolherSentido = useCallback(
    (novo: Sentido | null) => {
      setSentidoManual(novo);
      setCriterioCorrecao(SEM_CORRECAO);
    },
    [setSentidoManual, setCriterioCorrecao]
  );

  const linhasComCorrecao = useMemo(() => {
    if (!resultado) return [];
    if (criterioCorrecao === SEM_CORRECAO) return linhasDaPonta;
    return corrigirLinhas(linhasDaPonta, criterioCorrecao, cstTributado, sentido);
  }, [resultado, linhasDaPonta, criterioCorrecao, cstTributado, sentido]);

  const correcaoAtiva = criterioCorrecao !== SEM_CORRECAO;

  const linhasQueDivergiam = useMemo(
    () => new Set(linhasDaPonta.filter((l) => l.destaque === "amarelo").map((l) => l.linha)),
    [linhasDaPonta]
  );

  const resumo = useMemo(() => {
    if (linhasComCorrecao.length === 0) return null;
    const contado = resumir(linhasComCorrecao);
    if (!correcaoAtiva) return contado;
    return {
      ...contado,
      divergencias: linhasQueDivergiam.size,
      coerente: linhasComCorrecao.filter(
        (l) => !linhasQueDivergiam.has(l.linha) && l.situacao !== "invalido"
      ).length,
    };
  }, [linhasComCorrecao, correcaoAtiva, linhasQueDivergiam]);

  const filtradas = useMemo(() => {
    switch (filtro) {
      case "beneficio":
      case "possivel":
      case "tributado":
      case "invalido":
        return linhasComCorrecao.filter((l) => l.situacao === filtro);
      case "divergencias":
        return linhasComCorrecao.filter((l) =>
          correcaoAtiva ? linhasQueDivergiam.has(l.linha) : l.destaque === "amarelo"
        );
      case "coerente":
        return linhasComCorrecao.filter(
          (l) =>
            l.situacao !== "invalido" &&
            (correcaoAtiva ? !linhasQueDivergiam.has(l.linha) : l.destaque === "nenhum")
        );
      default:
        return linhasComCorrecao;
    }
  }, [linhasComCorrecao, filtro, correcaoAtiva, linhasQueDivergiam]);

  const filtradasEBusca = useMemo(() => {
    return filtradas.filter((l) => {
      if (consulta) {
        const termo = consulta.toLowerCase();
        const textoLinha = `${l.nome} ${l.ncm} ${l.classificacaoOriginal} ${l.descricaoNcm || ""} ${l.observacoes.join(" ")}`.toLowerCase();
        if (!textoLinha.includes(termo)) return false;
      }
      if (cfopFiltro !== "todos") {
        if (l.cfop !== cfopFiltro) return false;
      }
      return true;
    });
  }, [filtradas, consulta, cfopFiltro]);

  const opcoesCfop = useMemo(() => {
    if (!resultado) return [];
    const cfops = new Set<string>();
    linhasDaPonta.forEach((l) => {
      if (l.cfop) cfops.add(l.cfop);
    });
    return Array.from(cfops).sort();
  }, [resultado, linhasDaPonta]);

  const hookColunas = useFiltrosColuna(
    filtradasEBusca,
    COLUNAS_AUDITORIA,
    "auditoria_filtrosColuna",
    () => setVisiveis(PAGINA)
  );

  const exibidas = hookColunas.itensFiltrados.slice(0, visiveis);
  const restantes = hookColunas.itensFiltrados.length - exibidas.length;

  const contagensCorrecao = useMemo(() => {
    if (criterioCorrecao === SEM_CORRECAO) return { totalBeneficio: 0, totalTributado: 0, totalMantidas: 0 };
    const beneficio = linhasComCorrecao.filter((l) => l.cstCorrigido === criterioCorrecao).length;
    // O CST de "sem benefício" não é fixo: é 01 na saída e 50 ou 70 na entrada,
    // conforme o regime. Contar "01" aqui zerava o número na aba de compras.
    const tributado = linhasComCorrecao.filter((l) => l.cstCorrigido === cstTributado).length;
    const mantidas = linhasComCorrecao.filter(
      (l) => l.cstCorrigido === undefined && l.situacao !== "invalido"
    ).length;
    return { totalBeneficio: beneficio, totalTributado: tributado, totalMantidas: mantidas };
  }, [criterioCorrecao, linhasComCorrecao, cstTributado]);

  const aoFiltrar = useCallback(
    (novo: FiltroAuditoria) => {
      setFiltro(novo);
      setVisiveis(PAGINA);
    },
    [setFiltro, setVisiveis]
  );

  const aoBuscar = useCallback(
    (valor: string) => {
      setConsulta(valor);
      setVisiveis(PAGINA);
    },
    [setConsulta, setVisiveis]
  );

  function reiniciar() {
    setResultado(null);
    setErro(null);
    setFiltro("todos");
    setVisiveis(PAGINA);
    setCriterioCorrecao(SEM_CORRECAO);
    setConsulta("");
    setCfopFiltro("todos");
    hookColunas.limpar();
  }

  const filtrosAtivos = Object.entries(hookColunas.filtros).map(([id, valores]) => ({
    id,
    rotulo: COLUNAS_AUDITORIA.find((c) => c.id === id)?.rotulo ?? id,
    valores: valores as string[],
    onRemover: () => hookColunas.definir(id, null),
  }));

  const [exportando, setExportando] = useState(false);

  async function exportar() {
    if (!resultado) return;
    setExportando(true);
    try {
      const colunasCliente = resultado.colunasOriginais;
      const { baixarArquivo, gerarXlsx } = await import('@/pis-cofins/planilha');
      const linhasParaExport = correcaoAtiva
        ? corrigirLinhas(linhasDaPonta, criterioCorrecao, cstTributado, sentido)
        : linhasDaPonta;

      const COLUNAS_AUDITORIA_EXPORT = [
        "Linha",
        "NCM (8 dígitos)",
        "Situação",
        "Benefício SPED",
        "Tabela SPED",
        "CST sugerido",
        "Natureza sugerida",
        "Regra do SPED",
        "Vigência da regra",
        "Descrição NCM (Siscomex)",
        "Observações",
      ];

      const cabecalho = [...colunasCliente, ...COLUNAS_AUDITORIA_EXPORT];
      const linhas = linhasParaExport.map((l) => [
        ...colunasCliente.map((_, i) => {
          let celula = l.original[i];
          if (
            correcaoAtiva &&
            l.cstCorrigido !== undefined &&
            l.cstCorrigido !== ""
          ) {
            if (i === resultado.indiceCstPis || i === resultado.indiceCstCofins) {
              celula = l.cstCorrigido;
            } else if (i === resultado.indiceNatureza && l.naturezaCorrigida !== undefined) {
              celula = l.naturezaCorrigida;
            }
          }
          return celula === undefined || celula === null ? "" : celula;
        }),
        l.linha,
        l.ncm,
        l.rotulo,
        l.regra?.rotulo ?? "",
        l.regra?.tabela ?? "",
        correcaoAtiva && l.cstCorrigido ? l.cstCorrigido : (l.regra?.cstsAceitos.join(" ou ") ?? ""),
        correcaoAtiva && l.naturezaCorrigida !== undefined && l.cstCorrigido
          ? l.naturezaCorrigida
          : (l.regra?.naturezas.join(" ou ") ?? ""),
        l.regra?.descricao ?? "",
        l.regra ? `${l.regra.inicio ?? ""}${l.regra.fim ? ` a ${l.regra.fim}` : l.regra.inicio ? " (vigente)" : ""}` : "",
        l.descricaoNcm ?? "",
        l.observacoes.join(" "),
      ]);
      const bytes = await gerarXlsx(
        [cabecalho, ...linhas],
        "Auditoria",
        [...colunasCliente.map(() => 22), 7, 14, 22, 22, 10, 12, 14, 60, 22, 50, 70]
      );
      const base = resultado.arquivo.replace(/\.(xlsx?|csv)$/i, "");
      const sufixo = correcaoAtiva ? `-cst${criterioCorrecao}` : "";
      baixarArquivo(bytes, `auditoria${sufixo}-${base}.xlsx`);
    } finally {
      setExportando(false);
    }
  }

  return {
    estado: {
      processando,
      exportando,
      erro,
      resultado,
      filtro,
      visiveis,
      consulta,
      cfopFiltro,
      criterioCorrecao,
      pronto,
      /** A ponta que vale agora — detectada ou escolhida à mão. */
      sentido,
      /** Verdadeiro quando a ponta veio de uma escolha do usuário. */
      sentidoManual: sentidoManual !== null,
      regime,
      /** O CST que o critério grava nas linhas sem benefício, nesta ponta. */
      cstTributado,
    },
    dados: { resumo, linhasComCorrecao, exibidas, restantes, opcoesCfop, correcaoAtiva, linhasQueDivergiam, totalExibiveis: hookColunas.itensFiltrados.length, ...contagensCorrecao },
    acoes: {
      auditar,
      aoFiltrar,
      aoBuscar,
      reiniciar,
      exportar,
      setCriterioCorrecao,
      setCfopFiltro,
      setVisiveis,
      setSentido: escolherSentido,
      setRegime,
    },
    colunas: { ...hookColunas, filtrosAtivos }
  };
}
