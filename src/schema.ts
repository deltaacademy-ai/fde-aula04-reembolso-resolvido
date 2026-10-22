import { z } from "zod";
import type { ResponseFormat } from "./llm";

/**
 * Converte um schema zod no response_format do provedor.
 * O JSON schema garante a FORMA da resposta; o zod, depois, garante o SENTIDO
 * (refinements não viram JSON schema, e é bom assim: o provedor aceita só um subconjunto).
 */
export function formatoJson(nome: string, schema: z.ZodType): ResponseFormat {
  const { $schema, ...json } = z.toJSONSchema(schema) as Record<string, unknown>;
  return { type: "json_schema", json_schema: { name: nome, strict: true, schema: json } };
}
