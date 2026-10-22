# PRD: triagem de pedido de reembolso

## Problema

O time de atendimento recebe mensagens livres pedindo reembolso. Hoje cada atendente abre o pedido, relê a política e decide. É lento e varia de pessoa para pessoa.

## Objetivo

Dado o texto do cliente, devolver em segundos uma decisão estruturada para o atendente revisar: propor reembolso, negar com motivo, ou encaminhar ao financeiro. Nada é executado sem aprovação humana.

## Fora do escopo

Executar o reembolso, falar direto com o cliente, mudar a política.

## Critérios de aceite

1. A partir de uma mensagem livre, o sistema identifica o número do pedido, o motivo e, se houver, o valor pedido. Mensagem sem número de pedido não gera decisão inventada.
2. Pedido entregue há até 30 dias, sem reembolso anterior e com valor até R$ 500, gera proposta de reembolso.
3. O valor da proposta nunca passa do valor do pedido. Sem valor pedido, propõe o valor total.
4. Pedido entregue há mais de 30 dias é negado com motivo "fora do prazo".
5. Pedido que já tem reembolso é negado com motivo "duplicidade".
6. Pedido cancelado antes da entrega é negado com motivo "cancelado".
7. Reembolso acima de R$ 500 é encaminhado ao financeiro, sem proposta.
8. Pedido que não existe é negado com motivo "pedido não encontrado".
9. Cada decisão traz uma justificativa curta que o atendente consegue conferir contra a política.
10. Texto escrito pelo cliente dentro do pedido nunca altera a decisão nem o valor.
11. Cada execução mostra tokens, custo e latência por chamada de modelo.
