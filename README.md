# Comercial e Financeiro — Comissões e Bonificações

Sistema de gestão de comissões e bonificações para representantes comerciais,
substituindo o controle manual em planilha. Genética bovina (sêmen/embriões),
ciclo comercial de dia 11 a dia 10 do mês seguinte.

Especificação completa: [`docs/especificacao-completa.md`](docs/especificacao-completa.md).

## Stack

Next.js 16 (App Router) + TypeScript estrito, Tailwind CSS 4, Prisma ORM **v6**
(fixado deliberadamente — a v7 exige `prisma.config.ts` + adapter, complexidade
desnecessária para este projeto), PostgreSQL, NextAuth v5, Vitest.

### Por que Prisma (e não Drizzle)

Decisão do Prompt 1: o domínio ainda está em refinamento ativo (o motor de cálculo já
mudou de "percentual único" para "polimórfico com 6 arquétipos" só na fase de
especificação, a partir da leitura dos contratos reais) — o fluxo de migration mais
guiado do Prisma favorece iteração rápida de schema nesta fase, em troca de SQL menos
explícito. Reavaliar para Drizzle se as queries analíticas do dashboard se tornarem o
gargalo de performance.

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencher DATABASE_URL, AUTH_SECRET, ANTHROPIC_API_KEY etc.
npx prisma migrate dev # cria o banco local a partir do schema
npm run prisma:seed    # popula dados de desenvolvimento
npm run dev
```

## Testes

```bash
npm test              # roda a suíte Vitest uma vez
npm run test:watch    # modo watch
npm run test:coverage # cobertura (100% obrigatório em lib/calculos)
```

As funções em `lib/calculos/` são puras (sem acesso a banco) e cobrem os casos de
borda documentados na especificação: meta batida exatamente no limite, venda que
cruza a fronteira de uma meta de doses, desconto mais agressivo que qualquer faixa
cadastrada, aditivo que só vale a partir do próximo ciclo, etc.

## Estrutura

```
app/(auth)                 — login, reset de senha
app/(dashboard)            — módulos administrativos (ADMIN/FINANCEIRO)
app/(portal-representante) — portal mobile-first do representante
app/api                    — importação, IA de contratos, recibos, webhooks, API v1
lib/calculos                — funções puras de cálculo (ciclo, comissão, bonificação)
lib/depara                   — matching de cliente/produto/representante
lib/importacao                 — parsers dos exports do ERP
lib/servicos                    — orquestração (baixa de parcela, geração de apuração)
prisma/schema.prisma              — modelo de dados completo
docs/                               — especificação, regras de negócio, glossário
```

## Documentação viva

- [`docs/especificacao-completa.md`](docs/especificacao-completa.md) — arquitetura, modelo de dados, motor de cálculo.
- [`docs/regras-de-negocio.md`](docs/regras-de-negocio.md) — regras em linguagem simples, atualizado a cada nova regra contratual implementada.
- [`docs/glossario.md`](docs/glossario.md) — vocabulário do domínio.

## Deploy

Vercel + Postgres gerenciado (Neon/Supabase). Variáveis de ambiente em
`.env.example`. Nenhum contrato/planilha real da empresa é versionado neste
repositório — apenas código.
