# Prática da Aula 04: do repo com lacunas ao agente com autoridade

Encontro de 2 horas. Você parte do repo **inicial**, que tem o caso inteiro montado, só que com quatro peças de código em branco. Cada peça é um conceito da aula. Você implementa, o teste fica verde e o script da etapa mostra o efeito com o modelo de verdade.

- Inicial: https://github.com/deltaacademy-ai/fde-aula04-reembolso-inicial
- Resolvido (tudo pronto, com as tags `cp0` a `cp8`): https://github.com/deltaacademy-ai/fde-aula04-reembolso-resolvido

Travou? Compare com o mesmo arquivo no resolvido (`../fde-aula04-reembolso-resolvido`) e siga. Site com o passo a passo, comandos e explicações: https://fde-aula04-pratica.vercel.app A prática é sobre entender a decisão, não sobre digitar.

## Antes de começar (10 min)

Cada um usa a própria chave. OpenRouter é o padrão; OpenAI direto também serve (veja o README). A prática inteira com `gpt-4.1-mini` custa centavos de dólar; coloque um limite de gasto baixo na chave.

```bash
git clone https://github.com/deltaacademy-ai/fde-aula04-reembolso-inicial
git clone https://github.com/deltaacademy-ai/fde-aula04-reembolso-resolvido   # só para consulta
cd fde-aula04-reembolso-inicial
bun install
cp .env.example .env      # preencha LLM_API_KEY com a SUA chave; o .env nunca é commitado
bun run reset
bun test                  # os vermelhos são a sua lista de tarefas
```

No Windows, use WSL ou Git Bash. Os testes nunca chamam modelo e rodam sem chave.

## Roteiro

| Tempo | Exercício | Conceito | Arquivo | Pronto quando |
|---|---|---|---|---|
| 0:10 a 0:25 | [1. checarDuplicidade](exercicios/01-checar-duplicidade.md) | regra de negócio em código, não no modelo | `src/regras.ts` | `bun test test/regras.test.ts` verde, `bun run cp2` |
| 0:25 a 0:40 | [2. guarda](exercicios/02-guarda.md) | injeção de prompt e guarda em código | `src/regras.ts` | 5 de 7 testes de `test/guarda.test.ts` verdes (os 2 do executor fecham no Exercício 3), `bun run cp6` |
| 0:40 a 1:00 | [3. verificarAprovacao](exercicios/03-aprovacao-pelo-hash.md) | pessoa no circuito, aprovação presa ao hash | `src/autoridade.ts` | `bun test test/autoridade.test.ts test/guarda.test.ts` verde, `bun run cp4` |
| 1:00 a 1:15 | [4. reconciliar](exercicios/04-reconciliar.md) | timeout depois da escrita, idempotência | `src/reconciliar.ts` | `bun test` todo verde, `bun run cp5` |
| 1:15 a 1:35 | [5. O caso que derruba](exercicios/05-caso-que-derruba.md) | eval: workflow contra agente, com a sua chave | `evals/casos.json` | seu `c13` roda e você sabe dizer quem errou e onde |
| 1:35 a 2:00 | [6. ADR](exercicios/06-adr.md) | decidir com número | `docs/adr/` | ADR escrito e revisado em dupla |

A ordem importa: o executor usa a guarda, e o workflow e o eval usam a checagem de duplicidade. Fazendo na ordem, a contagem de `bun test` vai de 39 falhas a zero: 18 depois do Exercício 1, 13 depois do 2, 2 depois do 3 e zero no 4.

## Fim da prática

```bash
bun test && bunx tsc --noEmit
```

Os dois limpos, o `c13` no `evals/casos.json` e o ADR em `docs/adr/`. Quer publicar no seu GitHub? Faça fork; nunca commite o `.env`.
