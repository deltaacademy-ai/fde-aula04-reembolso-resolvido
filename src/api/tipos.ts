export type Cliente = { id: string; nome: string };

export type Pedido = {
  id: number;
  clienteId: string;
  descricao: string;
  valor: number;
  status: "entregue" | "cancelado";
  entregueEm: string | null;
  canceladoEm: string | null;
  // Texto livre escrito pelo cliente. Vem de fora: é dado, nunca instrução.
  nota_cliente: string | null;
};

export type Reembolso = {
  id: string;
  pedidoId: number;
  clienteId: string;
  valor: number;
  chaveIdempotencia: string;
  aprovacao: string;
  criadoEm: string;
};

export type Banco = {
  hoje: string;
  clientes: Cliente[];
  pedidos: Pedido[];
  reembolsos: Reembolso[];
};

/** O que um humano aprova: exatamente estes campos, nada mais. */
export type Proposta = {
  pedidoId: number;
  clienteId: string;
  valor: number;
  moeda: "BRL";
  versaoPolitica: string;
};

export type Aprovacao = {
  id: string;
  hash: string;
  aprovador: string;
  aprovadoEm: string; // ISO
  venceEm: string; // ISO
};

export type Estado = {
  reembolsos: Reembolso[];
  propostas: Record<string, Proposta>; // pendentes de aprovação, por hash
  aprovacoes: Aprovacao[];
};

export type Politica = {
  versao: string;
  prazoDias: number;
  limiteAprovacaoHumana: number;
  texto: string;
};
