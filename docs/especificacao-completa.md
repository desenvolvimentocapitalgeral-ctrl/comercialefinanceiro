# Sistema de Gestão de Comissões e Bonificações — Especificação Completa

> Consolidação dos Prompts 1-4. Esta é a versão de referência do projeto — onde houver
> divergência entre esta especificação e as mensagens originais que a geraram, **esta
> prevalece**, pois incorpora as correções feitas a partir da leitura de 36 contratos
> reais assinados e do sistema de planilha manual que a empresa já opera hoje.

## Sumário

1. [Visão geral e princípios](#1-visão-geral-e-princípios)
2. [Stack tecnológica](#2-stack-tecnológica)
3. [Modelo de dados](#3-modelo-de-dados)
4. [Motor de cálculo (o coração do sistema)](#4-motor-de-cálculo)
5. [Regras comerciais e contratos](#5-regras-comerciais-e-contratos)
6. [Financeiro — contas a receber, pagamentos, recibos](#6-financeiro)
7. [Gestão — dashboard, portal, notificações](#7-gestão)
8. [Lacunas conhecidas e roadmap](#8-lacunas-conhecidas-e-roadmap)

---

## 1. Visão geral e princípios

Sistema web para gestão de comissões e bonificações de representantes comerciais de
uma empresa de genética bovina (sêmen/embriões), substituindo um controle manual em
planilha (`Sistema_Comissoes_Representantes.xlsx`) que opera com 6 motores de cálculo
distintos, hoje mantidos manualmente.

**Princípios não negociáveis** (herdados do Prompt 1 e reforçados pela leitura dos
dados reais):

1. **Auditabilidade total** — toda alteração em dado financeiro gera registro em
   `LogAuditoria` (quem, quando, valor anterior, valor novo, motivo). Tabela `INSERT`-only.
2. **Cálculo determinístico e reprocessável** — comissão e bonificação nunca são
   digitadas manualmente; são sempre resultado de funções puras em `/lib/calculos`,
   testadas isoladamente, sem acesso a banco.
3. **Separação entre dado importado e dado calculado** — vendas/parcelas são fatos
   brutos; apurações são sempre derivadas.
4. **Versionamento de regras por CICLO, não por data corrida** — confirmado em
   aditivos reais: uma mudança de regra só vale a partir do próximo ciclo comercial,
   nunca retroage sobre o ciclo em curso.
5. **Idempotência de importação** — reimportar um arquivo do ERP atualiza, nunca duplica.
6. **Ciclo comercial (dia 11 a dia 10) é dimensão estrutural**, não detalhe de exibição.
7. **Estado "bloqueado por falta de dado" é um estado de negócio legítimo**, nunca um
   zero silencioso ou uma exceção não tratada — reflete a realidade operacional real
   (7 dos 36 contratos hoje estão sem tabela de comissão localizada).

---

## 2. Stack tecnológica

- **Frontend**: Next.js 16 (App Router), TypeScript estrito, Tailwind CSS 4,
  shadcn/ui (Radix), TanStack Table, Recharts, React Hook Form + Zod, date-fns.
- **Backend**: Next.js Server Actions (mutações internas) + Route Handlers `/api/*`
  (integrações externas), PostgreSQL, **Prisma ORM v6** (fixado — v7 mudou o modelo
  de configuração de datasource e exige adapter explícito, o que adicionaria
  complexidade desnecessária para este projeto).
- **Auth**: NextAuth.js / Auth.js v5, credenciais (e-mail/senha) no MVP, JWT em
  cookie httpOnly.
- **Arquivos**: SheetJS (import de planilhas do ERP), `pdf-parse` (contratos),
  React-PDF/Puppeteer (recibos).
- **IA**: API Anthropic (Claude) para interpretação de contratos, com validação Zod
  estrita da resposta.
- **Deploy**: Vercel + Postgres gerenciado (Neon/Supabase) + Vercel Blob para arquivos.
- **Qualidade**: ESLint + Prettier, Vitest (funções de `/lib/calculos` — 100% de
  cobertura obrigatória), Playwright (fluxos E2E críticos).

Estrutura de pastas: ver `app/`, `lib/`, `components/`, `tests/` neste repositório —
já criada conforme o Prompt 1, Parte A, Seção 4.

---

## 3. Modelo de dados

Schema completo em [`prisma/schema.prisma`](../prisma/schema.prisma). Pontos que
**corrigem** a suposição inicial do Prompt 1 a partir dos contratos reais:

- **Meta de bonificação é em DOSES ou em R$, nunca ambos** (`RegraBonificacao.tipoMeta`).
  O bônus pago em si é sempre um valor fixo em R$.
- **Motor de cálculo é polimórfico** (`tipoCalculo`: `DESC_POL1`, `DESC_POL2`, `META`,
  `POLV3_LEGACY`, `FIXO`, `SEMTAB`) — não existe um percentual único por contrato.
- **Comissão por tabela de desconto por dose** exige `Produto.precoTabela` com
  histórico (`ProdutoHistoricoPreco`), porque o preço de tabela muda ao longo do tempo.
- **Vigência de regra é por `cicloId` (string `AAAA-MM`)**, nunca por `Date` corrida.
- **Parcela suporta múltiplas baixas parciais** via tabela filha `BaixaParcela`,
  cada uma gerando sua própria `ApuracaoComissao` proporcional.
- **Renegociação preserva a parcela original** (`status = RENEGOCIADA`) e cria novas
  parcelas vinculadas via `parcelaOrigemRenegociacaoId`.
- **Pagamento distingue `REGULAR` de `ADIANTAMENTO`**, com reconciliação explícita —
  a empresa hoje tem uma prática real de adiantar pagamento antes da apuração formal.
- **Estorno de comissão e ajuste de bonificação são entidades próprias**
  (`EstornoComissao`, `AjusteBonificacao`), nunca edição direta de uma apuração já paga.
- **Status de contrato inclui estados reais da operação**: `SEM_TABELA_COMISSAO`,
  `RESCISAO_PENDENTE_FORMALIZACAO`, além de `ATIVO`/`ENCERRADO`.
- **De-para tem 3 entidades**, não 2: `ClienteAlias`, `ProdutoAlias` e
  `RepresentanteAlias` — o campo "Vendedor" do ERP também tem grafias inconsistentes.

---

## 4. Motor de cálculo

Implementado em [`lib/calculos/ciclo.ts`](../lib/calculos/ciclo.ts),
[`lib/calculos/comissao.ts`](../lib/calculos/comissao.ts) e
[`lib/calculos/bonificacao.ts`](../lib/calculos/bonificacao.ts), com testes em
`tests/unit/`. Todas as funções são puras (sem acesso a banco), determinísticas e
100% cobertas por teste.

### 4.1 Ciclo comercial
`calcularCiclo(data, diaInicio, diaFim)` — ciclo vai de `diaInicio` a `diaFim` do mês
seguinte, `cicloId` no formato `AAAA-MM` = ano-mês do dia de início (evita ambiguidade
na virada do ano). `resolverVigenciaPorCiclo()` resolve, entre várias regras
versionadas, qual vale para um `cicloId` alvo — sempre a mais recente cuja vigência é
`<=` ao ciclo alvo, nunca uma regra futura aplicada retroativamente.

### 4.2 Comissão
- `calcularComissaoPorTabelaDesconto()` — resolve o percentual a partir do desconto
  concedido por dose (motores `DESC_POL1`/`DESC_POL2`/`POLV3_LEGACY`). Abaixo do menor
  degrau cadastrado, mantém o piso da última faixa. Retorna bloqueio explícito
  (`DESCONTO_CONCEDIDO_NAO_INFORMADO`) quando o dado manual não foi preenchido.
- `calcularComissaoPercentualFixo()` — motor `FIXO`, bloqueia com `SEM_TABELA_COMISSAO`
  quando não há percentual definido (motor `SEMTAB`).
- `calcularRessarcimentoRiscoComercial()` — ressarcimento parcial (tipicamente 50%)
  sobre comissão já apurada, para vendas autorizadas excepcionalmente com crédito
  reprovado que ficaram inadimplentes por mais de 30 dias.

### 4.3 Bonificação
- `calcularBonificacaoMetaDoses()` — motor `META`: se a meta de doses do ciclo não é
  batida, aplica percentual flat sobre tudo o recebido; se é batida, paga bônus fixo +
  percentual só sobre o valor das doses que excedem a meta, alocadas em **ordem
  cronológica (FIFO)** por data de validação da venda — inclusive o caso de uma venda
  que cruza a fronteira exata da meta (parte dentro, parte fora).
- `calcularBonificacaoValorFixoPorFaturamento()` — bônus fixo simples ao cruzar um
  piso de faturamento no ciclo.
- `resolverFaixaEscalonada()` — resolve a faixa aplicável a um percentual de
  atingimento, incluindo o caso de atingimento exatamente na fronteira entre faixas.

---

## 5. Regras comerciais e contratos

### 5.1 Arquétipos de contrato confirmados
| Arquétipo | Motor | Regra |
|---|---|---|
| Política Comercial (maioria) | `DESC_POL1` | Comissão por tabela de desconto por dose + bônus fixo ao cruzar piso de faturamento |
| Somente Comissão | `DESC_POL2` | Mesma tabela, percentuais mais altos, sem bônus |
| Meta de Doses | `META` | Meta em quantidade de doses; flat % sem meta, bônus + % sobre excedente com meta |
| Legado v3.0 | `POLV3_LEGACY` | Faixas por faturamento total do ciclo (não por desconto unitário) |
| Atípico (1 caso) | `FIXO` | Valor fixo mensal + % sobre excedente de um segundo limiar |
| Sem tabela localizada | `SEMTAB` | Cálculo bloqueado até a política ser encontrada/definida |

### 5.2 Regras de versionamento
- Toda venda referencia o contrato **vigente na data da venda**, nunca o vigente hoje.
- Encerramento automático por sobreposição: novo contrato `ATIVO` encerra o anterior
  na véspera da nova vigência (nunca dois `ATIVO` simultâneos para o mesmo representante).
- Aditivo = novo registro de regra com `vigenciaCicloInicio`, nunca edição do anterior.
- Mudança de regra **não retroage** sobre o ciclo em curso na data do aditivo.

### 5.3 IA de interpretação de contratos
Upload de PDF → extração de texto → prompt estruturado para a API Anthropic → resposta
validada por schema Zod → pré-preenchimento do formulário com nível de confiança
(alta/média/baixa) por campo, exigindo confirmação humana explícita para
média/baixa — nunca salva sozinha. Cláusulas ambíguas viram `clausulasDuvidosas`,
nunca um valor "chutado".

### 5.4 De-para (matching de Cliente, Produto e Representante)
Pipeline: normalização → match por identificador forte (CNPJ/CPF) → match exato por
alias já registrado → match fuzzy (Levenshtein + similaridade de tokens) em 3 faixas
de confiança (alta ≥0,90 automática mas auditável; média 0,70-0,90 exige confirmação;
baixa <0,70 é cadastro novo/decisão manual). Para `RepresentanteAlias`, limiar mais
conservador que Cliente/Produto — falso positivo aqui atribui comissão à pessoa errada.

### 5.5 Campanhas
Regra aditiva temporária sobre a regra do contrato (nunca substitui). Vale por
**data da venda**, não por data de recebimento — todas as parcelas de uma venda usam
a regra vigente quando a venda foi feita.

---

## 6. Financeiro

### 6.1 Ciclo de vida da parcela
`PENDENTE → RECEBIDA / RECEBIDA_PARCIAL → CANCELADA / RENEGOCIADA`. Toda baixa
(manual ou por importação) passa por uma única função de serviço, nunca duplica
lógica entre os dois fluxos. Baixa parcial gera `BaixaParcela` própria com apuração
de comissão proporcional; complemento posterior gera uma segunda `BaixaParcela`,
nunca substitui a primeira.

### 6.2 Renegociação
Parcela original vira `RENEGOCIADA` (nunca editada/excluída); novas parcelas nascem
vinculadas via `parcelaOrigemRenegociacaoId`. Juros/multa de renegociação não entram
na base de cálculo de comissão por padrão.

### 6.3 Adiantamentos
`Pagamento.tipo = ADIANTAMENTO` nasce sem `PagamentoItem` vinculado. Compensação com
apurações futuras é sempre ação explícita do financeiro (nunca automática), com saldo
visível na tela `/comissoes/adiantamentos`.

### 6.4 Estorno e ajuste
Comissão/bonificação já paga nunca é editada diretamente — gera-se `EstornoComissao`
ou `AjusteBonificacao`, deduzido do próximo pagamento regular.

### 6.5 Aprovação e pagamento
`PENDENTE → APROVADA → PAGA`, sempre ações humanas distintas (segregação de funções
recomendada entre quem aprova e quem paga). Um `Pagamento` nunca mistura representantes
diferentes. Recibo em PDF gerado ao concluir o pagamento, com assinatura eletrônica
simples (clique autenticado + IP + timestamp) no MVP.

---

## 7. Gestão

- **Dashboard**: Fileira 1 (saúde do processo — apurações bloqueadas, contratos sem
  tabela, saldo de adiantamento pendente) sempre antes da Fileira 2 (resultado
  financeiro). Todo gráfico usa `cicloId`/`listarCiclosEntre()`, nunca mês calendário.
- **Portal do representante**: mobile-first, isolamento de dado validado no servidor
  (nunca confiar em filtro de client), simulador de comissão reaproveitando as mesmas
  funções puras do motor real.
- **Notificações**: e-mail transacional assíncrono (fila com retry), templates
  editáveis com variáveis, nunca bloqueia a ação de negócio que a originou.
- **Auditoria**: tela central buscável por entidade/usuário/período, complementando o
  `AuditTrail` embutido em cada tela de detalhe.

---

## 8. Lacunas conhecidas e roadmap

1. **O ERP (Omie) não exporta quantidade de doses nem preço unitário por venda** —
   bloqueia automação plena dos motores `DESC_POL1`/`DESC_POL2`/`META`. Fallback:
   campos editáveis manualmente em `Venda` (`dosesVendidas`,
   `descontoConcedidoPorDose`), com apuração nascendo `BLOQUEADA_DADO_MANUAL_FALTANTE`
   enquanto ausentes. **Prioridade mais alta do roadmap.**
2. Assinatura digital com certificado ICP-Brasil (hoje: assinatura eletrônica simples).
3. Integração direta por API com o ERP, substituindo importação por arquivo.
4. Suporte real a multiempresa (schema já preparado, telas ainda assumem 1 empresa/sessão).
5. SSO corporativo, notificação por WhatsApp, assistente de linguagem natural sobre
   relatórios, detecção de anomalias por IA.
6. Prorateamento automático de meta para contrato que começa no meio de um ciclo
   (`RegraBonificacao.prorateaPrimeiroCiclo`, campo já reservado no schema).

---

*Este documento substitui a necessidade de reler as mensagens originais dos Prompts
1-4 — qualquer decisão de implementação deve se basear nele e no código deste
repositório, não em suposições sobre o domínio.*
