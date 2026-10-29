# Exercício 3: `verificarAprovacao`

## Contexto

O humano não aprova "o reembolso do 1842". Ele aprova um hash: o SHA-256 do payload canônico da proposta (pedido, cliente, valor, moeda, versão da política). Se qualquer campo mudar depois da aprovação, o hash muda e a aprovação deixa de valer. O executor só escreve o que bate com um hash aprovado e dentro do prazo de validade.

## O que fazer

Em `src/autoridade.ts`, implemente:

```ts
export function verificarAprovacao(proposta: Proposta, agora = new Date()): Verificacao
```

1. Recalcule o hash da proposta que vai ser executada (`hashProposta`). Não aceite hash vindo de fora.
2. Procure em `carregarEstado().aprovacoes` a aprovação com esse hash. Sem aprovação: `{ ok: false, motivo: "sem_aprovacao_para_este_hash" }`.
3. Se `agora` passou de `aprovacao.venceEm`: `{ ok: false, motivo: "aprovacao_vencida" }`.
4. Senão: `{ ok: true, aprovacao }`.

## Como saber que está certo

```bash
bun test test/autoridade.test.ts test/guarda.test.ts
bun run cp4     # usa a sua chave; abra um segundo terminal para aprovar com `bun run aprovar <hash>`
```

## Para pensar

- Por que recalcular o hash em vez de receber o hash junto com a proposta?
- O que acontece se a política mudar de v1 para v2 entre a aprovação e a execução?
