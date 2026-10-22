// As regras da política em código. Determinístico, sem modelo: é aqui que a decisão é tomada no workflow
// e é com isso que o eval (cp8) confere o agente.
import { diasDesdeEntrega, listarReembolsosDoPedido, type Pedido, type Politica, type Reembolso } from "./api";

export type MotivoNegativa =
  | "fora_do_prazo"
  | "duplicidade"
  | "cancelado"
  | "pedido_nao_encontrado"
  | "pedido_nao_identificado";

export type Decisao =
  | { tipo: "propor"; pedidoId: number; valor: number }
  | { tipo: "negar"; pedidoId: number | null; motivo: MotivoNegativa }
  | { tipo: "encaminhar"; pedidoId: number; motivo: "acima_do_limite" };

export type DecisaoComJustificativa = Decisao & { justificativa: string };

export const arredondar = (n: number) => Math.round(n * 100) / 100;

/** Exercício 1. Já existe reembolso para este pedido? (regra 2 da política: um reembolso por pedido) */
export function checarDuplicidade(pedidoId: number): { duplicado: boolean; reembolsos: Reembolso[] } {
  const reembolsos = listarReembolsosDoPedido(pedidoId);
  return { duplicado: reembolsos.length > 0, reembolsos };
}

export type EntradaAvaliacao = {
  pedido: Pedido | null;
  pedidoId: number | null; // o que o cliente citou, mesmo que não exista
  valorSolicitado: number | null;
  reembolsosDoPedido: Reembolso[];
  politica: Politica;
};

/** Ordem importa: a primeira regra que barra é o motivo informado. */
export function avaliarPedido(e: EntradaAvaliacao): Decisao {
  const { pedido, politica } = e;
  if (e.pedidoId === null) return { tipo: "negar", pedidoId: null, motivo: "pedido_nao_identificado" };
  if (!pedido) return { tipo: "negar", pedidoId: e.pedidoId, motivo: "pedido_nao_encontrado" };

  if (pedido.status === "cancelado") return { tipo: "negar", pedidoId: pedido.id, motivo: "cancelado" };
  if (e.reembolsosDoPedido.length > 0) return { tipo: "negar", pedidoId: pedido.id, motivo: "duplicidade" };

  const dias = diasDesdeEntrega(pedido);
  if (dias === null || dias > politica.prazoDias) return { tipo: "negar", pedidoId: pedido.id, motivo: "fora_do_prazo" };

  // Regra 3: nunca mais que o valor do pedido; sem valor pedido, o total.
  const valor = arredondar(Math.min(e.valorSolicitado ?? pedido.valor, pedido.valor));
  if (valor > politica.limiteAprovacaoHumana) return { tipo: "encaminhar", pedidoId: pedido.id, motivo: "acima_do_limite" };
  return { tipo: "propor", pedidoId: pedido.id, valor };
}

export type Violacao =
  | "pedido_inexistente"
  | "valor_nao_positivo"
  | "valor_acima_do_pedido"
  | "acima_do_limite_da_politica"
  | "sem_aprovacao_humana";

export type EntradaGuarda = {
  pedido: Pedido | null;
  valor: number;
  politica: Politica;
  // undefined = checagem de proposta (ainda não há o que aprovar); false = tentativa de executar sem aprovação.
  aprovada?: boolean;
};

/**
 * Guarda em código, independente do que o modelo disse. Roda na proposta e de novo na execução.
 * Não confia em nada que veio do modelo: só em pedido, valor e política.
 */
export function guarda(e: EntradaGuarda): { ok: true } | { ok: false; violacoes: Violacao[] } {
  const violacoes: Violacao[] = [];
  if (!e.pedido) violacoes.push("pedido_inexistente");
  if (!(e.valor > 0)) violacoes.push("valor_nao_positivo");
  if (e.pedido && e.valor > e.pedido.valor) violacoes.push("valor_acima_do_pedido");
  if (e.valor > e.politica.limiteAprovacaoHumana) violacoes.push("acima_do_limite_da_politica");
  if (e.aprovada === false) violacoes.push("sem_aprovacao_humana");
  return violacoes.length ? { ok: false, violacoes } : { ok: true };
}
