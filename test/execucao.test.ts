import { beforeEach, describe, expect, test } from "bun:test";
import { consultarPolitica, executarReembolso, listarReembolsosDoPedido } from "../src/api";
import { aprovar, criarProposta, registrarProposta } from "../src/autoridade";
import { executarProposta } from "../src/executar";
import { reconciliar, resolverExecucao } from "../src/reconciliar";
import { estadoLimpo } from "./helpers";

const proposta = () => criarProposta({ tipo: "propor", pedidoId: 1842, valor: 180 }, consultarPolitica());
const aprovada = () => {
  const p = proposta();
  aprovar(registrarProposta(p), { aprovador: "teste" });
  return p;
};

beforeEach(estadoLimpo);

describe("executar", () => {
  test("sem aprovação é RECUSADO e não escreve", () => {
    const r = executarProposta(proposta());
    expect(r.estado).toBe("RECUSADO");
    expect(listarReembolsosDoPedido(1842)).toHaveLength(0);
  });

  test("aprovada e sem falha: CONFIRMADO", () => {
    const r = executarProposta(aprovada());
    expect(r.estado).toBe("CONFIRMADO");
  });

  test("timeout depois da escrita vira DESCONHECIDO, e a escrita aconteceu", () => {
    const p = aprovada();
    process.env.SIMULAR_TIMEOUT_APOS_ESCRITA = "1";
    const r = executarProposta(p);
    expect(r.estado).toBe("DESCONHECIDO");
    expect(listarReembolsosDoPedido(1842)).toHaveLength(1);
  });
});

describe("falha: retry ingênuo duplica, reconciliar não", () => {
  test("retry ingênuo com chave nova cria reembolso duplicado", () => {
    const p = aprovada();
    process.env.SIMULAR_TIMEOUT_APOS_ESCRITA = "1";
    executarProposta(p);
    delete process.env.SIMULAR_TIMEOUT_APOS_ESCRITA;
    executarReembolso({ pedidoId: 1842, valor: 180, chaveIdempotencia: "chave-nova", aprovacao: "x" });
    expect(listarReembolsosDoPedido(1842)).toHaveLength(2);
  });

  test("reconciliar encontra o reembolso e confirma, sem duplicar", () => {
    const p = aprovada();
    process.env.SIMULAR_TIMEOUT_APOS_ESCRITA = "1";
    const r = executarProposta(p);
    delete process.env.SIMULAR_TIMEOUT_APOS_ESCRITA;
    const rec = reconciliar(r.chave);
    expect(rec.estado).toBe("CONFIRMADO");
    expect(resolverExecucao(p, r).estado).toBe("CONFIRMADO");
    expect(listarReembolsosDoPedido(1842)).toHaveLength(1);
  });

  test("retry com a mesma chave também não duplica", () => {
    const p = aprovada();
    process.env.SIMULAR_TIMEOUT_APOS_ESCRITA = "1";
    executarProposta(p);
    delete process.env.SIMULAR_TIMEOUT_APOS_ESCRITA;
    expect(executarProposta(p).estado).toBe("CONFIRMADO");
    expect(listarReembolsosDoPedido(1842)).toHaveLength(1);
  });

  test("nada escrito: NAO_EXECUTADO e resolver repete com a mesma chave", () => {
    const p = aprovada();
    const falso = { estado: "DESCONHECIDO" as const, chave: "qualquer", erro: "timeout" };
    expect(reconciliar("qualquer").estado).toBe("NAO_EXECUTADO");
    const r = resolverExecucao(p, falso);
    expect(r.estado).toBe("CONFIRMADO");
    expect(listarReembolsosDoPedido(1842)).toHaveLength(1);
  });
});
