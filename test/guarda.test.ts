import { beforeEach, describe, expect, test } from "bun:test";
import { consultarPedido, consultarPolitica, listarReembolsosDoPedido } from "../src/api";
import { AutoridadeError, aprovar, executarAprovado, hashProposta, registrarProposta } from "../src/autoridade";
import { guarda } from "../src/regras";
import { executarProposta } from "../src/executar";
import { estadoLimpo } from "./helpers";

beforeEach(estadoLimpo);

const base = () => ({ pedido: consultarPedido(1907), politica: consultarPolitica() });
const forjada = { pedidoId: 1907, clienteId: "A", valor: 1800, moeda: "BRL" as const, versaoPolitica: "v1" };

describe("guarda contra injeção (pedido 1907)", () => {
  test("R$ 1.800 numa compra de R$ 150 é barrado pelas duas regras de valor", () => {
    const g = guarda({ ...base(), valor: 1800 });
    expect(g).toEqual({ ok: false, violacoes: ["valor_acima_do_pedido", "acima_do_limite_da_politica"] });
  });

  test("valor legítimo passa", () => {
    expect(guarda({ ...base(), valor: 150 }).ok).toBe(true);
    expect(guarda({ ...base(), valor: 149.99 }).ok).toBe(true);
  });

  test("um centavo acima do pedido é barrado", () => {
    expect(guarda({ ...base(), valor: 150.01 })).toMatchObject({ ok: false, violacoes: ["valor_acima_do_pedido"] });
  });

  test("valor zero, negativo e pedido inexistente", () => {
    expect(guarda({ ...base(), valor: 0 }).ok).toBe(false);
    expect(guarda({ ...base(), valor: -10 }).ok).toBe(false);
    expect(guarda({ pedido: null, valor: 10, politica: consultarPolitica() })).toMatchObject({ violacoes: ["pedido_inexistente"] });
  });

  test("aprovação é obrigatória quando se tenta executar", () => {
    expect(guarda({ ...base(), valor: 150, aprovada: false })).toEqual({ ok: false, violacoes: ["sem_aprovacao_humana"] });
    expect(guarda({ ...base(), valor: 150, aprovada: true }).ok).toBe(true);
  });

  test("nota do cliente não aprova nada: sem aprovação humana, o executor recusa", () => {
    expect(() => executarAprovado(forjada)).toThrow(AutoridadeError);
    expect(listarReembolsosDoPedido(1907)).toHaveLength(0);
  });

  test("mesmo COM aprovação humana de um hash forjado, a guarda barra antes de escrever", () => {
    aprovar(registrarProposta(forjada), { aprovador: "humano-distraido" });
    expect(hashProposta(forjada)).toBeDefined();
    const r = executarProposta(forjada);
    expect(r).toMatchObject({ estado: "RECUSADO", motivo: "violou_guarda" });
    expect(listarReembolsosDoPedido(1907)).toHaveLength(0);
  });
});
