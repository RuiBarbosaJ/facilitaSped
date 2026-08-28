# Facilita Sped

Consulta rápida das tabelas de códigos do **SPED EFD-Contribuições** (NCM, CST de PIS/COFINS, alíquotas, natureza da receita e vigência), atualizada automaticamente todos os dias a partir do portal da Receita Federal.

## O problema

Na **Escal Contabilidade**, os contadores consultavam as tabelas 4.3.x do EFD-Contribuições em planilhas de Excel pesadas, montadas à mão a partir dos arquivos publicados pela Receita. Toda vez que o governo atualizava uma tabela, as planilhas quebravam: fórmulas apontando para linhas que mudaram de lugar, versões diferentes circulando entre as pessoas, e ninguém sabendo qual era a atual.

O Facilita Sped substitui essas planilhas por uma página web com busca instantânea. Não há nada para manter na mão: um robô visita o portal do SPED todo dia de madrugada e, se alguma tabela mudou, a página é republicada sozinha.

## Como funciona

```text
06:00 UTC (03:00 em Brasília), todo dia
        │
        ▼
GitHub Actions ──► scripts/sync-tabelas.ts
                        │
                        ├─ Puppeteer abre o portal gov.br/sped e descobre os arquivos
                        ├─ baixa cada tabela (.doc / .docx) com fetch nativo
                        ├─ converte os documentos do Word em linhas e colunas
                        └─ grava public/data/tabelas-sped.json
                        │
        ┌───────────────┘
        ▼
mudou alguma coisa?  ──não──► fim (nenhum commit)
        │ sim
        ▼
commit + push na main ──► Vercel faz o deploy ──► página atualizada
```

A aplicação não tem banco de dados nem backend em produção. Os dados são um único arquivo JSON estático servido junto com o site, e a busca roda inteira no navegador com [Fuse.js](https://www.fusejs.io/). Custo de operação: zero.

### Por que Puppeteer

O portal [gov.br/sped](https://www.gov.br/sped/pt-br/assuntos/escrituracoes-digitais/efd-contribuicoes/tabelas-de-codigos/) é uma aplicação Plone/Volto renderizada no cliente. O HTML que o servidor entrega tem menos de 800 caracteres de texto; a lista de arquivos só existe depois que o JavaScript roda. Um `fetch` simples (ou axios + cheerio) enxerga apenas o esqueleto da página e não encontra link nenhum. Por isso a descoberta das URLs usa um navegador headless.

### O que entra no JSON

O portal publica as tabelas como documentos do Word (`.doc`/`.docx`) e algumas planilhas (`.xls`). O robô lê os documentos do Word com [word-extractor](https://www.npmjs.com/package/word-extractor) — JavaScript puro, sem depender de LibreOffice ou antiword no servidor.

| Tabela | Conteúdo | No JSON |
| --- | --- | --- |
| 4.3.3 | CST de PIS/Pasep | ✅ |
| 4.3.8, 4.3.18 | Códigos de ajuste | ✅ |
| 4.3.9 | Alíquotas de créditos presumidos | ✅ |
| 4.3.10, 4.3.11, 4.3.17 | Alíquotas diferenciadas, monofásicas e por unidade | ✅ (com alíquota) |
| 4.3.12 | Substituição tributária (CST 05) | ✅ |
| 4.3.13 | Alíquota zero (CST 06) | ✅ |
| 4.3.14, 4.3.15, 4.3.16 | Isenção, sem incidência, suspensão (CST 07/08/09) | ✅ |
| 4.3.4 | CST de COFINS | ❌ idêntica à 4.3.3 (deduplicada) |
| 4.3.5, 4.3.6, 4.3.7 | Contribuição apurada, tipo de crédito, base de cálculo | ✅ só as linhas com vigência; sem CST, aparecem em "Todos os CSTs" |
| 5.1.2 | Códigos de detalhamento da CPRB | ❌ só código + descrição |
| CFOP, Dacon, 5.1.1 | Planilhas `.xls` | ❌ sem colunas de NCM/CST |

O script lista, a cada execução, cada arquivo que ficou de fora e o motivo.

Cada registro segue a interface [`RegistroSped`](src/types/sped.ts):

```ts
interface RegistroSped {
  ncm: string;              // "27101259" — ou vazio quando a regra não cita NCM
  descricao: string;
  cst: string;              // "06"
  aliquota: string;         // "5.08" (PIS) — vazio quando a tabela não traz alíquota
  natureza_receita?: string; // "101"
  data_inicio?: string;     // "01/2011" ou "08/03/2013"
  data_fim?: string;        // ausente = regra ainda vigente
  tabela?: string;          // "4.3.13" — tabela de origem no portal
}
```

Quando uma célula do documento cita vários NCMs ("0713.33.19, 0713.33.29 e 1106.20"), cada um vira um registro próprio, para que a busca por qualquer deles encontre a regra.

## A consulta

A tela abre no **CST 06** (alíquota zero), que é o que a equipe usa no dia a dia; um seletor troca para qualquer outro CST publicado, ou para todos.

Para cada código de natureza da receita, só a **vigência mais recente** é exibida. Quando a Receita altera uma regra, o portal acrescenta uma linha nova com o mesmo código e outro período sem apagar a anterior — a consulta mostra a última versão, mesmo que já encerrada, porque é a informação mais atual sobre aquele código. A coluna Vigência deixa claro se a regra ainda vale.

A busca filtra por **NCM ou descrição**; CST e natureza da receita aparecem na tabela, mas não são pesquisáveis.

A tela mostra **quando os dados foram atualizados pela última vez**, no horário de Brasília. O carimbo vive em `public/data/sync-meta.json` e só é reescrito quando a Receita de fato publica algo novo — se ficasse dentro do arquivo de dados, o robô geraria um commit e um deploy por dia mesmo sem nenhuma mudança.

A interface tem tema **claro, escuro ou "seguir o sistema"**. A escolha fica no navegador e é aplicada por um script inline antes da primeira pintura, então não há piscada de tema errado ao carregar. Todas as combinações de cor foram auditadas contra a WCAG 2.1 (texto acima de 4.5:1, elementos de interface acima de 3:1) nos dois temas.

## Stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS 4, TypeScript estrito
- **Busca:** Fuse.js no cliente
- **Robô de coleta:** Node.js, Puppeteer, word-extractor, adm-zip, `fs`/`readline`
- **Automação:** GitHub Actions (cron diário)
- **Hospedagem:** Vercel

## Rodando localmente

Requisitos: Node.js 22 ou superior (o Puppeteer 25 exige `>= 22.12`).

```bash
npm ci          # instala as dependências e baixa o Chrome do Puppeteer
npm run dev     # sobe a interface em http://localhost:3000
```

Para regenerar os dados a partir do portal:

```bash
npm run sync    # roda scripts/sync-tabelas.ts e reescreve public/data/tabelas-sped.json
```

A execução leva menos de um minuto e imprime, tabela por tabela, quantos registros foram extraídos. A saída é determinística: rodar duas vezes sem que a Receita tenha mudado nada produz o mesmo arquivo, byte a byte.

Outros comandos:

```bash
npm run build   # build de produção
npm run lint    # ESLint
npx tsc --noEmit
```

## Estrutura

```text
.github/workflows/sync-sped.yml   cron diário: sync → diff → commit → push
scripts/sync-tabelas.ts           robô de coleta e parsing
public/data/tabelas-sped.json     base de dados (gerada; commitada)
src/types/sped.ts                 interface RegistroSped
src/app/page.tsx                  tela principal
src/hooks/useRegistrosSped.ts     carrega e valida o JSON
src/hooks/useBuscaSped.ts         índice Fuse.js e consulta
src/components/                   busca, seletor de CST, tema, tabela, linha, copiar, vigência
src/hooks/useTema.ts              preferência de tema (claro/escuro/sistema)
src/hooks/useSincronizacao.ts     lê e formata o carimbo de atualização
public/data/sync-meta.json        quando os dados mudaram pela última vez (gerado)
```

## A automação em detalhe

O workflow [`sync-sped.yml`](.github/workflows/sync-sped.yml):

1. Faz checkout e instala as dependências com Node 22.
2. Restaura o Chrome do Puppeteer do cache do Actions (evita baixar ~170 MB a cada run).
3. Executa `scripts/sync-tabelas.ts`.
4. Se algo em `public/data/` mudou, faz commit como `github-actions[bot]` e push na `main`. Sem mudança, não há commit — e o carimbo de atualização só é reescrito quando os dados mudam, então não há commit diário.

Salvaguardas do robô:

- **Insiste antes de desistir.** A listagem de arquivos do portal depende de JavaScript que às vezes não responde. Cada seção é recarregada até 3 vezes; se ainda assim não renderizar, o robô consulta a REST API do Plone (`/sped/++api++/...`), que devolve a mesma lista em JSON.
- **Nunca publica base vazia ou parcial.** Se um arquivo falhar no download, ele é pulado — mas se isso encolher a base para menos de 80% da anterior, o script aborta sem tocar no JSON. Instabilidade do portal não vira dado errado no ar.
- **Chrome sempre fechado.** O navegador é encerrado no `finally`, mesmo em erro, para não deixar o runner do Actions pendurado.
- **Pacote consolidado tem prioridade.** Se a Receita voltar a publicar as tabelas em `.zip`/`.txt` delimitado por `|`, o robô passa a usá-lo automaticamente.

## Limitações conhecidas

- **NCMs com 4, 6 ou 8 dígitos.** O portal referencia posições (`02.01`) e capítulos inteiros, não só códigos completos. O JSON preserva isso; uma busca por `27101259` não casa com um registro `2710`.
- **Alíquota é só a de PIS, e só quando é percentual.** As tabelas 4.3.10 e 4.3.17 trazem PIS e COFINS separados; a interface guarda um campo. A 4.3.11 (CST 03) publica alíquotas em R$ por unidade de medida, que não cabem na coluna "%" — ficam de fora.
- **Datas só com o separador normalizado.** `01/2011` e `08/03/2013` são mantidas como publicadas (`15/12/2011 *` e `01042026` viram `15/12/2011` e `01/04/2026`); o robô não reescreve dia e mês, para não arriscar invertê-los.
- **Tabela 4.3.11 (CST 03) é a mais irregular do portal.** Muda de leiaute no meio do documento e usa subitens numéricos; os registros dela são os menos confiáveis do JSON.
- **Deploy automático na Vercel.** Em contas Hobby, a Vercel só dispara deploy para commits do dono da conta. Se o commit do `github-actions[bot]` não gerar deploy, a alternativa é acionar um [Deploy Hook](https://vercel.com/docs/deploy-hooks) da Vercel ao final do workflow.

## Desenvolvedor

**Rui Barbosa** — [(99) 99172-2391](https://wa.me/5599991722391)

Projeto criado para a equipe fiscal e contábil da Escal Contabilidade.
