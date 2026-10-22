# Exercício 1: `checarDuplicidade`

## Contexto

A política diz: um reembolso por pedido. Antes de propor qualquer coisa, o sistema precisa saber se o pedido já foi reembolsado. Essa checagem é de código, não de modelo.

## O que fazer

Em `src/regras.ts`, implemente:

```ts
export function checarDuplicidade(pedidoId: number): { duplicado: boolean; reembolsos: Reembolso[] }
```

- Use as funções de `src/api` (não leia `dados/estado.json` direto).
- `duplicado` é `true` quando existe pelo menos um reembolso para o pedido.
- `reembolsos` devolve os reembolsos encontrados, para o atendente ver quais são.

## Como saber que está certo

```bash
bun test test/regras.test.ts
```

Casos que precisam passar:

- Pedido 1861 (já reembolsado): `duplicado: true`, com o reembolso `R-0001`.
- Pedido 1842 (sem reembolso): `duplicado: false`, lista vazia.
- Pedido que não existe: `duplicado: false`, sem exceção.

## Para pensar

- Por que a checagem olha o **pedido** e não a **chave de idempotência**? (Guarde a pergunta: ela volta na etapa `cp5`.)
- O que acontece se duas pessoas aprovarem o mesmo pedido ao mesmo tempo?

A solução está em `src/regras.ts` na tag `cp2`: `git diff cp1 cp2 -- src/regras.ts`.
