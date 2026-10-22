# Execução de reembolso

- Nunca chame `executarReembolso` sem `chaveIdempotencia` e sem `aprovacao`. Sem uma das duas, a chamada nem deve compilar no seu código de aplicação.
- Nenhuma tool exposta a um modelo executa reembolso. O modelo propõe; um humano aprova; o código executa.
- Toda decisão com valor passa por checagem em código: valor maior que zero, não maior que o valor do pedido, dentro do limite da política.
- Em timeout ou erro ambíguo na escrita, não repita a chamada com chave nova. Consulte pela chave antes de qualquer retry.
