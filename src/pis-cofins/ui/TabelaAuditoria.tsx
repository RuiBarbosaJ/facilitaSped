"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  ROTULO_STATUS_NATUREZA,
  statusNatureza,
  type LinhaAuditada,
  type StatusNatureza,
} from "@/pis-cofins/auditoria";
import type { ColunaAuditoria } from "@/pis-cofins/colunas";
import type { FiltrosColuna } from "@/comum/filtrosColuna";
import { DescricaoExpandivel } from "@/componentes/DescricaoExpandivel";
import { FiltroColuna } from "@/componentes/FiltroColuna";
import { NavegacaoLateral } from "@/componentes/NavegacaoLateral";
import { formatarNcm } from "@/comum/ncm";

interface TabelaAuditoriaProps {
  /** Só a fatia que deve ser exibida. */
  linhas: LinhaAuditada[];
  colunas: ColunaAuditoria[];
  filtros: FiltrosColuna;
  opcoesDe: (id: string) => string[];
  onFiltrar: (id: string, valores: string[] | null) => void;
  /** Quando true, a coluna "Informado" exibe o CST corrigido ao lado do original. */
  criterioCorrecaoAtivo?: boolean;
  /** O que vem depois da última linha, dentro da área que rola ("Mostrar mais"). */
  rodape?: ReactNode;
}

/**
 * Além do fundo, uma borda à esquerda: no tema escuro os tons suaves quase se
 * confundem com a superfície, e a borda garante que a linha se destaque. Fina:
 * ela marca a linha, não a emoldura.
 */
const ESTILO_LINHA: Record<LinhaAuditada["destaque"], string> = {
  nenhum: "border-l-2 border-l-transparent hover:bg-surface-hover/60",
  amarelo: "bg-warning-soft/70 border-l-2 border-l-warning",
  vermelho: "bg-danger-soft/70 border-l-2 border-l-danger",
};

/** O status da natureza repete o texto da opção de filtro — verde quando o
 *  critério resolveu a linha, vermelho quando invalidou a natureza informada. */
const ESTILO_STATUS_NATUREZA: Record<StatusNatureza, string> = {
  corrigida: "text-success",
  coerente: "text-success",
  invalida: "text-danger",
};

/**
 * A situação da linha: um ponto colorido e o nome. Era uma pastilha de fundo
 * cheio em toda linha — numa planilha de novecentos produtos, novecentas
 * pastilhas, e a cor deixava de separar uma situação da outra.
 */
const COR_SITUACAO: Record<LinhaAuditada["situacao"], { ponto: string; texto: string }> = {
  beneficio: { ponto: "bg-success", texto: "text-text-primary" },
  possivel: { ponto: "bg-accent", texto: "text-accent" },
  tributado: { ponto: "bg-text-tertiary", texto: "text-text-secondary" },
  invalido: { ponto: "bg-danger", texto: "text-danger font-medium" },
};

/** O NCM como se lê na TIPI; o que não tem oito dígitos aparece como veio. */
function ncmParaLer(ncm: string): string {
  return ncm.length === 8 ? formatarNcm(ncm) : ncm;
}

function Codigo({ valor }: { valor: string }) {
  return valor ? (
    <span className="font-mono">{valor}</span>
  ) : (
    <span className="text-text-tertiary">—</span>
  );
}

/** Mostra o CST original e, quando a correção está ativa, o corrigido ao lado. */
function CelulaCst({
  cstPis,
  cstCofins,
  cfop,
  cstCorrigido,
  criterioAtivo,
}: {
  cstPis: string;
  cstCofins: string;
  cfop: string;
  cstCorrigido?: string;
  criterioAtivo: boolean;
}) {
  const mudou =
    criterioAtivo &&
    cstCorrigido !== undefined &&
    cstCorrigido !== "" &&
    (cstPis !== cstCorrigido || cstCofins !== cstCorrigido);

  return (
    <div className="flex flex-col gap-0.5">
      {/* CST PIS / COFINS */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-xs text-text-tertiary">CST </span>
        {mudou ? (
          <>
            <span className="font-mono line-through text-text-tertiary">
              {cstPis || "—"}
            </span>
            <span className="text-text-tertiary">/</span>
            <span className="font-mono line-through text-text-tertiary">
              {cstCofins || "—"}
            </span>
            <span className="mx-1 text-text-tertiary" aria-hidden>→</span>
            <span className="sr-only">corrigido para</span>
            <span className="font-mono font-semibold text-success">
              {cstCorrigido}
            </span>
          </>
        ) : (
          <>
            <Codigo valor={cstPis} />{" "}
            <span className="text-text-tertiary">/</span>{" "}
            <Codigo valor={cstCofins} />
          </>
        )}
      </div>

      {/* CFOP */}
      {cfop && (
        <div>
          <span className="text-xs text-text-tertiary">CFOP </span>
          <Codigo valor={cfop} />
        </div>
      )}

      {/* NCM inválido não corrigido: o critério não tem o que gravar. */}
      {criterioAtivo && cstCorrigido === "" && (
        <span className="text-xs text-danger">NCM inválido — sem correção</span>
      )}
    </div>
  );
}

/**
 * A natureza da receita como a planilha trouxe, o que o SPED indica para o NCM
 * e, com o critério de correção ligado, o que ele fez com ela.
 *
 * A natureza sugerida vem junto porque é aqui que ela se compara com a
 * informada — na coluna "Sugestão do SPED" ela fica longe do número do cliente.
 * O selo usa o mesmo texto que o menu da coluna oferece como filtro, então
 * marcar "Natureza Corrigida" devolve exatamente as linhas que mostram o selo.
 */
function CelulaNatureza({
  natureza,
  naturezaCorrigida,
  sugeridas,
  status,
}: {
  natureza: string;
  naturezaCorrigida?: string;
  /** Naturezas que o SPED admite para o NCM — as mesmas da regra sugerida. */
  sugeridas: string[];
  status: StatusNatureza | null;
}) {
  // Só há transição a mostrar quando o valor mudou: "corrigida" troca o código,
  // "invalida" apaga o que a planilha trazia. "coerente" repetiria o mesmo
  // número dos dois lados da seta.
  const mudou = status === "corrigida" || status === "invalida";

  // Só o que a célula ainda não mostra: numa linha já coerente o SPED indica
  // justamente o número que está ali, e repeti-lo embaixo não diz nada.
  const naTela = new Set([natureza, naturezaCorrigida].filter(Boolean));
  const aIndicar = sugeridas.filter((n) => n && !naTela.has(n));

  // O critério teve de ESCOLHER entre naturezas vigentes diferentes porque a
  // planilha não informou nenhuma delas. O número aplicado é um palpite
  // razoável, não um fato — e quem assina a escrituração precisa saber disso.
  const escolhaIncerta =
    status === "corrigida" && sugeridas.length > 1 && !sugeridas.includes(natureza);

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1 flex-wrap">
        {mudou ? (
          <>
            <span className="font-mono line-through text-text-tertiary">
              {natureza || "—"}
            </span>
            <span className="text-text-tertiary">→</span>
            <span className={`font-mono font-semibold ${naturezaCorrigida ? "text-success" : "text-text-tertiary"}`}>
              {naturezaCorrigida || "vazia"}
            </span>
          </>
        ) : (
          <Codigo valor={natureza} />
        )}
      </div>

      {aIndicar.length > 0 && (
        <div className={`text-xs ${escolhaIncerta ? "text-warning" : "text-text-tertiary"}`}>
          SPED: <span className="font-mono">{aIndicar.join(" / ")}</span>
          {escolhaIncerta && " — confira"}
        </div>
      )}

      {status && (
        <span className={`text-xs ${ESTILO_STATUS_NATUREZA[status]}`}>
          {ROTULO_STATUS_NATUREZA[status]}
        </span>
      )}
    </div>
  );
}

/**
 * Texto de apoio numa linha só, que se abre ao clique.
 *
 * A descrição oficial do NCM e a da regra do SPED ocupavam duas linhas cada,
 * mais um "Ver mais" numa terceira — e eram elas, não o dado conferido, que
 * faziam cada produto ocupar 110px. Uma linha basta para reconhecer o texto; o
 * resto está a um clique, no próprio texto, sem um botão a mais por célula.
 */
function TextoDeApoio({ texto }: { texto: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setAberto(!aberto)}
      aria-expanded={aberto}
      title={aberto ? undefined : texto}
      className="block w-full rounded-sm text-left text-xs text-text-tertiary transition-colors hover:text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span className={aberto ? "" : "line-clamp-1"}>{texto}</span>
    </button>
  );
}

/** Quantas observações a linha mostra antes de pedir para expandir. */
const OBSERVACOES_A_VISTA = 2;

/**
 * As observações da linha: as primeiras à vista, o resto sob demanda.
 *
 * Esta era a célula mais alta da tabela. Cinco observações empilhadas faziam
 * uma linha de 236px, e a caixa inteira cabia quatro produtos — para conferir
 * uma planilha de novecentas linhas, quatro por tela é rolagem, não leitura.
 *
 * Duas já respondem o que a varredura pergunta ("esta linha tem problema, e de
 * que tipo?"); as outras são detalhe de quem parou naquela linha para decidir.
 * O botão conta quantas ficaram, então ninguém precisa expandir para saber se
 * vale a pena.
 */
function Observacoes({ itens }: { itens: string[] }) {
  const [expandido, setExpandido] = useState(false);

  if (itens.length === 0) {
    return <span className="text-xs text-success">Coerente com o SPED</span>;
  }

  const escondidas = itens.length - OBSERVACOES_A_VISTA;
  const visiveis = expandido ? itens : itens.slice(0, OBSERVACOES_A_VISTA);

  return (
    <div className="flex flex-col items-start gap-1">
      <ul className="flex flex-col gap-0.5 text-xs text-text-secondary">
        {visiveis.map((o) => (
          <li key={o}>{o}</li>
        ))}
      </ul>
      {escondidas > 0 && (
        <button
          type="button"
          onClick={() => setExpandido(!expandido)}
          className="rounded text-xs font-medium text-accent transition-colors hover:text-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {expandido ? "Ver menos" : `Ver mais (+${escondidas})`}
        </button>
      )}
    </div>
  );
}

/** Auditoria linha a linha. Vermelho = NCM inválido; amarelo = divergência. */
export function TabelaAuditoria({
  linhas,
  colunas,
  filtros,
  opcoesDe,
  onFiltrar,
  criterioCorrecaoAtivo = false,
  rodape,
}: TabelaAuditoriaProps) {
  const areaRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative overflow-hidden rounded-lg border border-border-subtle bg-surface-card">
      <div
        ref={areaRef}
        className="custom-scrollbar overflow-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
        style={{ maxHeight: "var(--altura-tabela)" }}
        role="region"
        aria-label="Resultado da auditoria"
        tabIndex={0}
      >
        <table className="min-w-full text-left text-sm">
          <caption className="sr-only">
            Auditoria linha a linha: linhas vermelhas têm NCM inválido;
            amarelas, divergência entre o informado e o SPED.
          </caption>
          <thead>
            <tr>
              {colunas.map((coluna, i) => (
                <th
                  key={coluna.id}
                  scope="col"
                  className="sticky top-0 z-10 bg-surface-card px-3 py-2 text-left align-middle text-xs font-medium whitespace-nowrap text-text-secondary shadow-[inset_0_-1px_0_var(--border-subtle)] first:pl-4"
                >
                  <div className="flex items-center gap-1">
                    <span>
                      {coluna.rotulo === "Informado" && criterioCorrecaoAtivo
                        ? "Informado → Corrigido"
                        : coluna.rotulo}
                    </span>
                    {coluna.valores && (
                      <FiltroColuna
                        rotulo={coluna.rotulo}
                        opcoes={opcoesDe(coluna.id)}
                        selecionados={filtros[coluna.id]}
                        onChange={(valores) => onFiltrar(coluna.id, valores)}
                        alinharDireita={i >= colunas.length / 2}
                      />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td
                  colSpan={colunas.length}
                  className="h-[400px] px-6 text-center align-middle text-text-secondary"
                >
                  <p className="text-sm font-medium text-text-primary">
                    Nenhuma linha neste recorte.
                  </p>
                  <p className="mt-1 text-sm text-text-tertiary">
                    Volte para &ldquo;Todas as linhas&rdquo; na coluna Situação, ou
                    revise a busca, o CFOP e os filtros das colunas.
                  </p>
                </td>
              </tr>
            ) : (
              linhas.map((l) => (
                <tr
                  key={l.linha}
                  className={`border-b border-border-subtle align-top transition-colors last:border-b-0 ${ESTILO_LINHA[l.destaque]}`}
                >
                  <td className="px-3 py-2 pl-4 whitespace-nowrap font-mono text-xs text-text-tertiary tabular-nums">
                    {l.linha}
                  </td>

                  <td className="px-3 py-2 min-w-[200px] max-w-56 lg:max-w-md xl:max-w-xl 2xl:max-w-3xl">
                    <DescricaoExpandivel
                      texto={l.nome}
                      limiteCaracteres={100}
                      className="text-text-primary"
                      destacar={false}
                    />
                    {/*
                      A descrição oficial do NCM, sem realce: o realce de termos
                      pintava "NCM" de pastilha em toda linha da tabela.
                    */}
                    {l.descricaoNcm && (
                      <div className="mt-0.5">
                        <TextoDeApoio texto={l.descricaoNcm} />
                      </div>
                    )}
                  </td>

                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="font-mono text-[13px] text-text-primary">
                      {l.ncm ? ncmParaLer(l.ncm) : l.classificacaoOriginal || "—"}
                    </span>
                    {l.ncm &&
                      l.classificacaoOriginal.replace(/\D/g, "") !== l.ncm && (
                        <div className="mt-0.5 text-xs text-text-tertiary">
                          de &quot;{l.classificacaoOriginal}&quot;
                        </div>
                      )}
                  </td>

                  {/* Coluna "Informado → Corrigido" quando critério ativo */}
                  <td className="px-3 py-2 whitespace-nowrap text-text-secondary">
                    <CelulaCst
                      cstPis={l.cstPis}
                      cstCofins={l.cstCofins}
                      cfop={l.cfop}
                      cstCorrigido={l.cstCorrigido}
                      criterioAtivo={criterioCorrecaoAtivo}
                    />
                  </td>

                  {/* Coluna "Nat. Receita" */}
                  <td className="px-3 py-2 whitespace-nowrap text-text-secondary">
                    <CelulaNatureza
                      natureza={l.natureza}
                      naturezaCorrigida={l.naturezaCorrigida}
                      sugeridas={l.regra?.naturezas ?? []}
                      status={statusNatureza(l)}
                    />
                  </td>

                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 text-sm ${COR_SITUACAO[l.situacao].texto}`}>
                      <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${COR_SITUACAO[l.situacao].ponto}`} />
                      {l.rotulo}
                    </span>
                    {/* Quando o critério está ativo e a linha tem um CST corrigido
                        (seja para o benefício ou para tributado), o status final
                        é "Coerente com o critério" — a decisão já foi tomada. */}
                    {/* Linha preservada: o critério não a tocou porque o NCM tem
                        regime próprio vigente que admite o CST informado. */}
                    {criterioCorrecaoAtivo &&
                      l.cstCorrigido === undefined &&
                      l.situacao !== "invalido" && (
                        <div className="mt-0.5 text-xs text-text-tertiary">
                          Fora do critério — mantida
                        </div>
                      )}
                    {criterioCorrecaoAtivo &&
                      l.cstCorrigido !== undefined &&
                      l.situacao !== "invalido" && (
                        <div className="mt-0.5 text-xs text-success">
                          Coerente com o critério
                        </div>
                      )}
                  </td>

                  <td className="px-3 py-2 min-w-48 max-w-72">
                    {/* Com o critério ligado, a linha requalificada não mostra mais a
                        regra das outras tabelas: o critério mandou ignorá-las, e
                        exibir "CST 03/04" ao lado de um CST corrigido para 01 (ou 06)
                        só faz o contador duvidar da correção que ele mesmo pediu. */}
                    {criterioCorrecaoAtivo && l.cstCorrigido === "01" ? (
                      <span className="text-xs text-success">
                        Tratado como tributado (CST 01)
                      </span>
                    ) : l.regra ? (
                      <div className="flex flex-col gap-0.5">
                        {/*
                          A regra numa linha de texto: os códigos em mono, sem
                          pastilha. "CST 06 · nat. 105 · 4.3.13" se lê de uma vez;
                          as três pastilhas que havia ali se liam como botões.
                        */}
                        <div className="text-xs whitespace-nowrap text-text-tertiary">
                          CST{" "}
                          <span className="font-mono font-medium text-text-primary">
                            {l.regra.cstsAceitos.join(" ou ")}
                          </span>
                          {l.regra.naturezas.length > 0 && (
                            <>
                              {" · nat. "}
                              <span className="font-mono font-medium text-text-primary">
                                {l.regra.naturezas.join(" / ")}
                              </span>
                            </>
                          )}
                          {" · tabela "}
                          {l.regra.tabela}
                        </div>
                        <TextoDeApoio texto={l.regra.descricao} />
                      </div>
                    ) : (
                      <span className="text-text-tertiary">—</span>
                    )}
                  </td>

                  <td className="px-3 py-2 min-w-64 max-w-md">
                    <Observacoes itens={l.observacoes} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {rodape}
      </div>

      <NavegacaoLateral area={areaRef} />
    </div>
  );
}
