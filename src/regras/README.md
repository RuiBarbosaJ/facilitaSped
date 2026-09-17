# `src/regras/` — o cérebro fiscal

Fonte de verdade sobre o que a norma exige, para as duas abas da auditoria.
Este documento é o handoff: o que existe, por que está assim, e o que fazer a seguir.

## A. Árvore de arquivos

O projeto tem **três áreas de produto**, e todas seguem o mesmo desenho. As pastas
estão em português, como o resto do código — `AbaIcmsIpi`, `colunasAchados`,
`leiaute`, `regravacao`. Não há nível agregador: cada área é pasta de primeiro
nível, porque `features/` não dizia nada que o nome da área já não dissesse.

```
src/
├── app/               rotas (obrigatório do Next)
│   ├── page.tsx       consulta
│   ├── icms-ipi/      era /sped
│   └── pis-cofins/    era /auditoria
│
├── icms-ipi/          COMO se lê o SPED .txt
│   ├── leiaute/       índices e domínios do leiaute   (era layout/)
│   ├── leitura/       worker, parser, encoding, hash  (era worker/)
│   ├── regravacao/    serialização fiel byte a byte
│   ├── auditoria/     motor antigo — a migrar para regras/
│   └── ui/
│
├── pis-cofins/        COMO se audita a planilha
├── consulta/          COMO se busca NCM/CST
│
├── regras/            O QUE a norma exige
│   ├── nucleo/        contratos e motor
│   ├── icms-ipi/      dicionario · validacoes/ · tabelas/
│   └── pis-cofins/
│
├── componentes/       compartilhados pelas três áreas
├── ganchos/           hooks compartilhados
├── comum/             datas, filtros de coluna
└── tipos/             tabelas-receita.ts
```

As rotas antigas `/sped` e `/auditoria` continuam funcionando: `next.config.ts`
declara redirect 308 para as novas.

O nome `RegistroSped` existia em dois lugares com sentidos opostos — uma linha
das tabelas 4.3.x da Receita e um registro do arquivo SPED. O primeiro virou
`RegraTabelaSped`, em `tipos/tabelas-receita.ts`.

### Por que as abas não compartilham dicionário

São leiautes diferentes, publicados por órgãos diferentes, com versões que avançam
em datas diferentes. O caso que decide a questão é o **C170**: existe nas duas, com o
mesmo nome e campos distintos. Um dicionário único teria de escolher uma das duas
definições, e a aba perdedora passaria a ler todos os campos na posição errada — sem
erro de compilação, apontando divergência falsa sobre arquivo correto.

O que elas compartilham é o `nucleo/`: contratos e executor. Montar o motor de uma aba
é uma linha, e a mesma linha nas duas:

```ts
const motor = new MotorSped(DICIONARIO_SPED_ICMS_IPI, REGRAS_ICMS_IPI);
const { achados, regrasQueFalharam, cancelado } = motor.executar(contexto);
```

### A relação com `src/icms-ipi/leiaute/`

`src/regras/` é a autoridade normativa. `src/icms-ipi/leiaute/` continua sendo o
mapa que o **parser** usa para quebrar a linha — e as duas fontes declaram os mesmos
índices.

Isso é um risco real: se divergirem num índice, nada quebra. O motor passa a ler o
campo vizinho e a auditoria aponta divergência falsa em massa, calada. Por isso
`dicionario.test.ts` confere campo a campo, trava a contagem (`totalCamposDeDados + 1
=== totalCampos` do leiaute) e falha o build na primeira divergência — nos dois
sentidos: registro no dicionário sem leiaute, e registro no leiaute sem decisão
sobre a norma.

## B. Estratégia de parser — o que já existe

**A infraestrutura de leitura já está construída e é boa.** O diagnóstico abaixo é do
código em `src/sped/worker/`, não uma proposta.

| Camada | Como é | Onde |
|---|---|---|
| Thread | Um `Worker` de módulo, compartilhado entre montagens | `ui/useAbaIcmsIpi.ts` |
| Leitura | `Blob.stream()` — o arquivo nunca é materializado inteiro | `worker/leitor.ts` |
| Pipeline | `stream → observador de bytes → TextDecoderStream → QuebraLinhas → async generator` | `worker/leitor.ts` |
| Encoding | Detectado por amostra: BOM, senão `TextDecoder(fatal)` decide UTF-8 × Windows-1252 | `worker/leitor.ts` |
| Hash | SHA-256 sobre os **bytes crus**, via callback antes da decodificação | `worker/icms-ipi.worker.ts` |
| Memória | Interning de strings só nos campos `codigo` e `aliquota` | `worker/parser.ts` |
| Cancelamento | Contador de execução — cada INICIAR/CANCELAR invalida o laço anterior | `worker/icms-ipi.worker.ts` |
| Tetos | Tamanho, linhas, caracteres por linha, tempo, achados, janela | `limites.ts` |

Custo medido e documentado no repo: a estrutura em memória ocupa **~4,3× o arquivo**.
Um arquivo de 150 MB pede ~640 MB de heap dentro do worker e leva ~2 s de parse.

Chunks manuais com `FileReader` seriam um retrocesso: `Blob.stream()` +
`TextDecoderStream` já entregam leitura incremental sem acumular, e resolvem o caractere
multibyte partido na fronteira do bloco — que o fatiamento manual precisaria tratar à mão.

### As duas lacunas de 100 MB — fechadas para o motor novo

1. **Cancelamento durante o motor.** `rodarValidacoes(estrutura, cancelada)` repassa o
   callback do worker, e `MotorSped` o consulta entre uma regra e outra. Continua
   *cooperativo*: uma regra que leve muito tempo num único laço só é interrompida ao
   terminar. As quatro regras antigas de `icms-ipi/auditoria/` ainda rodam sem esse
   canal — `rodarMotor` é um bloco síncrono —, e é mais um motivo para migrá-las.

2. **Teto global de achados.** `rodarValidacoes` passa `tetoGlobal` já descontado do que
   o motor antigo emitiu (`LIMITES.ACHADOS_NO_TOTAL`), e devolve os descartados para
   `registrarOmitidos`, que alimenta o "e mais N ocorrências" da tela.

### O que uma regra precisa respeitar

- **O(n) por registro-alvo.** `for (documento) for (item)` é O(total de itens) — correto.
  Um laço interno sobre coleção do arquivo inteiro, não.
- **Cruzamento só por `Map`.** `contexto.produtos.get(cod)`, nunca `linhas.find(…)`:
  são ~400 mil itens contra ~545 mil linhas.
- **Teto antes de formatar.** `if (!podeApontar(CODIGO)) return;` no topo do laço.
  `apontar` aplica o teto tarde: o achado já foi construído.
- **Zero alocação no laço quente.** Domínios como constante de módulo. O repo já pagou
  esse preço duas vezes (`encoder.ts`, `parser.ts`).
- **Nada de estado mutável em variável de módulo.** O parser já foi mordido: dois
  arquivos na mesma sessão misturavam conteúdo.
- **`linha.campos` é somente leitura.** A regravação devolve o arquivo byte a byte.
- **Achado sem conteúdo fiscal.** CFOP e CST são inócuos; descrição de produto, nome de
  participante e valor de nota vazam para tela, log e exportação.
- **Nada de `src/regras/` em componente `"use client"`** — o bundler arrastaria dicionário
  e tabelas para o bundle da página.

## C. O dicionário

`DICIONARIO_SPED_ICMS_IPI` cobre **0000, 0150, 0200, C100, C170 e C190** — 115 campos,
cada um com `posicao`, `nome`, `tipo` (C/N), `tamanho`, `obrigatorio` (O/OC/N),
`condicao`, `valoresValidos`, `regraRelacional` e `procedencia`. São 46 regras
declaradas (relacionais e customizadas), das quais 18 trazem `implementadaEm`
apontando a função que as confere em `icms-ipi/validacoes/`.

### Três armadilhas que governam quase toda regra

1. **`O` em campo de valor significa "delimitador presente"**, não "conteúdo não-vazio".
   Campo de valor vazio vale `0,00` e o PVA aceita — a escrituração de referência do
   próprio repo traz `C190.VL_IPI` vazio. Daí o marcador `vazioEquivaleAZero`.
2. **`CST_ICMS` é `N(3)` = origem + tributação.** Toda regra que fala de "CST 40" fala
   dos dois últimos dígitos. `["40"].includes(cst)` nunca casa — e não quebra nada: a
   regra só deixa de existir. Use `tributacaoDoCstIcms()`.
3. **`COD_SIT` 02, 03, 04 e 05** (cancelado, denegado, inutilizado) tiram o documento do
   confronto. Regra de totalizador que não os exclua acusa erro em massa no varejo.

### Procedência e pendências

`procedencia: "inferido"` marca o que foi deduzido sem conferência documental — achado
apoiado nesses campos não deve chegar ao usuário com severidade `erro`. As
`pendenciasDeConferencia` no fim do dicionário listam 20 itens, os cinco primeiros
bloqueantes. **Nenhuma tem a ver com os índices dos campos**, que estão conferidos e
travados por teste.

## Dívidas conhecidas

- **`ContextoValidacao.grupos` e `LinhaSped.paiNl` ainda não são preenchidos** pelo
  parser, que só monta documentos do C100. O contrato foi ampliado antes porque
  `REGRAS_ICMS_IPI` está vazio — é o momento mais barato de acertar a assinatura,
  e escrever regras contra o contrato estreito obrigaria a reescrever todas elas
  depois. Enquanto o parser não montar, regra de inventário, produção, CIAP ou
  CT-e não tem dado para rodar.
- **`src/icms-ipi/auditoria/` ainda existe**, com o motor antigo e as 4 regras.
  Migrá-las para `src/regras/` depende do adaptador `EstruturaSped → ContextoValidacao`,
  que foi verificado como não-trivial: `NotaC100` não satisfaz `Documento` (falta
  `reg` e `filhos` é lista, não `Map`).
- **Os dois motores convivem.** `rodarMotor` (4 regras antigas) e `rodarValidacoes`
  (`src/regras/`) rodam em sequência no worker. A ponte é
  `icms-ipi/auditoria/contexto.ts`: um envoltório preguiçoso sobre `NotaC100`, que
  acrescenta o `reg` e monta o `Map` de filhos só quando alguém pede. A única
  sobreposição conhecida entre os dois é FIS-014 (sentido do CFOP × IND_OPER) — por
  isso FIS-C170-021 foi deixada de fora de `validacoes/`, para não duplicar o achado
  na tela. Migrar as quatro antigas encerra a convivência.

## O que já roda

`REGRAS_ICMS_IPI` tem nove regras cobrindo o bloco C, e o worker as executa. Quatro
delas emitem VÁRIOS códigos de achado a partir de uma única passagem pelos itens ou
pelos documentos — é o que evita reler o CST e reconverter os valores meio milhão de
vezes por regra. Os códigos emitidos são os declarados no dicionário:

| Regra | Códigos que emite | O que confere |
|---|---|---|
| `FIS_C170_001` | FIS-C170-001 | Origem (Tabela A) e tributação (Tabela B) do CST; reconhece CSOSN copiado da NF-e |
| `MATRIZ_CST_ICMS` | FIS-C170-010, 011, 014, 015, 017 | A matriz de exigência de valor da Tabela B, em `tabelas/cst-icms.ts` |
| `FIS_C170_012` | FIS-C170-012 | Base sem imposto, imposto sem base |
| `FIS_C170_013` | FIS-C170-013 | `VL_ICMS ≈ VL_BC_ICMS × ALIQ_ICMS` |
| `FIS_C170_019` | FIS-C170-019 | Crédito destacado em entrada de uso e consumo ou de ativo |
| `FIS_C170_020` | FIS-C170-020 | `TIPO_ITEM` do 0200 × CFOP de produção própria |
| `FIS_C170_ANALITICO` | FIS-C170-022, 023 | Item sem grupo; grupo que não fecha com seus itens |
| `FIS_C190_COERENCIA` | FIS-C190-010 a 014 | Alíquota, cálculo, isenção, redução de base e duplicidade |
| `FIS_C100_TOTAIS` | FIS-C100-011, 012, 018 | `VL_MERC` × itens; totais × analítico; documento sem C190 |

Nenhuma delas marca o achado como `corrigivel`. É deliberado: o TXT vai assinado à
Receita, e CST, CFOP, base, alíquota e valor de imposto nunca se corrigem sozinhos —
onde a correção é dedutível do arquivo, ela vai em `esperado`, como sugestão. A régua
está em `CorrecaoDeclarada` (`nucleo/tipos.ts`), com dois testes que a protegem.

## Próximos passos

1. Resolver as cinco pendências bloqueantes com o Guia Prático em mãos — em especial o
   critério de rateio do `VL_OPR`, que hoje mantém esse campo fora do confronto
   FIS-C170-023, e a exigência de filhos para `COD_SIT` 02 a 05.
2. Migrar as 4 regras de `icms-ipi/auditoria/regras/` e apagar o motor antigo.
4. Acrescentar ao layout do parser os registros que faltam: 0190, 0400, 0460, E111 e o
   bloco E2 — hoje `rotear()` empilha todo "E1*" numa lista plana, sem hierarquia, e o
   bloco E2 nunca chega lá.
5. Transcrever as tabelas estaduais. **Não grave a versão em `sync-meta.json`**: as
   chaves `5.1.1` e `5.1.2` de lá pertencem à EFD-Contribuições e seriam sobrescritas.
