// US$ por milhão de tokens, preço público de tabela (conferido na página de preços da OpenAI em 2026-10-22; revise antes de usar em decisão real).
// Modelo que não está aqui mostra "preço não cadastrado". Não chute: cadastre só o que você confirmou.
// Se a resposta trouxer usage.cost (OpenRouter), o cliente usa esse valor e ignora esta tabela.
export type Preco = { entrada: number; saida: number };

export const PRECOS: Record<string, Preco> = {
  "gpt-4.1-nano": { entrada: 0.1, saida: 0.4 },
  "gpt-4.1-mini": { entrada: 0.4, saida: 1.6 },
  "gpt-4.1": { entrada: 2.0, saida: 8.0 },
  "gpt-4o-mini": { entrada: 0.15, saida: 0.6 },
  "gpt-4o": { entrada: 2.5, saida: 10.0 },
};

export const SEM_PRECO = "preço não cadastrado";

/** Aceita "openai/gpt-4.1-mini" (OpenRouter) e snapshots como "gpt-4.1-mini-2025-04-14". */
export function buscarPreco(modelo: string): Preco | null {
  const nome = modelo.replace(/^openai\//, "");
  if (PRECOS[nome]) return PRECOS[nome];
  const semData = nome.replace(/-\d{4}-\d{2}-\d{2}$/, "");
  return PRECOS[semData] ?? null;
}

export function calcularCusto(modelo: string, tokensEntrada: number, tokensSaida: number): number | null {
  const preco = buscarPreco(modelo);
  if (!preco) return null;
  return (tokensEntrada * preco.entrada + tokensSaida * preco.saida) / 1_000_000;
}

export function formatarCusto(custoUsd: number | null): string {
  return custoUsd === null ? SEM_PRECO : `US$ ${custoUsd.toFixed(6)}`;
}
