import { beforeEach, describe, expect, test } from "bun:test";
import { consultarPedido, consultarPolitica, executarReembolso } from "../src/api";
import { avaliarPedido, checarDuplicidade, type Decisao } from "../src/regras";
import { estadoLimpo } from "./helpers";

beforeEach(estadoLimpo);

function decidir(pedidoId: number, valorSolicitado: number | null = null): Decisao {
  return avaliarPedido({
    pedido: consultarPedido(pedidoId),
    pedidoId,
    valorSolicitado,
    reembolsosDoPedido: checarDuplicidade(pedidoId).reembolsos,
    politica: consultarPolitica(),
  });
}

describe("cada pedido do banco cai na decisão certa", () => {
  const casos: [string, number, number | null, Decisao][] = [
    ["1842 dentro do prazo, valor total", 1842, null, { tipo: "propor", pedidoId: 1842, valor: 180 }],
    ["1842 reembolso parcial", 1842, 90, { tipo: "propor", pedidoId: 1842, valor: 90 }],
    ["1850 fora do prazo", 1850, null, { tipo: "negar", pedidoId: 1850, motivo: "fora_do_prazo" }],
    ["1861 duplicidade", 1861, null, { tipo: "negar", pedidoId: 1861, motivo: "duplicidade" }],
    ["1875 acima do limite", 1875, null, { tipo: "encaminhar", pedidoId: 1875, motivo: "acima_do_limite" }],
    ["1875 parcial dentro do limite", 1875, 300, { tipo: "propor", pedidoId: 1875, valor: 300 }],
    ["1888 cancelado", 1888, null, { tipo: "negar", pedidoId: 1888, motivo: "cancelado" }],
    ["1893 pede mais que o pedido: limita ao valor do pedido", 1893, 100, { tipo: "propor", pedidoId: 1893, valor: 60 }],
    ["1907 a nota do cliente não muda a decisão", 1907, null, { tipo: "propor", pedidoId: 1907, valor: 150 }],
    ["1920 abaixo do limite", 1920, null, { tipo: "propor", pedidoId: 1920, valor: 480 }],
    ["1935 exatamente 30 dias ainda vale", 1935, null, { tipo: "propor", pedidoId: 1935, valor: 200 }],
    ["1936 31 dias já passou", 1936, null, { tipo: "negar", pedidoId: 1936, motivo: "fora_do_prazo" }],
    ["9999 não existe", 9999, null, { tipo: "negar", pedidoId: 9999, motivo: "pedido_nao_encontrado" }],
  ];
  for (const [nome, id, valor, esperado] of casos) {
    test(nome, () => expect(decidir(id, valor)).toEqual(esperado));
  }

  test("limite de R$ 500 é inclusivo", () => {
    const base = { pedido: consultarPedido(1875), pedidoId: 1875, reembolsosDoPedido: [], politica: consultarPolitica() };
    expect(avaliarPedido({ ...base, valorSolicitado: 500 })).toEqual({ tipo: "propor", pedidoId: 1875, valor: 500 });
    expect(avaliarPedido({ ...base, valorSolicitado: 500.01 }).tipo).toBe("encaminhar");
  });

  test("sem pedido citado não há decisão inventada", () => {
    const d = avaliarPedido({
      pedido: null, pedidoId: null, valorSolicitado: null, reembolsosDoPedido: [], politica: consultarPolitica(),
    });
    expect(d).toEqual({ tipo: "negar", pedidoId: null, motivo: "pedido_nao_identificado" });
  });
});

describe("checarDuplicidade (exercício 1)", () => {
  test("pedido já reembolsado", () => {
    const r = checarDuplicidade(1861);
    expect(r.duplicado).toBe(true);
    expect(r.reembolsos.map((x) => x.id)).toEqual(["R-0001"]);
  });
  test("pedido sem reembolso", () => {
    expect(checarDuplicidade(1842)).toEqual({ duplicado: false, reembolsos: [] });
  });
  test("pedido inexistente não lança", () => {
    expect(checarDuplicidade(9999).duplicado).toBe(false);
  });
  test("passa a detectar depois que um reembolso é executado", () => {
    executarReembolso({ pedidoId: 1842, valor: 180, chaveIdempotencia: "k", aprovacao: "a" });
    expect(checarDuplicidade(1842).duplicado).toBe(true);
  });
});
