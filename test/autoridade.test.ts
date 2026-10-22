import { beforeEach, describe, expect, test } from "bun:test";
import { consultarPolitica, listarReembolsosDoPedido } from "../src/api";
import {
  AutoridadeError, aprovar, canonico, chaveIdempotencia, criarProposta, executarAprovado,
  hashProposta, registrarProposta, resolverHash, verificarAprovacao,
} from "../src/autoridade";
import { estadoLimpo } from "./helpers";

const proposta = () => criarProposta({ tipo: "propor", pedidoId: 1842, valor: 180 }, consultarPolitica());

beforeEach(estadoLimpo);

describe("hash e payload canônico", () => {
  test("mesma proposta, mesmo hash; valor diferente, hash diferente", () => {
    const p = proposta();
    expect(hashProposta(p)).toBe(hashProposta({ ...p }));
    expect(hashProposta({ ...p, valor: 181 })).not.toBe(hashProposta(p));
    expect(hashProposta(p)).toMatch(/^[0-9a-f]{64}$/);
  });
  test("ordem das chaves e 180 vs 180.00 não mudam o hash", () => {
    const p = proposta();
    const embaralhada = { versaoPolitica: p.versaoPolitica, valor: 180.0, moeda: p.moeda, clienteId: p.clienteId, pedidoId: p.pedidoId };
    expect(canonico(embaralhada as typeof p)).toBe(canonico(p));
  });
  test("só decisão 'propor' vira proposta", () => {
    expect(() => criarProposta({ tipo: "negar", pedidoId: 1, motivo: "cancelado" }, consultarPolitica())).toThrow();
  });
});

describe("aprovação ligada ao hash", () => {
  test("sem aprovação, o executor recusa e nada é gravado", () => {
    const p = proposta();
    registrarProposta(p);
    expect(() => executarAprovado(p)).toThrow(AutoridadeError);
    expect(listarReembolsosDoPedido(1842)).toHaveLength(0);
  });

  test("aprovada, executa", () => {
    const p = proposta();
    aprovarProposta(p);
    const r = executarAprovado(p);
    expect(r.valor).toBe(180);
    expect(r.chaveIdempotencia).toBe(chaveIdempotencia(p));
  });

  test("hash diferente é recusado: alterar o valor depois de aprovar", () => {
    const p = proposta();
    aprovarProposta(p);
    const v = verificarAprovacao({ ...p, valor: 1800 });
    expect(v).toEqual({ ok: false, motivo: "sem_aprovacao_para_este_hash" });
    expect(() => executarAprovado({ ...p, valor: 1800 })).toThrow(AutoridadeError);
    expect(listarReembolsosDoPedido(1842)).toHaveLength(0);
  });

  test("aprovação vencida é recusada", () => {
    const p = proposta();
    registrarProposta(p);
    aprovar(hashProposta(p), { aprovador: "t", agora: new Date("2026-10-22T10:00:00Z"), validadeMin: 15 });
    expect(verificarAprovacao(p, new Date("2026-10-22T10:14:00Z")).ok).toBe(true);
    expect(verificarAprovacao(p, new Date("2026-10-22T10:16:00Z"))).toEqual({ ok: false, motivo: "aprovacao_vencida" });
  });

  test("aprovar hash inexistente falha; prefixo curto não vale", () => {
    const p = proposta();
    const h = registrarProposta(p);
    expect(() => aprovar("deadbeef", { aprovador: "t" })).toThrow();
    expect(() => resolverHash(h.slice(0, 4))).toThrow();
    expect(resolverHash(h.slice(0, 12))).toBe(h);
  });

  test("chave de idempotência é estável e depende do hash", () => {
    const p = proposta();
    expect(chaveIdempotencia(p)).toBe(chaveIdempotencia({ ...p }));
    expect(chaveIdempotencia({ ...p, valor: 90 })).not.toBe(chaveIdempotencia(p));
  });
});

function aprovarProposta(p: ReturnType<typeof proposta>) {
  const h = registrarProposta(p);
  aprovar(h, { aprovador: "teste" });
}
