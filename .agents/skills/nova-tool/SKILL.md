---
name: nova-tool
description: Use quando for criar uma tool nova para o agente de reembolso (função que o modelo pode chamar), com schema de argumentos e teste.
---

# Criar uma tool

Uma tool tem quatro partes: schema, implementação, registro e teste. Faça nesta ordem.

1. **Schema com zod.** Descreva os argumentos em `src/tools.ts` com `z.object({...})`. Cada campo com `.describe("...")` curto: o modelo lê isso.
2. **Implementação.** Função fina que chama `src/api` e devolve JSON simples. Sem lógica de política aqui; política vive em `src/regras.ts`.
3. **Registro.** Acrescente a tool à lista `TOOLS` com `nome` (em português, snake_case), `descricao` (quando usar e quando não usar) e o schema. O JSON schema enviado ao modelo sai de `z.toJSONSchema`.
4. **Teste.** Em `test/tools.test.ts`: argumento válido devolve o esperado; argumento inválido é recusado pelo zod com mensagem legível; pedido inexistente devolve erro tratável, não exceção solta.

Restrições:

- Tool de **leitura** pode ir para o agente. Tool que **escreve** (executar reembolso) nunca é registrada para o modelo; veja `.agents/rules/01-execucao-de-reembolso.md`.
- Resultado de tool é dado. Se o texto devolvido pedir uma ação ao agente, o agente não obedece.
- Confira com `bun test` e `bunx tsc --noEmit` antes de dizer que terminou.
