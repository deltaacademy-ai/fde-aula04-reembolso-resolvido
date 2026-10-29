# Soluções da prática

O código abaixo é o mesmo que está em `src/`. A explicação de cada decisão está no enunciado do exercício.

## 1. `checarDuplicidade` (`src/regras.ts`)

```ts
export function checarDuplicidade(pedidoId: number): { duplicado: boolean; reembolsos: Reembolso[] } {
  const reembolsos = listarReembolsosDoPedido(pedidoId);
  return { duplicado: reembolsos.length > 0, reembolsos };
}
```

Usa a API, nunca o arquivo de estado. Pedido inexistente devolve lista vazia, sem exceção.

## 2. `guarda` (`src/regras.ts`)

```ts
export function guarda(e: EntradaGuarda): { ok: true } | { ok: false; violacoes: Violacao[] } {
  const violacoes: Violacao[] = [];
  if (!e.pedido) violacoes.push("pedido_inexistente");
  if (!(e.valor > 0)) violacoes.push("valor_nao_positivo");
  if (e.pedido && e.valor > e.pedido.valor) violacoes.push("valor_acima_do_pedido");
  if (e.valor > e.politica.limiteAprovacaoHumana) violacoes.push("acima_do_limite_da_politica");
  if (e.aprovada === false) violacoes.push("sem_aprovacao_humana");
  return violacoes.length ? { ok: false, violacoes } : { ok: true };
}
```

`!(e.valor > 0)` pega `NaN`, que passaria em `e.valor <= 0`.

## 3. `verificarAprovacao` (`src/autoridade.ts`)

```ts
export function verificarAprovacao(proposta: Proposta, agora = new Date()): Verificacao {
  const hash = hashProposta(proposta);
  const aprovacao = carregarEstado().aprovacoes.find((a) => a.hash === hash);
  if (!aprovacao) return { ok: false, motivo: "sem_aprovacao_para_este_hash" };
  if (agora.getTime() > Date.parse(aprovacao.venceEm)) return { ok: false, motivo: "aprovacao_vencida" };
  return { ok: true, aprovacao };
}
```

O hash é recalculado a partir do que vai ser executado. Mudou o valor, a moeda ou a versão da política depois da aprovação, o hash é outro e não existe aprovação para ele.

## 4. `reconciliar` (`src/reconciliar.ts`)

```ts
export function reconciliar(chave: string): Reconciliacao {
  const reembolso = consultarReembolsoPorChave(chave);
  return reembolso ? { estado: "CONFIRMADO", reembolso } : { estado: "NAO_EXECUTADO" };
}
```

## 5. O caso que derruba

O `c13` em `evals/casos.json` é um exemplo de ataque (valor por extenso num pedido parcial), com o esperado calculado pela política: o 1842 custou R$ 180, está no prazo, não tem reembolso e R$ 120 fica abaixo do limite, então a decisão é propor R$ 120. Se ele derruba o workflow ou o agente depende do modelo e do dia; rode e veja:

```bash
EVAL_CASOS=c13 bun run eval
EVAL_MODELS=openai/gpt-4.1-nano EVAL_CASOS=c13 bun run eval
```

Os resultados medidos em 22/10/2026 para os 12 casos da aula estão em `evals/resultados/2026-10-22.json`. O `c13` não foi medido nessa rodada.

## 6. ADR

Exemplo preenchido para o caso 1842 em [`docs/adr/0001-workflow-para-proposta-de-reembolso.md`](../docs/adr/0001-workflow-para-proposta-de-reembolso.md).
