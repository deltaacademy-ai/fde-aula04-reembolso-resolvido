// Funções puras do eval: comparação de decisões e métricas. Testadas sem chamar modelo.
import type { Decisao } from "../src/regras";

export type Esperado = Decisao;

/** Decisão correta = mesmo tipo e, conforme o tipo, mesmo valor (propor), motivo (negar/encaminhar) e pedido. */
export function decisaoCorreta(obtida: Decisao | null, esperado: Esperado): boolean {
  if (!obtida || obtida.tipo !== esperado.tipo || obtida.pedidoId !== esperado.pedidoId) return false;
  if (obtida.tipo === "propor" && esperado.tipo === "propor") return Math.abs(obtida.valor - esperado.valor) < 0.005;
  if (obtida.tipo === "negar" && esperado.tipo === "negar") return obtida.motivo === esperado.motivo;
  return obtida.tipo === "encaminhar" && esperado.tipo === "encaminhar";
}

/** Percentil por posição (nearest-rank). Com 12 casos, p95 é o pior caso. */
export function percentil(valores: number[], p: number): number {
  if (!valores.length) return 0;
  const ordenado = [...valores].sort((a, b) => a - b);
  const posicao = Math.max(1, Math.ceil((p / 100) * ordenado.length));
  return ordenado[posicao - 1]!;
}

export type ResultadoCaso = {
  id: string;
  decisao: (Decisao & { justificativa?: string }) | null;
  correta: boolean;
  violacaoGuarda: boolean;
  aceito: boolean; // decisão correta E nenhuma violação da guarda
  chamadas: number;
  tokensEntrada: number;
  tokensSaida: number;
  custoUsd: number | null;
  latenciaMs: number;
  passos?: number;
  erro?: string;
};

export function resumir(casos: ResultadoCaso[]) {
  const aceitos = casos.filter((c) => c.aceito).length;
  const semPreco = casos.some((c) => c.custoUsd === null);
  const custoTotalUsd = semPreco ? null : casos.reduce((s, c) => s + (c.custoUsd ?? 0), 0);
  const lat = casos.map((c) => c.latenciaMs);
  return {
    casos: casos.length,
    acertos: casos.filter((c) => c.correta).length,
    acuracia: casos.length ? casos.filter((c) => c.correta).length / casos.length : 0,
    aceitos,
    violacoesGuarda: casos.filter((c) => c.violacaoGuarda).length,
    custoTotalUsd,
    custoPorAceitoUsd: custoTotalUsd === null || aceitos === 0 ? null : custoTotalUsd / aceitos,
    latenciaP50Ms: percentil(lat, 50),
    latenciaP95Ms: percentil(lat, 95),
    tokensEntrada: casos.reduce((s, c) => s + c.tokensEntrada, 0),
    tokensSaida: casos.reduce((s, c) => s + c.tokensSaida, 0),
    chamadas: casos.reduce((s, c) => s + c.chamadas, 0),
  };
}

export type Resumo = ReturnType<typeof resumir>;

const usd = (v: number | null, casas = 4) => (v === null ? "preço não cadastrado" : `US$ ${v.toFixed(casas)}`);

export function tabelaMarkdown(linhas: { modelo: string; modo: string; resumo: Resumo }[]): string {
  const cab = "| Modelo | Modo | Acerto | Aceitos | Violações | Custo total | Custo por aceito | p50 | p95 | Tokens (entrada/saída) |";
  const sep = "|---|---|---|---|---|---|---|---|---|---|";
  const corpo = linhas.map(({ modelo, modo, resumo: r }) =>
    `| ${modelo} | ${modo} | ${r.acertos}/${r.casos} (${Math.round(r.acuracia * 100)}%) | ${r.aceitos}/${r.casos} | ${r.violacoesGuarda} | ` +
    `${usd(r.custoTotalUsd)} | ${usd(r.custoPorAceitoUsd, 5)} | ${(r.latenciaP50Ms / 1000).toFixed(1)}s | ${(r.latenciaP95Ms / 1000).toFixed(1)}s | ` +
    `${r.tokensEntrada}/${r.tokensSaida} |`,
  );
  return [cab, sep, ...corpo].join("\n");
}
