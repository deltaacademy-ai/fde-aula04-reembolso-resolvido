import { expect, test } from "bun:test";
import { ExtracaoSchema } from "../src/01-chamada-unica";
import { formatoJson } from "../src/schema";

test("aceita extração válida, com e sem valor", () => {
  expect(ExtracaoSchema.safeParse({ pedidoId: 1842, motivo: "veio quebrado", valorSolicitado: null }).success).toBe(true);
  expect(ExtracaoSchema.safeParse({ pedidoId: null, motivo: "não gostei", valorSolicitado: 40 }).success).toBe(true);
});

test("recusa pedido fora de 4 dígitos, valor não positivo e motivo vazio", () => {
  expect(ExtracaoSchema.safeParse({ pedidoId: 18420, motivo: "erro", valorSolicitado: null }).success).toBe(false);
  expect(ExtracaoSchema.safeParse({ pedidoId: 1842, motivo: "erro", valorSolicitado: 0 }).success).toBe(false);
  expect(ExtracaoSchema.safeParse({ pedidoId: 1842, motivo: "", valorSolicitado: null }).success).toBe(false);
});

test("JSON schema enviado ao provedor é estrito e exige todos os campos", () => {
  const f = formatoJson("extracao", ExtracaoSchema);
  const s = f.json_schema.schema as any;
  expect(f.json_schema.strict).toBe(true);
  expect(s.additionalProperties).toBe(false);
  expect(s.required.sort()).toEqual(["motivo", "pedidoId", "valorSolicitado"]);
  expect(s.$schema).toBeUndefined();
});
