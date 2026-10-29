# Exercício 4: `reconciliar`

## Contexto

A API deu timeout depois de escrever. Do lado de cá você não sabe se o reembolso existe: o estado é `DESCONHECIDO`, não `FALHOU`. Repetir com chave nova duplica o dinheiro. O certo é perguntar ao sistema pela chave de idempotência, que é estável para a mesma proposta aprovada.

## O que fazer

Em `src/reconciliar.ts`, implemente:

```ts
export function reconciliar(chave: string): Reconciliacao
```

- Consulte o reembolso pela chave com `consultarReembolsoPorChave` (de `src/api`).
- Achou: `{ estado: "CONFIRMADO", reembolso }`. A escrita aconteceu; não faça mais nada.
- Não achou: `{ estado: "NAO_EXECUTADO" }`. Repetir com a **mesma** chave é seguro.

`resolverExecucao`, logo abaixo, já usa a sua função.

## Como saber que está certo

```bash
bun test test/execucao.test.ts
bun run cp5     # usa a sua chave: o retry ingênuo duplica, o reconciliado não
```

## Para pensar

- Por que a chave de idempotência sai do hash da proposta, e não de um UUID novo a cada tentativa?
- Volte à pergunta do Exercício 1: duplicidade por pedido e idempotência por chave protegem contra coisas diferentes. Quais?
