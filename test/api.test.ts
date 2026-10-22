import { beforeEach, describe, expect, test } from "bun:test";
import {
  TimeoutError,
  consultarPedido,
  consultarPolitica,
  consultarReembolsoPorChave,
  diasDesdeEntrega,
  executarReembolso,
  listarReembolsosDoCliente,
  listarReembolsosDoPedido,
} from "../src/api";
import { estadoLimpo } from "./helpers";

beforeEach(estadoLimpo);

describe("consultas", () => {
  test("pedido 1842 é do cliente A, R$ 180, entregue há 10 dias", () => {
    const p = consultarPedido(1842)!;
    expect(p.clienteId).toBe("A");
    expect(p.valor).toBe(180);
    expect(diasDesdeEntrega(p)).toBe(10);
    expect(listarReembolsosDoPedido(1842)).toHaveLength(0);
  });

  test("pedido inexistente devolve null", () => {
    expect(consultarPedido(9999)).toBeNull();
  });

  test("reembolsos do cliente", () => {
    expect(listarReembolsosDoCliente("B")).toHaveLength(1);
    expect(listarReembolsosDoCliente("A")).toHaveLength(0);
  });

  test("política lê parâmetros do arquivo", () => {
    const pol = consultarPolitica();
    expect(pol.versao).toBe("v1");
    expect(pol.prazoDias).toBe(30);
    expect(pol.limiteAprovacaoHumana).toBe(500);
    expect(pol.texto).toContain("duplicidade");
  });

  test("versão de política inválida é recusada", () => {
    expect(() => consultarPolitica("../x")).toThrow();
  });
});

describe("executarReembolso", () => {
  const args = { pedidoId: 1842, valor: 180, chaveIdempotencia: "k1", aprovacao: "ap1" };

  test("exige chave e aprovação", () => {
    expect(() => executarReembolso({ ...args, chaveIdempotencia: "" })).toThrow();
    expect(() => executarReembolso({ ...args, aprovacao: "" })).toThrow();
  });

  test("grava e consulta pela chave", () => {
    const r = executarReembolso(args);
    expect(r.valor).toBe(180);
    expect(consultarReembolsoPorChave("k1")).toEqual(r);
  });

  test("mesma chave devolve o mesmo reembolso, sem duplicar", () => {
    const a = executarReembolso(args);
    const b = executarReembolso(args);
    expect(b).toEqual(a);
    expect(listarReembolsosDoPedido(1842)).toHaveLength(1);
  });

  test("chave nova para o mesmo pedido duplica (a API não dedupe por pedido)", () => {
    executarReembolso(args);
    executarReembolso({ ...args, chaveIdempotencia: "k2" });
    expect(listarReembolsosDoPedido(1842)).toHaveLength(2);
  });

  test("timeout simulado: a escrita acontece e a função lança", () => {
    process.env.SIMULAR_TIMEOUT_APOS_ESCRITA = "1";
    expect(() => executarReembolso(args)).toThrow(TimeoutError);
    expect(consultarReembolsoPorChave("k1")).not.toBeNull();
  });

  test("timeout simulado não dispara quando a chave já existe", () => {
    executarReembolso(args);
    process.env.SIMULAR_TIMEOUT_APOS_ESCRITA = "1";
    expect(executarReembolso(args).chaveIdempotencia).toBe("k1");
  });
});
