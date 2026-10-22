import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { caminhoPoliticas, carregarBanco, carregarEstado, salvarEstado } from "./estado";
import type { Pedido, Politica, Reembolso } from "./tipos";

export * from "./tipos";

export class TimeoutError extends Error {
  constructor() {
    super("timeout ao aguardar resposta do sistema de reembolsos");
    this.name = "TimeoutError";
  }
}

export function hoje(): string {
  return carregarBanco().hoje;
}

export function consultarPedido(pedidoId: number): Pedido | null {
  return carregarBanco().pedidos.find((p) => p.id === pedidoId) ?? null;
}

export function listarReembolsosDoCliente(clienteId: string): Reembolso[] {
  return carregarEstado().reembolsos.filter((r) => r.clienteId === clienteId);
}

export function listarReembolsosDoPedido(pedidoId: number): Reembolso[] {
  return carregarEstado().reembolsos.filter((r) => r.pedidoId === pedidoId);
}

export function consultarReembolsoPorChave(chave: string): Reembolso | null {
  return carregarEstado().reembolsos.find((r) => r.chaveIdempotencia === chave) ?? null;
}

export function consultarPolitica(versao = "v1"): Politica {
  if (!/^[a-z0-9]+$/i.test(versao)) throw new Error(`versão de política inválida: ${versao}`);
  const texto = readFileSync(resolve(caminhoPoliticas(), `${versao}.md`), "utf8");
  const campo = (nome: string) => {
    const m = texto.match(new RegExp(`^${nome}:\\s*(.+)$`, "m"));
    if (!m) throw new Error(`política ${versao} sem o campo ${nome}`);
    return m[1]!.trim();
  };
  return {
    versao: campo("versao"),
    prazoDias: Number(campo("prazo_dias")),
    limiteAprovacaoHumana: Number(campo("limite_aprovacao_humana")),
    texto,
  };
}

/** Dias inteiros entre a entrega e a data "de hoje" do banco fictício. Null se não houve entrega. */
export function diasDesdeEntrega(pedido: Pedido): number | null {
  if (!pedido.entregueEm) return null;
  const ms = Date.parse(`${hoje()}T00:00:00Z`) - Date.parse(`${pedido.entregueEm}T00:00:00Z`);
  return Math.floor(ms / 86_400_000);
}

export type ExecutarReembolsoArgs = {
  pedidoId: number;
  valor: number;
  chaveIdempotencia: string;
  aprovacao: string;
};

/**
 * Idempotente pela chave: a mesma chave devolve o mesmo reembolso, sem escrever de novo.
 * Com SIMULAR_TIMEOUT_APOS_ESCRITA=1 a escrita acontece e a função lança TimeoutError em seguida,
 * que é exatamente o cenário em que o chamador não sabe se deu certo.
 */
export function executarReembolso(args: ExecutarReembolsoArgs): Reembolso {
  if (!args.chaveIdempotencia) throw new Error("chaveIdempotencia obrigatória");
  if (!args.aprovacao) throw new Error("aprovacao obrigatória");

  const estado = carregarEstado();
  const existente = estado.reembolsos.find((r) => r.chaveIdempotencia === args.chaveIdempotencia);
  if (existente) return existente;

  const pedido = consultarPedido(args.pedidoId);
  if (!pedido) throw new Error(`pedido ${args.pedidoId} não existe`);
  if (!(args.valor > 0)) throw new Error("valor deve ser positivo");

  const reembolso: Reembolso = {
    id: `R-${String(estado.reembolsos.length + 1).padStart(4, "0")}`,
    pedidoId: pedido.id,
    clienteId: pedido.clienteId,
    valor: args.valor,
    chaveIdempotencia: args.chaveIdempotencia,
    aprovacao: args.aprovacao,
    criadoEm: hoje(),
  };
  estado.reembolsos.push(reembolso);
  salvarEstado(estado);

  if (process.env.SIMULAR_TIMEOUT_APOS_ESCRITA === "1") throw new TimeoutError();
  return reembolso;
}
