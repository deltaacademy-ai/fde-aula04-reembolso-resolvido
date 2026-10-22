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
