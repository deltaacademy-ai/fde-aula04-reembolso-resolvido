# Exercício 6: ADR do seu projeto

**Entrega:** uma decisão de arquitetura com alternativa, número, limite de autoridade e teste reproduzível. Estado: proposta, até ter o aceite de quem responde pelo resultado. Fato que você ainda não sabe fica "a confirmar", com quem confirma.

Se o seu projeto ainda não tem contexto suficiente, faça o ADR do caso 1842 com os números do seu eval (Exercício 5) e transfira para o projeto na residência.

Escreva em `docs/adr/0001-<sua-decisao>.md`.

## Modelo

**Título, data, responsável e estado** (proposta, aceita ou substituída).

**1. Resultado e dono do aceite.** Que resultado verificável a gente quer, e quem diz se foi atendido?

**2. Restrições e fatos a confirmar.** Dados permitidos, fontes, acessos, efeitos, capacidade humana, prazo e custo. Qual restrição elimina uma opção antes da comparação?

**3. Alternativas e decisão.** Inclua uma opção sem IA e pelo menos outra viável. Ponha o número medido ao lado de cada uma: aceitos, violações, custo por aceito, p50. Se ainda não mediu, escreva qual eval vai medir.

**4. Conhecimento e controle.** De onde vêm os fatos, quem escolhe o próximo passo (código ou modelo) e qual estado fica persistido.

**5. Autoridade e aprovação.** Quais tools cada identidade pode usar, quem aprova exatamente o quê, e como mudança de payload, expiração ou versão invalida a aprovação.

**6. Falha e recuperação.** Um timeout depois da escrita, uma repetição e um efeito proibido. Chave estável da operação, reconciliação e encaminhamento.

**7. Avaliação e economia.** Entrada, decisão esperada e efeito proibido de um caso comum e de 2 casos de falha. Como vai observar custo por resultado aceito, latência e trabalho humano.

**8. Consequências e revisão.** Que custo ou dependência você aceita, que resultado faria trocar a decisão, quem pode interromper o piloto.

**9. Primeira ação.** Ação pequena, responsável, prazo e evidência esperada. Se faltar autorização, a primeira ação é obter a autorização; teste com dado sintético pode seguir.

## Revisão em dupla

Troque o ADR com alguém. Marque cada linha como **atende**, **corrigir** ou **a confirmar**, com a evidência que achou.

| Critério | O revisor procura | Pede correção |
|---|---|---|
| Resultado e aceite | Estado final observável e dono nomeado | Sucesso definido pela mensagem do modelo |
| Alternativas | Opção sem IA e número ao lado de cada opção | Comparação sem medida ou com casos diferentes |
| Autoridade | Quem aprova exatamente o quê, executor que confere | Prompt como único controle de permissão |
| Falha parcial | Estado desconhecido, chave estável, reconciliação | Retry com chave nova depois de timeout |
| Avaliação | Casos com esperado, incluindo falha e conteúdo adversarial | Só caminho feliz, ou só texto bonito |
| Economia | Custo por aceito e trabalho humano | Custo por chamada tratado como custo por resultado |
| Revisão | Gatilho de troca, quem interrompe, primeira ação | Piloto sem dono |

Referências de formato: Nygard, "Documenting Architecture Decisions" (cognitect.com, 15/11/2011) e MADR (adr.github.io/madr). A adaptação dos campos é proposta da aula.
