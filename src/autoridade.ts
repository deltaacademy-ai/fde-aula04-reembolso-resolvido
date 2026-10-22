// Quem decide e quem executa. O modelo propõe; um humano aprova um HASH; o código só executa o que bate com o hash.
import { createHash } from "node:crypto";
import {
  consultarPedido,
  executarReembolso,
  type Aprovacao,
  type Politica,
  type Proposta,
  type Reembolso,
} from "./api";
import { carregarEstado, salvarEstado } from "./api/estado";
import type { Decisao } from "./regras";

export const VALIDADE_PADRAO_MIN = 15;

export type MotivoRecusa = "sem_aprovacao_para_este_hash" | "aprovacao_vencida";

export class AutoridadeError extends Error {
  constructor(public motivo: MotivoRecusa, detalhe: string) {
    super(`execução recusada (${motivo}): ${detalhe}`);
    this.name = "AutoridadeError";
  }
}

export function criarProposta(decisao: Decisao, politica: Politica): Proposta {
  if (decisao.tipo !== "propor") throw new Error(`só decisão "propor" vira proposta, recebi "${decisao.tipo}"`);
  const pedido = consultarPedido(decisao.pedidoId);
  if (!pedido) throw new Error(`pedido ${decisao.pedidoId} não existe`);
  return {
    pedidoId: pedido.id,
    clienteId: pedido.clienteId,
    valor: decisao.valor,
    moeda: "BRL",
    versaoPolitica: politica.versao,
  };
}

/** Payload canônico: mesmas chaves, mesma ordem, valor com duas casas. Mesma proposta, mesmos bytes. */
export function canonico(p: Proposta): string {
  return JSON.stringify({
    clienteId: p.clienteId,
    moeda: p.moeda,
    pedidoId: p.pedidoId,
    valor: p.valor.toFixed(2),
    versaoPolitica: p.versaoPolitica,
  });
}

export const hashProposta = (p: Proposta) => createHash("sha256").update(canonico(p)).digest("hex");

/** A chave de idempotência é estável: a mesma proposta aprovada sempre gera a mesma chave. */
export const chaveIdempotencia = (p: Proposta) =>
  createHash("sha256").update(`${p.pedidoId}|${p.versaoPolitica}|${hashProposta(p)}`).digest("hex");

export function registrarProposta(p: Proposta): string {
  const hash = hashProposta(p);
  const estado = carregarEstado();
  estado.propostas[hash] = p;
  salvarEstado(estado);
  return hash;
}

/** Aceita o hash completo ou um prefixo único de 8+ caracteres (é o que o humano digita). */
export function resolverHash(hashOuPrefixo: string): string {
  const { propostas } = carregarEstado();
  if (propostas[hashOuPrefixo]) return hashOuPrefixo;
  const achados = Object.keys(propostas).filter((h) => hashOuPrefixo.length >= 8 && h.startsWith(hashOuPrefixo));
  if (achados.length !== 1) throw new Error(`nenhuma proposta pendente única para "${hashOuPrefixo}"`);
  return achados[0]!;
}

export function aprovar(
  hashOuPrefixo: string,
  opcoes: { aprovador: string; agora?: Date; validadeMin?: number },
): { proposta: Proposta; aprovacao: Aprovacao } {
  const hash = resolverHash(hashOuPrefixo);
  const estado = carregarEstado();
  const proposta = estado.propostas[hash]!;
  const agora = opcoes.agora ?? new Date();
  const validade = (opcoes.validadeMin ?? VALIDADE_PADRAO_MIN) * 60_000;
  const aprovacao: Aprovacao = {
    id: `ap-${hash.slice(0, 12)}`,
    hash,
    aprovador: opcoes.aprovador,
    aprovadoEm: agora.toISOString(),
    venceEm: new Date(agora.getTime() + validade).toISOString(),
  };
  estado.aprovacoes = [...estado.aprovacoes.filter((a) => a.hash !== hash), aprovacao];
  salvarEstado(estado);
  return { proposta, aprovacao };
}

export type Verificacao = { ok: true; aprovacao: Aprovacao } | { ok: false; motivo: MotivoRecusa };

/** Recalcula o hash do que VAI ser executado. Alterou qualquer campo depois da aprovação? Outro hash, sem aprovação. */
export function verificarAprovacao(proposta: Proposta, agora = new Date()): Verificacao {
  const hash = hashProposta(proposta);
  const aprovacao = carregarEstado().aprovacoes.find((a) => a.hash === hash);
  if (!aprovacao) return { ok: false, motivo: "sem_aprovacao_para_este_hash" };
  if (agora.getTime() > Date.parse(aprovacao.venceEm)) return { ok: false, motivo: "aprovacao_vencida" };
  return { ok: true, aprovacao };
}

/** O executor: confere a aprovação e só então escreve. O modelo não tem acesso a esta função. */
export function executarAprovado(proposta: Proposta, agora = new Date()): Reembolso {
  const v = verificarAprovacao(proposta, agora);
  if (!v.ok) throw new AutoridadeError(v.motivo, `hash ${hashProposta(proposta).slice(0, 12)}`);
  return executarReembolso({
    pedidoId: proposta.pedidoId,
    valor: proposta.valor,
    chaveIdempotencia: chaveIdempotencia(proposta),
    aprovacao: v.aprovacao.id,
  });
}
