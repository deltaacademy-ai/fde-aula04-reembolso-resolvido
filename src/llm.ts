import { calcularCusto, formatarCusto } from "./precos";

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

export type Mensagem =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolDef = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

export type ResponseFormat = {
  type: "json_schema";
  json_schema: { name: string; strict: boolean; schema: Record<string, unknown> };
};

export type Chamada = {
  rotulo: string;
  modelo: string;
  tokensEntrada: number;
  tokensSaida: number;
  custoUsd: number | null; // null = modelo sem preço cadastrado
  latenciaMs: number;
};

export type Resposta = {
  mensagem: Extract<Mensagem, { role: "assistant" }>;
  finishReason: string;
  chamada: Chamada;
};

export type OpcoesChat = {
  messages: Mensagem[];
  rotulo?: string;
  modelo?: string;
  tools?: ToolDef[];
  responseFormat?: ResponseFormat;
  temperature?: number;
};

const historico: Chamada[] = [];
let coletor: Chamada[] | null = null;
let silencioso = false;

export const modeloPadrao = () => process.env.LLM_MODEL ?? "openai/gpt-4.1-mini";

export function silenciar(valor: boolean) {
  silencioso = valor;
}

export function formatarChamada(c: Chamada): string {
  return (
    `[llm] ${c.rotulo.padEnd(15)} modelo=${c.modelo} entrada=${c.tokensEntrada} saida=${c.tokensSaida} ` +
    `custo=${formatarCusto(c.custoUsd)} latencia=${c.latenciaMs}ms`
  );
}

export function somar(chamadas: Chamada[]) {
  const semPreco = chamadas.some((c) => c.custoUsd === null);
  return {
    chamadas: chamadas.length,
    tokensEntrada: chamadas.reduce((s, c) => s + c.tokensEntrada, 0),
    tokensSaida: chamadas.reduce((s, c) => s + c.tokensSaida, 0),
    custoUsd: semPreco ? null : chamadas.reduce((s, c) => s + (c.custoUsd ?? 0), 0),
    latenciaMs: chamadas.reduce((s, c) => s + c.latenciaMs, 0),
  };
}

export function imprimirTotais(titulo = "total da execução", chamadas: Chamada[] = historico) {
  const t = somar(chamadas);
  console.log(
    `[total] ${titulo}: ${t.chamadas} chamada(s), entrada=${t.tokensEntrada} saida=${t.tokensSaida} ` +
      `custo=${formatarCusto(t.custoUsd)} latencia=${t.latenciaMs}ms`,
  );
}

/** Roda fn e devolve também as chamadas de modelo feitas dentro dela (usado pelo eval). */
export async function medir<T>(fn: () => Promise<T>): Promise<{ valor: T; chamadas: Chamada[] }> {
  const anterior = coletor;
  const meu: Chamada[] = [];
  coletor = meu;
  try {
    return { valor: await fn(), chamadas: meu };
  } finally {
    coletor = anterior;
  }
}

function extrairCusto(modelo: string, uso: any): number | null {
  // OpenRouter devolve o custo real em usage.cost; quando vem, ele vale mais que a tabela.
  if (typeof uso?.cost === "number") return uso.cost;
  return calcularCusto(modelo, uso?.prompt_tokens ?? 0, uso?.completion_tokens ?? 0);
}

export async function chat(opcoes: OpcoesChat): Promise<Resposta> {
  const baseUrl = (process.env.LLM_BASE_URL ?? "https://openrouter.ai/api/v1").replace(/\/$/, "");
  const chave = process.env.LLM_API_KEY;
  if (!chave) throw new Error("LLM_API_KEY não definida (veja .env.example)");
  const modelo = opcoes.modelo ?? modeloPadrao();

  const corpo: Record<string, unknown> = {
    model: modelo,
    messages: opcoes.messages,
    temperature: opcoes.temperature ?? 0,
  };
  if (opcoes.tools?.length) corpo.tools = opcoes.tools;
  if (opcoes.responseFormat) corpo.response_format = opcoes.responseFormat;

  const inicio = performance.now();
  let json: any;
  for (let tentativa = 0; ; tentativa++) {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${chave}` },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(90_000),
    });
    if (res.ok) {
      json = await res.json();
      break;
    }
    const texto = await res.text();
    const transitorio = res.status === 429 || res.status >= 500;
    if (!transitorio || tentativa >= 2) {
      throw new Error(`LLM HTTP ${res.status}: ${texto.slice(0, 300)}`);
    }
    await Bun.sleep(1000 * 2 ** tentativa);
  }
  const latenciaMs = Math.round(performance.now() - inicio);

  const escolha = json.choices?.[0];
  if (!escolha) throw new Error(`resposta sem choices: ${JSON.stringify(json).slice(0, 300)}`);

  const chamada: Chamada = {
    rotulo: opcoes.rotulo ?? "chat",
    modelo,
    tokensEntrada: json.usage?.prompt_tokens ?? 0,
    tokensSaida: json.usage?.completion_tokens ?? 0,
    custoUsd: extrairCusto(modelo, json.usage),
    latenciaMs,
  };
  historico.push(chamada);
  coletor?.push(chamada);
  if (!silencioso) console.log(formatarChamada(chamada));

  return {
    mensagem: {
      role: "assistant",
      content: escolha.message.content ?? null,
      ...(escolha.message.tool_calls?.length ? { tool_calls: escolha.message.tool_calls } : {}),
    },
    finishReason: escolha.finish_reason,
    chamada,
  };
}
