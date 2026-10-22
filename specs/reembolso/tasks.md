# Tarefas

## Tarefa 1: extrair o pedido da mensagem

- Contexto: `src/llm.ts`, critério de aceite 1.
- Criar `src/01-chamada-unica.ts` com schema zod, JSON schema para o provedor e uma tentativa de reparo se a validação falhar.
- Pronto quando: três mensagens de exemplo viram objetos válidos e uma mensagem sem pedido não inventa número.

## Tarefa 2: regras da política em código

- Contexto: `politica/v1.md`, critérios de aceite 2 a 8.
- Criar `src/regras.ts` com `avaliarPedido` e `checarDuplicidade`, e testes em `test/regras.test.ts` cobrindo cada pedido do banco.
- Pronto quando: `bun test` verde e cada pedido do banco cai na decisão da tabela do README.

## Tarefa 3: tool de leitura para o agente

- Contexto: `.agents/skills/nova-tool/SKILL.md`, critérios de aceite 9 e 10.
- Criar `src/tools.ts` com `consultar_pedido`, `consultar_politica`, `listar_reembolsos_do_cliente` e `checar_duplicidade`, cada uma com schema e teste.
- Pronto quando: nenhuma tool escreve no estado e `bunx tsc --noEmit` passa.
