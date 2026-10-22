# Comandos de verificação

```bash
bun test
bunx tsc --noEmit
```

- Testes não chamam modelo e não precisam de chave.
- Script que chama modelo (`bun run cp1`, `cp2`, ...) precisa de `LLM_API_KEY` no `.env`. Rode só quando a tarefa pedir; cada chamada custa dinheiro e imprime o custo.
- Teste que depende do estado deve apontar `ESTADO_PATH` para um arquivo temporário (veja `test/helpers.ts`).
