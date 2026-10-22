import { afterAll, beforeAll, expect, test } from "bun:test";
import { chat, silenciar } from "../src/llm";
import { buscarPreco, calcularCusto, formatarCusto } from "../src/precos";

let servidor: ReturnType<typeof Bun.serve>;
let corpoRecebido: any;
let usage: any = { prompt_tokens: 1_000_000, completion_tokens: 500_000 };

beforeAll(() => {
  silenciar(true);
  servidor = Bun.serve({
    port: 0,
    async fetch(req) {
      corpoRecebido = await req.json();
      return Response.json({
        choices: [{ finish_reason: "stop", message: { role: "assistant", content: "oi" } }],
        usage,
      });
    },
  });
  process.env.LLM_BASE_URL = `http://localhost:${servidor.port}`;
  process.env.LLM_API_KEY = "teste";
});
afterAll(() => servidor.stop(true));

test("custo vem da tabela de preço", async () => {
  const r = await chat({ messages: [{ role: "user", content: "x" }], modelo: "gpt-4.1-mini" });
  // 1M entrada * 0,40 + 0,5M saída * 1,60
  expect(r.chamada.custoUsd).toBeCloseTo(0.4 + 0.8, 6);
  expect(r.chamada.tokensEntrada).toBe(1_000_000);
  expect(corpoRecebido.model).toBe("gpt-4.1-mini");
});

test("usage.cost (OpenRouter) vence a tabela", async () => {
  usage = { prompt_tokens: 10, completion_tokens: 10, cost: 0.123 };
  const r = await chat({ messages: [{ role: "user", content: "x" }], modelo: "gpt-4.1-mini" });
  expect(r.chamada.custoUsd).toBe(0.123);
});

test("modelo sem preço mostra 'preço não cadastrado'", async () => {
  usage = { prompt_tokens: 10, completion_tokens: 10 };
  const r = await chat({ messages: [{ role: "user", content: "x" }], modelo: "modelo-inventado" });
  expect(r.chamada.custoUsd).toBeNull();
  expect(formatarCusto(r.chamada.custoUsd)).toBe("preço não cadastrado");
});

test("preço aceita prefixo openai/ e snapshot com data", () => {
  expect(buscarPreco("openai/gpt-4.1-mini")).not.toBeNull();
  expect(buscarPreco("gpt-4.1-mini-2025-04-14")).not.toBeNull();
  expect(calcularCusto("desconhecido", 1, 1)).toBeNull();
});
