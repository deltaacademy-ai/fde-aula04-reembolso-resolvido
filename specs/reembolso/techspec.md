# Tech spec: triagem de pedido de reembolso

## Abordagem

Duas versões para comparar: um workflow determinístico (o código conduz, o modelo extrai e redige) e um agente com tools de leitura (o modelo conduz dentro de limites). As regras da política ficam em código e servem de referência para as duas.

## Contexto para ler antes de mexer

- `politica/v1.md`: regras e parâmetros
- `src/api/index.ts` e `src/api/tipos.ts`: funções disponíveis e tipos
- `src/llm.ts`: como chamar o modelo e como o custo é medido
- `dados/banco.json`: os pedidos de teste (somente leitura)
- `.agents/rules/`: restrições de execução e de dados

## Arquivos a criar

- `src/01-chamada-unica.ts`: extração `{pedidoId, motivo, valorSolicitado}` com JSON schema e zod
- `src/regras.ts`: `avaliarPedido`, `checarDuplicidade`
- `src/02-workflow.ts`: extrair, consultar, aplicar regras, redigir
- `src/tools.ts` e `src/03-agente-leitura.ts`: tools de leitura e o loop

## Arquivos a alterar

Nenhum arquivo existente muda de comportamento. `package.json` ganha um script por etapa.

## Decisões

- Saída estruturada validada com zod mesmo quando o provedor garante o schema: o schema garante a forma, o zod garante o sentido.
- Limite de passos do agente: 6. Estourou, encaminha para humano.
- Valores monetários em número com duas casas; comparação com tolerância de centavo.

## Testes

Sem chamar modelo: cada pedido do banco cai na decisão certa em `avaliarPedido`; `checarDuplicidade` com e sem reembolso anterior.
