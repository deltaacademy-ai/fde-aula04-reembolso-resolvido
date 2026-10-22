// Uma chamada, uma tarefa: extrair dados estruturados de uma mensagem livre.
import { z } from "zod";
import { chat, imprimirTotais, type Mensagem } from "./llm";
import { formatoJson } from "./schema";

export const ExtracaoSchema = z.object({
  pedidoId: z
    .number()
    .int()
    .refine((n) => n >= 1000 && n <= 9999, "pedidoId deve ter 4 dígitos")
    .nullable()
    .describe("número do pedido citado pelo cliente, ou null se ele não citou"),
  motivo: z.string().min(3).describe("motivo do pedido de reembolso, em poucas palavras"),
  valorSolicitado: z
    .number()
    .positive()
    .nullable()
    .describe("valor em reais que o cliente pediu de volta, ou null se não disse"),
});
export type Extracao = z.infer<typeof ExtracaoSchema>;

const SISTEMA =
  "Você extrai dados de mensagens de clientes que pedem reembolso. " +
  "Responda só com o JSON pedido. Não invente número de pedido nem valor: se a mensagem não traz, use null.";

export type ResultadoExtracao =
  | { ok: true; dados: Extracao; tentativas: number }
  | { ok: false; erros: string[]; tentativas: number };

/**
 * Se a validação falha, devolve o erro ao modelo e tenta de novo (uma vez por padrão).
 * Esgotou? Não adivinhe: devolva falha e deixe o chamador escalar para um humano.
 */
export async function extrairPedido(mensagem: string, maxTentativas = 2): Promise<ResultadoExtracao> {
  const conversa: Mensagem[] = [
    { role: "system", content: SISTEMA },
    { role: "user", content: mensagem },
  ];
  let erros: string[] = [];

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    const r = await chat({
      rotulo: tentativa === 1 ? "extracao" : "extracao-reparo",
      messages: conversa,
      responseFormat: formatoJson("extracao", ExtracaoSchema),
    });
    const bruto = r.mensagem.content ?? "";

    let json: unknown;
    try {
      json = JSON.parse(bruto);
    } catch {
      erros = ["a resposta não é JSON válido"];
    }
    if (json !== undefined) {
      const v = ExtracaoSchema.safeParse(json);
      if (v.success) return { ok: true, dados: v.data, tentativas: tentativa };
      erros = v.error.issues.map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`);
    }

    conversa.push(
      r.mensagem,
      { role: "user", content: `Sua resposta foi recusada pela validação: ${erros.join("; ")}. Corrija e responda só o JSON.` },
    );
  }
  return { ok: false, erros, tentativas: maxTentativas };
}

if (import.meta.main) {
  const mensagens = [
    "Oi, o fone do pedido 1842 chegou quebrado. Quero meu dinheiro de volta.",
    "Pedido 1893: o cabo não carrega nada. Pode devolver só R$ 40,00?",
    "Comprei uma mochila e não gostei. Quero reembolso!",
    "Meu pedido 18420 veio errado, reembolsa por favor.",
  ];
  for (const m of mensagens) {
    console.log(`\n> ${m}`);
    const r = await extrairPedido(m);
    if (r.ok) {
      console.log(`< ok em ${r.tentativas} tentativa(s):`, JSON.stringify(r.dados));
      if (r.tentativas > 1) console.log("  atenção: o reparo pode mudar o dado, não só a forma. Em produção, confirme com o cliente.");
    }
    else console.log(`< FALHOU após ${r.tentativas} tentativa(s): ${r.erros.join("; ")} -> escalar para humano, sem chutar`);
  }
  console.log();
  imprimirTotais();
}
