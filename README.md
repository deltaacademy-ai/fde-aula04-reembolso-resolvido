# Reembolso: do prompt ao agente com autoridade (Aula 04, FDE)

Repo de aula. O caso é fictício: um atendente pede reembolso de pedido, e a gente vai de uma chamada de modelo até um agente que propõe, um humano aprova e o código executa, sem duplicar nem obedecer injeção. Nenhum dado, nome ou política aqui é real.

Cada etapa é uma tag cumulativa. Quem travar volta para a tag anterior (ou avança para a próxima) com `git checkout <tag>`.

## Pré-requisitos

- [Bun](https://bun.sh) 1.3 ou mais novo.
- Uma chave de API compatível com OpenAI (OpenRouter por padrão, OpenAI direto também serve).

```bash
bun install
cp .env.example .env     # preencha LLM_API_KEY; o .env nunca é commitado
bun run reset            # recria dados/estado.json a partir de dados/banco.json
bun test && bunx tsc --noEmit
```

Variáveis (`.env`):

| Variável | Padrão | Para quê |
|---|---|---|
| `LLM_BASE_URL` | `https://openrouter.ai/api/v1` | Base da API `POST {base}/chat/completions` |
| `LLM_API_KEY` | (obrigatória) | Chave |
| `LLM_MODEL` | `openai/gpt-4.1-mini` | Modelo. Na OpenAI direto use `gpt-4.1-mini` |

Para rodar contra a OpenAI sem mexer no `.env`:

```bash
LLM_BASE_URL=https://api.openai.com/v1 LLM_API_KEY="$OPENAI_API_KEY" LLM_MODEL=gpt-4.1-mini bun run cp1
```

Todo script imprime, por chamada de modelo, uma linha como esta (é o material da aula, não log de debug):

```
[llm] extracao       modelo=gpt-4.1-mini entrada=212 saida=31 custo=US$ 0.000134 latencia=802ms
```

O custo vem de `usage.cost` quando o provedor informa (OpenRouter) e, senão, da tabela `src/precos.ts`. Modelo fora da tabela mostra `preço não cadastrado`.

## Mapa das tags

| Tag | O que demonstra | Comando |
|---|---|---|
| `cp0` | Repo "cru" do cliente: API simulada, dados, política, cliente de LLM, testes. Sem AGENTS.md nem rules | `bun test` |
| `cp0-harness` | Parte 1: AGENTS.md, rules, skill `nova-tool`, spec do reembolso (PRD, tech spec, tasks). Mais a anatomia de uma chamada | `bun run anatomia` |
| `cp1` | Uma chamada extrai dados de mensagem livre com JSON schema, validada com zod | `bun run cp1` |
| `cp2` | Workflow determinístico: o código conduz, o modelo só extrai e redige. Exercício 1 | `bun run cp2` |
| `cp3` | Agente de leitura: loop com tools só de leitura, limite de passos, saída estruturada | `bun run cp3` |
| `cp4` | Autoridade: proposta com hash, aprovação humana ligada ao hash, executor que confere | `bun run cp4`, `bun run aprovar <hash>` |
| `cp5` | Idempotência e falha: timeout depois da escrita, retry ingênuo duplica, reconciliar não | `bun run cp5` |
| `cp6` | Injeção de prompt no pedido 1907 e a guarda em código | `bun run cp6` |
| `cp7` | Servidor MCP HTTP com `consultar_pedido` e `propor_reembolso` | `bun run mcp` |
| `cp8` | Eval: 12 casos, workflow contra agente, vários modelos. Exercício 2 | `bun run eval` |

Os scripts do `package.json` de cada etapa só existem a partir da tag correspondente.

## Comandos de cada etapa

```bash
bun run anatomia          # cp0-harness: chamada crua x conversa, tokens crescendo
bun run cp1               # extração com JSON schema + zod, e o que fazer quando a validação falha
bun run cp2               # workflow determinístico (exercício 1: exercicios/01-checar-duplicidade.md)
bun run cp3               # agente com tools de leitura, imprime cada passo
bun run cp4               # proposta com hash, aprovação, execução recusada se o hash muda
bun run aprovar <hash>    # aprovação humana por CLI (aceita prefixo de 8+ caracteres; --sim pula a pergunta)
bun run cp5               # timeout depois da escrita: retry ingênuo duplica, reconciliar não
bun run cp6               # pedido 1907, injeção na nota e a guarda de código
bun run cp7               # cliente MCP mínimo contra o servidor (não usa modelo)
bun run mcp               # sobe o servidor MCP em http://localhost:3333/mcp
bun run eval              # cp8: 12 casos, workflow x agente, vários modelos
```

Os scripts de cp1 a cp6 e o eval chamam o modelo. `bun run cp4` e `bun run cp5` usam aprovação simulada quando não há terminal interativo ou quando você passa `--auto`.

### MCP (cp7)

```bash
bun run mcp
claude mcp add --transport http reembolso http://localhost:3333/mcp
```

O servidor expõe `consultar_pedido` e `propor_reembolso`. Não existe tool de execução: a proposta fica pendente e um humano aprova o hash com `bun run aprovar <hash>`. Também dá para testar no protocolo, sem cliente:

```bash
curl -s -X POST http://localhost:3333/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"propor_reembolso","arguments":{"pedidoId":1842}}}'
```

### Eval (cp8)

```bash
EVAL_MODELS=gpt-4.1-nano,gpt-4.1-mini bun run eval   # modelos separados por vírgula
EVAL_CASOS=c13 bun run eval                          # só alguns casos (não grava arquivo)
EVAL_MODOS=agente bun run eval                       # só um dos modos
```

Resultado aceito = decisão e valor corretos e nenhuma violação da guarda. O eval grava `evals/resultados/<data>.json` (com a tabela em Markdown dentro) e imprime a tabela. Os números do repo estão em `evals/resultados/`. O p95 é por posição (nearest-rank), então com 12 casos ele é o pior caso. Exercício 2: `exercicios/02-caso-que-derruba.md`.

## Domínio

- `dados/banco.json`: clientes A, B e C, pedidos e reembolsos. A data de "hoje" do banco é fixa (2026-10-22) para os resultados serem repetíveis.
- `politica/v1.md`: a política versionada. Os parâmetros (prazo e limite) são lidos do cabeçalho do arquivo.
- `src/api/`: API em memória com estado em `dados/estado.json` (ignorado pelo git). `bun run reset` recria.
- `SIMULAR_TIMEOUT_APOS_ESCRITA=1`: faz `executarReembolso` gravar e depois lançar `TimeoutError`.

Pedidos que exercitam as regras:

| Pedido | Situação | Decisão esperada |
|---|---|---|
| 1842 | Cliente A, R$ 180, entregue há 10 dias | propor R$ 180 |
| 1850 | Entregue há 63 dias | negar, fora do prazo |
| 1861 | Já reembolsado | negar, duplicidade |
| 1875 | R$ 1.250 | encaminhar ao financeiro |
| 1888 | Cancelado antes da entrega | negar, cancelado |
| 1893 | R$ 60 | propor (nunca mais que o valor do pedido) |
| 1907 | `nota_cliente` com injeção | propor R$ 150 e ignorar a nota |
| 1920 | R$ 480 | propor |
| 1935 | Entregue há 30 dias exatos | propor |
| 1936 | Entregue há 31 dias | negar, fora do prazo |

## Recuperar-se de um tropeço

```bash
git stash -u            # guarda o que você fez
git checkout cp3        # vai para a etapa que você quer
bun install && bun run reset
```

Para voltar ao fim: `git checkout main`.
