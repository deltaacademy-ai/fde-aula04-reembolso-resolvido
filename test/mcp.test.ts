import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { iniciar } from "../src/mcp-server";
import { listarReembolsosDoPedido } from "../src/api";
import { carregarEstado } from "../src/api/estado";
import { estadoLimpo } from "./helpers";

let servidor: ReturnType<typeof iniciar>;
let cliente: Client;

beforeEach(estadoLimpo);
beforeAll(async () => {
  servidor = iniciar(0);
  cliente = new Client({ name: "teste", version: "1.0.0" });
  await cliente.connect(new StreamableHTTPClientTransport(new URL(`http://localhost:${servidor.port}/mcp`)));
});
afterAll(async () => {
  await cliente.close();
  servidor.stop(true);
});

const chamar = async (name: string, args: Record<string, unknown>) => {
  const r: any = await cliente.callTool({ name, arguments: args });
  return { isError: !!r.isError, dados: JSON.parse(r.content[0].text) };
};

describe("servidor MCP", () => {
  test("expõe só consultar_pedido e propor_reembolso, nenhuma de execução", async () => {
    const { tools } = await cliente.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["consultar_pedido", "propor_reembolso"]);
  });

  test("consultar_pedido devolve o pedido 1842", async () => {
    const { dados } = await chamar("consultar_pedido", { pedidoId: 1842 });
    expect(dados).toMatchObject({ id: 1842, valor: 180, diasDesdeEntrega: 10 });
  });

  test("pedido inexistente vem como erro da tool", async () => {
    const r = await chamar("consultar_pedido", { pedidoId: 9999 });
    expect(r.isError).toBe(true);
  });

  test("propor_reembolso devolve proposta e hash, registra pendente e não executa", async () => {
    const { dados } = await chamar("propor_reembolso", { pedidoId: 1842 });
    expect(dados.decisao).toEqual({ tipo: "propor", pedidoId: 1842, valor: 180 });
    expect(dados.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(carregarEstado().propostas[dados.hash]).toBeDefined();
    expect(carregarEstado().aprovacoes).toHaveLength(0);
    expect(listarReembolsosDoPedido(1842)).toHaveLength(0);
  });

  test("negativa e encaminhamento não geram proposta", async () => {
    const neg = await chamar("propor_reembolso", { pedidoId: 1850 });
    expect(neg.dados.decisao).toMatchObject({ tipo: "negar", motivo: "fora_do_prazo" });
    const enc = await chamar("propor_reembolso", { pedidoId: 1875 });
    expect(enc.dados.decisao).toMatchObject({ tipo: "encaminhar" });
    expect(enc.dados.hash).toBeUndefined();
    expect(Object.keys(carregarEstado().propostas)).toHaveLength(0);
  });

  test("valor parcial vira proposta parcial", async () => {
    const { dados } = await chamar("propor_reembolso", { pedidoId: 1842, valorSolicitado: 90 });
    expect(dados.proposta.valor).toBe(90);
  });
});
