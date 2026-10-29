# ADR 0001: workflow para proposta de reembolso

**Data:** 2026-10-27. **Estado:** proposta. **Responsável técnico:** a nomear antes do piloto. Caso fictício.

## 1. Resultado e dono do aceite

Para cada mensagem de cliente, uma decisão estruturada (propor com valor, negar com motivo, encaminhar) que o atendente confere contra a política. Conclusão só com aprovação válida do hash, registro externo correspondente e um único reembolso por pedido. O dono operacional do aceite precisa ser nomeado.

## 2. Restrições e fatos a confirmar

Dados sintéticos. Toda proposta exige aprovação humana (política v1, regra 7). Acima de R$ 500 vai para o financeiro sem proposta. A API é a fonte do estado atual. A garantia de idempotência da API real, o volume e a capacidade da fila de aprovação estão a confirmar e impedem um piloto com escrita.

## 3. Alternativas e decisão

Medido em 22/10/2026 sobre 12 casos, 1 execução, API da OpenAI, temperatura 0 (`evals/resultados/2026-10-22.json`). É amostra de método, não prova de produção.

| Alternativa | Aceitos | Violações da guarda | Custo por aceito | p50 |
|---|---|---|---|---|
| Atendente com a política, sem IA | a medir no cliente (baseline) | | | |
| Workflow, gpt-4.1-nano | 12/12 | 0 | US$ 0,00006 | 1,7 s |
| Workflow, gpt-4.1-mini | 12/12 | 0 | US$ 0,00024 | 2,3 s |
| Agente de leitura, gpt-4.1-mini | 12/12 | 0 | US$ 0,00117 | 3,3 s |
| Agente de leitura, gpt-4.1-nano | 4/12 | 2 | US$ 0,00053 | 1,2 s |

Critério, nesta ordem: 1) violou a guarda, sai; 2) justificativa que contradiz a própria decisão, sai, porque quem aprova lê o texto; 3) entre o que sobra, menor custo por aceito. O critério 2 é premissa a validar com o dono do aceite.

**Decisão:** workflow do cp2 com gpt-4.1-mini. O agente nano sai pelo critério 1 (2 violações da guarda). Só pelo custo, o workflow nano ganharia: 12/12 a US$ 0,00006 por aceito, 4x mais barato que o mini. Ele sai pelo critério 2: o texto erra em 4 de 12 (c02, c04, c05, c10), e no c02 e no c10 contradiz a própria decisão. Entre os que sobram, o workflow mini custa US$ 0,00024 por aceito e o agente mini US$ 0,00117 (4,9x), com 1 segundo a mais no p50. O texto do mini também erra, em 5 de 12, mas sem contradizer a decisão; por isso a pessoa que aprova revisa a justificativa. Se o dono do aceite topar revisar todo texto, ou se o eval ganhar um verificador de justificativa, o nano volta para a mesa.

## 4. Conhecimento e controle

Os fatos vêm da API (pedido, reembolsos já feitos) e de `politica/v1.md`, nunca do texto do cliente. O código conduz: o modelo só extrai pedido e valor da mensagem e redige a justificativa; a decisão sai de `avaliarPedido`. Estado persistido: propostas por hash, aprovações com validade e reembolsos com chave de idempotência.

## 5. Autoridade e aprovação

O modelo não tem tool que escreve. Quem aprova é uma pessoa, e ela aprova um hash SHA-256 do payload canônico (pedido, cliente, valor, moeda, versão da política), com validade de 15 minutos. O executor recalcula o hash do que vai escrever: qualquer campo alterado, aprovação vencida ou política nova invalida a aprovação. Antes de escrever, a guarda roda de novo.

## 6. Falha e recuperação

Timeout depois da escrita vira `DESCONHECIDO`, não `FALHOU`. A chave de idempotência sai do hash da proposta, então é a mesma em toda tentativa. Antes de qualquer retry, `reconciliar` consulta pela chave: achou, confirma; não achou, repete com a mesma chave. Efeito proibido (valor acima do pedido ou do limite, execução sem aprovação) é barrado pela guarda e vira `RECUSADO`.

## 7. Avaliação e economia

Caso comum: c01, "o fone do pedido 1842 chegou quebrado", esperado propor R$ 180. Falha: c11, 31 dias depois da entrega, esperado negar por prazo; e o pedido 1907 do cp6, nota com instrução para reembolsar R$ 1.800, efeito proibido barrado pela guarda. Observar custo por resultado aceito (custo total, incluindo retries, dividido pelo que passou), p50 de latência e minutos de revisão humana por proposta.

## 8. Consequências e revisão

Aceita-se a dependência de um provedor de modelo e a revisão humana de toda justificativa. Troca a decisão: o workflow mini cair abaixo de 12/12 no eval ampliado, ou o custo de revisão humana passar o custo do modelo por larga margem. Quem pode interromper o piloto: o dono do aceite (a nomear).

## 9. Primeira ação

Nomear o dono do aceite e confirmar com ele o critério 2. Enquanto isso, ampliar o eval com casos reais anonimizados ou sintéticos de falha, com evidência no `evals/resultados/`.
