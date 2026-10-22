import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { paraDecisao, rodarAgenteLeitura } from "../src/03-agente-leitura";
import { silenciar } from "../src/llm";
import { estadoLimpo } from "./helpers";

// Servidor falso que responde com um roteiro fixo, para testar o loop sem modelo.
let servidor: ReturnType<typeof Bun.serve>;
let roteiro: any[] = [];
let corpos: any[] = [];

const usage = { prompt_tokens: 10, completion_tokens: 5 };
const chamadaTool = (nome: string, args: object) => ({
  finish_reason: "tool_calls",
  message: { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: nome, arguments: JSON.stringify(args) } }] },
});
const final = (obj: object) => ({ finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(obj) } });

beforeAll(() => {
  silenciar(true);
  servidor = Bun.serve({
    port: 0,
    async fetch(req) {
      corpos.push(await req.json());
      const escolha = roteiro.shift() ?? chamadaTool("consultar_pedido", { pedidoId: 1842 });
      return Response.json({ choices: [escolha], usage });
    },
  });
  process.env.LLM_BASE_URL = `http://localhost:${servidor.port}`;
  process.env.LLM_API_KEY = "teste";
});
afterAll(() => servidor.stop(true));
beforeEach(() => {
  estadoLimpo();
  roteiro = [];
  corpos = [];
});

describe("loop do agente de leitura", () => {
  test("chama tool, recebe o resultado e conclui", async () => {
    roteiro = [
      chamadaTool("consultar_pedido", { pedidoId: 1842 }),
      final({ tipo: "propor", pedidoId: 1842, valor: 180, motivo: null, justificativa: "ok" }),
    ];
    const r = await rodarAgenteLeitura("quero reembolso do 1842", { silencioso: true });
    expect(r.parou).toBe("concluiu");
    expect(r.passos).toBe(2);
    expect(r.decisao).toMatchObject({ tipo: "propor", pedidoId: 1842, valor: 180 });
    // a segunda chamada levou o resultado da tool
    const msgs = corpos[1].messages;
    expect(msgs.at(-1).role).toBe("tool");
    expect(msgs.at(-1).content).toContain("Fone de ouvido");
  });

  test("limite de passos para o loop e não inventa decisão", async () => {
    // o servidor falso repete tool_call para sempre
    const r = await rodarAgenteLeitura("x", { maxPassos: 3, silencioso: true });
    expect(r.parou).toBe("limite_de_passos");
    expect(r.decisao).toBeNull();
    expect(corpos).toHaveLength(3);
  });

  test("saída final incoerente pede correção em vez de aceitar", async () => {
    roteiro = [
      final({ tipo: "propor", pedidoId: 1842, valor: null, motivo: null, justificativa: "sem valor" }),
      final({ tipo: "propor", pedidoId: 1842, valor: 180, motivo: null, justificativa: "ok" }),
    ];
    const r = await rodarAgenteLeitura("x", { silencioso: true });
    expect(r.parou).toBe("concluiu");
    expect(r.passos).toBe(2);
  });

  test("o modelo nunca recebe tool de escrita", async () => {
    roteiro = [final({ tipo: "negar", pedidoId: null, valor: null, motivo: "pedido_nao_identificado", justificativa: "j" })];
    await rodarAgenteLeitura("x", { silencioso: true });
    const nomes = corpos[0].tools.map((t: any) => t.function.name);
    expect(nomes.some((n: string) => /executar/.test(n))).toBe(false);
  });
});

test("paraDecisao rejeita combinações incoerentes", () => {
  const base = { pedidoId: 1, valor: null, motivo: null, justificativa: "j" } as const;
  expect(paraDecisao({ ...base, tipo: "propor" })).toBeNull();
  expect(paraDecisao({ ...base, tipo: "negar" })).toBeNull();
  expect(paraDecisao({ ...base, tipo: "negar", motivo: "acima_do_limite" })).toBeNull();
  expect(paraDecisao({ ...base, tipo: "encaminhar" })).toMatchObject({ motivo: "acima_do_limite" });
});
