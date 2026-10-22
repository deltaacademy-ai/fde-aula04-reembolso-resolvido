import { beforeEach, describe, expect, test } from "bun:test";
import { executarReembolso } from "../src/api";
import { TOOLS, definicoesParaModelo, executarTool } from "../src/tools";
import { estadoLimpo } from "./helpers";

beforeEach(estadoLimpo);

describe("tools de leitura", () => {
  test("só existem tools de leitura, nenhuma de execução", () => {
    expect(TOOLS.map((t) => t.nome).sort()).toEqual([
      "checar_duplicidade", "consultar_pedido", "consultar_politica", "listar_reembolsos_do_cliente",
    ]);
    expect(TOOLS.some((t) => /executar|reembolsar/.test(t.nome))).toBe(false);
  });

  test("chamar todas as tools não altera o estado", () => {
    const antes = JSON.stringify(executarTool("listar_reembolsos_do_cliente", '{"clienteId":"B"}'));
    executarTool("consultar_pedido", '{"pedidoId":1842}');
    executarTool("consultar_politica", "{}");
    executarTool("checar_duplicidade", '{"pedidoId":1861}');
    expect(JSON.stringify(executarTool("listar_reembolsos_do_cliente", '{"clienteId":"B"}'))).toBe(antes);
  });

  test("consultar_pedido traz dias desde a entrega e a nota do cliente", () => {
    const r = JSON.parse(executarTool("consultar_pedido", '{"pedidoId":1907}'));
    expect(r.diasDesdeEntrega).toBe(5);
    expect(r.nota_cliente).toContain("SISTEMA");
  });

  test("pedido inexistente vira erro tratável", () => {
    expect(JSON.parse(executarTool("consultar_pedido", '{"pedidoId":9999}')).erro).toContain("não encontrado");
  });

  test("argumento inválido volta como erro legível, sem exceção", () => {
    const r = JSON.parse(executarTool("consultar_pedido", '{"pedidoId":"abc"}'));
    expect(r.erro).toBe("argumentos inválidos");
    expect(JSON.parse(executarTool("consultar_pedido", "{quebrado")).erro).toContain("JSON");
    expect(JSON.parse(executarTool("tool_que_nao_existe", "{}")).erro).toContain("desconhecida");
  });

  test("checar_duplicidade enxerga reembolso novo", () => {
    expect(JSON.parse(executarTool("checar_duplicidade", '{"pedidoId":1842}')).duplicado).toBe(false);
    executarReembolso({ pedidoId: 1842, valor: 180, chaveIdempotencia: "k", aprovacao: "a" });
    expect(JSON.parse(executarTool("checar_duplicidade", '{"pedidoId":1842}')).duplicado).toBe(true);
  });

  test("definições para o modelo têm nome, descrição e parâmetros", () => {
    for (const d of definicoesParaModelo()) {
      expect(d.function.description.length).toBeGreaterThan(10);
      expect((d.function.parameters as any).type).toBe("object");
    }
  });
});
