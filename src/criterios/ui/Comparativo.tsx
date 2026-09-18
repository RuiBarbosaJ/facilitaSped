/** Uma linha do comparativo: a pergunta e a resposta de cada tela. */
interface Linha {
  pergunta: string;
  tabelas: string;
  pisCofins: string;
  icmsIpi: string;
}

const LINHAS: Linha[] = [
  {
    pergunta: "O que entra",
    tabelas: "Nada. A tela já vem com as tabelas carregadas.",
    pisCofins: "A planilha de produtos do ERP (.xlsx ou .csv), com NCM e CST.",
    icmsIpi: "O arquivo .txt da EFD ICMS/IPI, o mesmo que vai ao PVA.",
  },
  {
    pergunta: "Contra o que se confere",
    tabelas: "—",
    pisCofins: "Tabelas 4.3.10 a 4.3.16 do SPED e a nomenclatura NCM vigente (Siscomex).",
    icmsIpi: "Guia Prático da EFD, Tabelas A e B do Convênio s/nº de 1970 e a tabela de CFOP.",
  },
  {
    pergunta: "O que sai",
    tabelas: "A consulta na tela, exportável em XLSX ou CSV.",
    pisCofins: "A mesma planilha, com as colunas de CST e natureza corrigidas.",
    icmsIpi: "Os apontamentos linha a linha e o TXT corrigido, no mesmo leiaute.",
  },
  {
    pergunta: "Corrige sozinho?",
    tabelas: "Não corrige nada — é consulta.",
    pisCofins: "Sim, pelo critério de regime que você escolher. Linha por linha, revisável.",
    icmsIpi: "Só o que o próprio arquivo já determina. O resto vira sugestão que espera aprovação.",
  },
  {
    pergunta: "Precisa de internet",
    tabelas: "Para baixar as tabelas da Receita na primeira carga.",
    pisCofins: "Para as tabelas. A planilha é lida no seu navegador.",
    icmsIpi: "Não. O arquivo é lido e reescrito no seu navegador.",
  },
];

const COLUNAS = [
  { chave: "tabelas" as const, rotulo: "Tabelas oficiais" },
  { chave: "pisCofins" as const, rotulo: "PIS/COFINS" },
  { chave: "icmsIpi" as const, rotulo: "ICMS/IPI" },
];

/**
 * O comparativo das três telas.
 *
 * Tabela no desktop e fichas empilhadas no celular. Uma tabela de quatro colunas
 * com frase inteira em cada célula não encolhe: ou rola para o lado, e quem lê
 * perde a pergunta de vista, ou quebra as palavras em coluna de dois
 * caracteres.
 */
export function Comparativo() {
  return (
    <>
      <div className="hidden overflow-hidden rounded-md border border-border-subtle md:block">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">O que cada tela recebe, confere, devolve e corrige.</caption>
          <thead>
            <tr>
              <th scope="col" className="w-40 bg-surface-head px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                <span className="sr-only">Pergunta</span>
              </th>
              {COLUNAS.map((c) => (
                <th
                  key={c.chave}
                  scope="col"
                  className="bg-surface-head px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-text-secondary"
                >
                  {c.rotulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LINHAS.map((l) => (
              <tr key={l.pergunta} className="border-t border-border-subtle align-top odd:bg-surface-page/50">
                <th scope="row" className="px-3 py-2.5 text-xs font-semibold text-text-primary">
                  {l.pergunta}
                </th>
                {COLUNAS.map((c) => (
                  <td key={c.chave} className="px-3 py-2.5 leading-relaxed text-text-secondary">
                    {l[c.chave]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {COLUNAS.map((c) => (
          <div key={c.chave} className="rounded-md border border-border-subtle bg-surface-card">
            <p className="border-b border-border-subtle bg-surface-head px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-text-secondary">
              {c.rotulo}
            </p>
            <dl className="flex flex-col gap-2 p-3 text-sm">
              {LINHAS.map((l) => (
                <div key={l.pergunta}>
                  <dt className="text-xs font-semibold text-text-primary">{l.pergunta}</dt>
                  <dd className="leading-relaxed text-text-secondary">{l[c.chave]}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </>
  );
}
