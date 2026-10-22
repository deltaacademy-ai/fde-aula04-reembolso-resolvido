// Tools que o modelo pode chamar. Todas de LEITURA: nenhuma escreve no estado.
// A execução de reembolso não está aqui de propósito (veja .agents/rules/01-execucao-de-reembolso.md).
import { z } from "zod";
import { consultarPedido, consultarPolitica, diasDesdeEntrega, hoje, listarReembolsosDoCliente } from "./api";
import type { ToolDef } from "./llm";
import { checarDuplicidade } from "./regras";

export type Tool = {
  nome: string;
  descricao: string;
  schema: z.ZodType;
  executar: (args: any) => unknown;
};

const pedidoIdSchema = z.object({ pedidoId: z.number().int().describe("número do pedido, 4 dígitos") });

export const TOOLS: Tool[] = [
  {
    nome: "consultar_pedido",
    descricao:
      "Busca um pedido pelo número. Devolve cliente, valor, status, data de entrega, dias desde a entrega e a nota escrita pelo cliente. Use primeiro, sempre.",
    schema: pedidoIdSchema,
    executar: ({ pedidoId }) => {
      const pedido = consultarPedido(pedidoId);
      if (!pedido) return { erro: `pedido ${pedidoId} não encontrado` };
      return { ...pedido, hoje: hoje(), diasDesdeEntrega: diasDesdeEntrega(pedido) };
    },
  },
  {
    nome: "consultar_politica",
    descricao: "Devolve o texto da política de reembolso vigente e seus parâmetros (prazo em dias, limite de aprovação humana).",
    schema: z.object({ versao: z.string().optional().describe("versão da política; omita para a vigente (v1)") }),
    executar: ({ versao }) => consultarPolitica(versao),
  },
  {
    nome: "listar_reembolsos_do_cliente",
    descricao: "Lista os reembolsos já feitos para um cliente (ids A, B ou C).",
    schema: z.object({ clienteId: z.string().describe("id do cliente, por exemplo A") }),
    executar: ({ clienteId }) => listarReembolsosDoCliente(clienteId),
  },
  {
    nome: "checar_duplicidade",
    descricao: "Diz se já existe reembolso para o pedido (a política permite um por pedido).",
    schema: pedidoIdSchema,
    executar: ({ pedidoId }) => checarDuplicidade(pedidoId),
  },
];

export function definicoesParaModelo(tools: Tool[] = TOOLS): ToolDef[] {
  return tools.map((t) => {
    const { $schema, ...parameters } = z.toJSONSchema(t.schema) as Record<string, unknown>;
    return { type: "function", function: { name: t.nome, description: t.descricao, parameters } };
  });
}

/** Nunca lança: erro de argumento volta como JSON para o modelo poder corrigir. */
export function executarTool(nome: string, argumentosJson: string, tools: Tool[] = TOOLS): string {
  const tool = tools.find((t) => t.nome === nome);
  if (!tool) return JSON.stringify({ erro: `tool desconhecida: ${nome}` });
  let bruto: unknown;
  try {
    bruto = argumentosJson ? JSON.parse(argumentosJson) : {};
  } catch {
    return JSON.stringify({ erro: "argumentos não são JSON válido" });
  }
  const v = tool.schema.safeParse(bruto);
  if (!v.success) {
    return JSON.stringify({ erro: "argumentos inválidos", detalhes: v.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
  }
  try {
    return JSON.stringify(tool.executar(v.data));
  } catch (e) {
    return JSON.stringify({ erro: e instanceof Error ? e.message : String(e) });
  }
}
