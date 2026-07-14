# Regras de Negócio (linguagem simples)

> Atualizado a cada nova regra contratual implementada. Não é documentação técnica —
> é a explicação, em português corrente, do que o sistema faz e por quê. Ver
> `docs/especificacao-completa.md` para o detalhamento técnico correspondente.

## Comissão

- A comissão só é paga quando o cliente **efetivamente paga** a parcela — nunca
  quando a nota fiscal é emitida ou a venda é fechada.
- Cada representante tem um percentual de comissão que muda dependendo de **quanto
  desconto ele deu na dose do sêmen**: quanto maior o desconto concedido ao cliente,
  menor o percentual de comissão do representante (tabela degrau a degrau).
- Se o representante ainda não informou quanto de desconto deu (ou quantas doses
  vendeu), o sistema **não inventa um número** — a comissão fica marcada como
  "bloqueada, aguardando dado manual" até alguém preencher.

## Meta de Doses (bonificação)

- Alguns representantes têm contrato com meta em **quantidade de doses vendidas por
  ciclo**, não em reais.
- Se não bater a meta: ganha 30% (ou o percentual do contrato) sobre **tudo** que foi
  recebido no ciclo.
- Se bater a meta: ganha um **bônus fixo em reais** + uma comissão menor só sobre as
  doses que **passaram** da meta — as doses que serviram para completar a meta não
  geram comissão extra, só o bônus fixo.
- A ordem em que as vendas "contam" para a meta é sempre a ordem cronológica (a
  venda mais antiga do ciclo é contada primeiro).

## Ciclo comercial

- O "mês" da empresa não é o mês do calendário — vai do dia 11 de um mês até o dia 10
  do mês seguinte.
- Uma venda feita dia 5 de março pertence ao ciclo que começou dia 11 de fevereiro.

## Adiantamento

- Às vezes a empresa paga um representante **antes** de o sistema ter calculado
  formalmente quanto ele tem direito naquele ciclo. Isso é registrado como
  "adiantamento" e depois é abatido do que for calculado de verdade, quando o
  financeiro decidir compensar.

## Renegociação

- Se um cliente atrasa e depois renegocia a dívida em novas parcelas, a parcela
  antiga não desaparece do histórico — ela fica marcada como "renegociada" e as
  parcelas novas nascem vinculadas a ela. O representante continua tendo direito à
  comissão, só que sobre o novo cronograma de pagamento.

## Contratos e aditivos

- Quando um contrato muda (ex: o percentual de comissão sobe), a mudança **só vale a
  partir do próximo ciclo comercial** — nunca é aplicada retroativamente sobre vendas
  já feitas ou sobre o ciclo que já está em andamento.
