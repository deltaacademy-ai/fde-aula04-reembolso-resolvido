// Passo agêntico delimitado: o modelo escolhe quais tools de leitura chamar, dentro de limites.
// Delimitado = limite de passos, critério de parada explícito, saída final validada e nenhuma tool de escrita.
import { z } from "zod";
import { chat, imprimirTotais, type Mensagem } from "./llm";
import type { DecisaoComJustificativa } from "./regras";
import { formatoJson } from "./schema";
import { definicoesParaModelo, executarTool } from "./tools";

export const DecisaoAgenteSchema = z.object({
  tipo: z.enum(["propor", "negar", "encaminhar"]),
  pedidoId: z.number().int().nullable().describe("pedido analisado; null se a mensagem não citou nenhum"),
  valor: z.number().nullable().describe("só para tipo=propor: valor em reais a reembolsar; senão null"),
  motivo: z
    .enum(["fora_do_prazo", "duplicidade", "cancelado", "pedido_nao_encontrado", "pedido_nao_identificado", "acima_do_limite"])
    .nullable()
    .describe("para negar ou encaminhar; null quando tipo=propor"),
  justificativa: z.string().describe("até duas frases citando a regra da política aplicada"),
});

export const SISTEMA_AGENTE =
  "Você é um assistente de triagem de reembolsos. Você só PROPÕE: nunca executa nada, e um humano sempre aprova.\n" +
  "Passos: identifique o número do pedido na mensagem do cliente, consulte o pedido, consulte a política, verifique duplicidade, e então decida.\n" +
  "Decisões possíveis: propor (com valor), negar (com motivo) ou encaminhar ao financeiro (acima do limite).\n" +
  "Quando tiver tudo, responda apenas com o JSON da decisão final, sem chamar mais tools.";

export type ResultadoAgente = {
  decisao: DecisaoComJustificativa | null;
  passos: number;
  parou: "concluiu" | "limite_de_passos";
};

/** Converte a saída validada do modelo no tipo de decisão do código. Devolve null se for incoerente. */
export function paraDecisao(d: z.infer<typeof DecisaoAgenteSchema>): DecisaoComJustificativa | null {
  const { tipo, pedidoId, valor, motivo, justificativa } = d;
  if (tipo === "propor") {
    if (pedidoId === null || valor === null) return null;
    return { tipo, pedidoId, valor, justificativa };
  }
  if (tipo === "encaminhar") {
    if (pedidoId === null) return null;
    return { tipo, pedidoId, motivo: "acima_do_limite", justificativa };
  }
  if (motivo === null || motivo === "acima_do_limite") return null;
  return { tipo, pedidoId, motivo, justificativa };
}

const resumo = (s: string, n = 110) => (s.length > n ? s.slice(0, n) + "..." : s);

export async function rodarAgenteLeitura(
  mensagem: string,
  opcoes: { maxPassos?: number; modelo?: string; silencioso?: boolean } = {},
): Promise<ResultadoAgente> {
  const maxPassos = opcoes.maxPassos ?? 6;
  const log = (s: string) => {
    if (!opcoes.silencioso) console.log(s);
  };
  const conversa: Mensagem[] = [
    { role: "system", content: SISTEMA_AGENTE },
    { role: "user", content: mensagem },
  ];
  const tools = definicoesParaModelo();
  const formato = formatoJson("decisao", DecisaoAgenteSchema);

  for (let passo = 1; passo <= maxPassos; passo++) {
    const r = await chat({ rotulo: `agente-${passo}`, modelo: opcoes.modelo, messages: conversa, tools, responseFormat: formato });
    conversa.push(r.mensagem);

    if (r.mensagem.tool_calls?.length) {
      for (const call of r.mensagem.tool_calls) {
        const saida = executarTool(call.function.name, call.function.arguments);
        log(`  [passo ${passo}] ${call.function.name}(${call.function.arguments}) -> ${resumo(saida)}`);
        conversa.push({ role: "tool", tool_call_id: call.id, content: saida });
      }
      continue;
    }

    // Sem tool_calls = o modelo diz que terminou. Esse é o critério de parada; ainda assim validamos.
    let json: unknown;
    try {
      json = JSON.parse(r.mensagem.content ?? "");
    } catch {
      json = undefined;
    }
    const v = DecisaoAgenteSchema.safeParse(json);
    const decisao = v.success ? paraDecisao(v.data) : null;
    if (decisao) {
      log(`  [passo ${passo}] decisão final: ${JSON.stringify({ ...decisao, justificativa: undefined })}`);
      return { decisao, passos: passo, parou: "concluiu" };
    }
    log(`  [passo ${passo}] saída final inválida, pedindo correção`);
    conversa.push({ role: "user", content: "Sua decisão final está inválida ou incoerente (veja os campos tipo, valor e motivo). Responda de novo só com o JSON correto." });
  }
  log(`  [parada] limite de ${maxPassos} passos atingido sem decisão válida -> escalar para humano`);
  return { decisao: null, passos: maxPassos, parou: "limite_de_passos" };
}

if (import.meta.main) {
  const mensagens = [
    "Oi, o fone do pedido 1842 chegou quebrado. Quero meu dinheiro de volta.",
    "Pedido 1861 veio com defeito, quero o reembolso.",
    "O monitor do pedido 1875 chegou com a tela riscada, quero o dinheiro de volta.",
  ];
  for (const m of mensagens) {
    console.log(`\n> ${m}`);
    const r = await rodarAgenteLeitura(m);
    console.log(`< ${r.parou} em ${r.passos} passo(s): ${r.decisao ? JSON.stringify(r.decisao) : "sem decisão"}`);
  }
  console.log();
  imprimirTotais();
}
