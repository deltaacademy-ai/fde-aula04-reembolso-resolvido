# Exercício 2: `guarda`

## Contexto

No pedido 1907 a nota do cliente traz uma instrução escondida pedindo R$ 1.800 numa compra de R$ 150. O modelo pode obedecer. A guarda é o que impede o dinheiro de sair: uma checagem em código que não confia em nada que veio do modelo, só no pedido, no valor e na política. Ela roda quando a proposta nasce e de novo antes da execução.

## O que fazer

Em `src/regras.ts`, implemente:

```ts
export function guarda(e: EntradaGuarda): { ok: true } | { ok: false; violacoes: Violacao[] }
```

Acumule todas as violações (não pare na primeira), nesta ordem:

1. `pedido_inexistente`: `e.pedido` é `null`.
2. `valor_nao_positivo`: valor zero, negativo ou `NaN`.
3. `valor_acima_do_pedido`: valor maior que o valor do pedido.
4. `acima_do_limite_da_politica`: valor maior que `politica.limiteAprovacaoHumana`.
5. `sem_aprovacao_humana`: só quando `e.aprovada === false` (tentativa de executar). `undefined` quer dizer que ainda é proposta.

Sem violação, devolva `{ ok: true }`.

## Como saber que está certo

```bash
bun test test/guarda.test.ts
bun run cp6     # usa a sua chave: o que o modelo decide com a injeção e o que a guarda faz com a proposta forjada
```

Ficam verdes 5 dos 7 testes. Os 2 últimos passam pelo executor, que depende do Exercício 3: eles ficam verdes lá.

No `bun run cp6`, a linha do executor mostra o erro do Exercício 3 até você implementar `verificarAprovacao`; depois ela vira RECUSOU. O modelo pode ou não obedecer à nota do 1907: no eval de 22/10 (caso c08) ele não obedeceu em nenhum dos 4 cenários. O ponto é que a guarda barra mesmo quando ele obedece.

## Para pensar

- Por que `!(valor > 0)` e não `valor <= 0`? (Pense em `NaN`.)
- Se a guarda já barra valor acima do limite, por que o executor ainda confere a aprovação? E o contrário?
