// Eval: roda o workflow (cp2) e o agente (cp3) nos mesmos casos, em uma lista de modelos.
// EVAL_MODELS=gpt-4.1-nano,gpt-4.1-mini   (padrão: LLM_MODEL)
// EVAL_MODOS=workflow,agente              (padrão: os dois)
// EVAL_CASOS=c01,c08                      (padrão: todos)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { consultarPedido, consultarPolitica } from "../src/api";
import { resetarEstado } from "../src/api/estado";
import { rodarAgenteLeitura } from "../src/03-agente-leitura";
import { processarSolicitacao } from "../src/02-workflow";
import { formatarCusto } from "../src/precos";
import { medir, modeloPadrao, silenciar, somar } from "../src/llm";
import { guarda, type Decisao, type DecisaoComJustificativa } from "../src/regras";
import { decisaoCorreta, resumir, tabelaMarkdown, type Esperado, type ResultadoCaso } from "./metricas";

type Caso = { id: string; descricao: string; mensagem: string; esperado: Esperado };
type Modo = "workflow" | "agente";

const RAIZ = resolve(import.meta.dir, "..");
const casosTodos: Caso[] = JSON.parse(readFileSync(resolve(RAIZ, "evals/casos.json"), "utf8"));
const filtroCasos = process.env.EVAL_CASOS?.split(",").map((s) => s.trim());
const casos = filtroCasos ? casosTodos.filter((c) => filtroCasos.includes(c.id)) : casosTodos;
const modelos = (process.env.EVAL_MODELS ?? modeloPadrao()).split(",").map((s) => s.trim()).filter(Boolean);
const modos = (process.env.EVAL_MODOS ?? "workflow,agente").split(",").map((s) => s.trim()) as Modo[];

silenciar(true);
process.env.WORKFLOW_SILENCIOSO = "1";

async function executar(modo: Modo, mensagem: string): Promise<{ decisao: DecisaoComJustificativa | null; passos?: number }> {
  if (modo === "workflow") return { decisao: await processarSolicitacao(mensagem) };
  const r = await rodarAgenteLeitura(mensagem, { silencioso: true });
  return { decisao: r.decisao, passos: r.passos };
}

async function rodarCaso(modo: Modo, caso: Caso): Promise<ResultadoCaso> {
  resetarEstado();
  const inicio = performance.now();
  let decisao: DecisaoComJustificativa | null = null;
  let passos: number | undefined;
  let erro: string | undefined;
  const { chamadas } = await medir(async () => {
    try {
      ({ decisao, passos } = await executar(modo, caso.mensagem));
    } catch (e) {
      erro = e instanceof Error ? e.message : String(e);
    }
  });
  const latenciaMs = Math.round(performance.now() - inicio);

  // A guarda confere toda proposta, independente de quem a produziu.
  let violacaoGuarda = false;
  if (decisao && (decisao as Decisao).tipo === "propor") {
    const d = decisao as Extract<Decisao, { tipo: "propor" }>;
    violacaoGuarda = !guarda({ pedido: consultarPedido(d.pedidoId), valor: d.valor, politica: consultarPolitica() }).ok;
  }
  const correta = decisaoCorreta(decisao, caso.esperado);
  const uso = somar(chamadas);
  return {
    id: caso.id,
    decisao,
    correta,
    violacaoGuarda,
    aceito: correta && !violacaoGuarda,
    chamadas: uso.chamadas,
    tokensEntrada: uso.tokensEntrada,
    tokensSaida: uso.tokensSaida,
    custoUsd: uso.custoUsd,
    latenciaMs,
    ...(passos !== undefined ? { passos } : {}),
    ...(erro ? { erro } : {}),
  };
}

const resultados: { modelo: string; modo: Modo; resumo: ReturnType<typeof resumir>; casos: ResultadoCaso[] }[] = [];

for (const modelo of modelos) {
  process.env.LLM_MODEL = modelo;
  for (const modo of modos) {
    console.log(`\n== ${modelo} / ${modo} ==`);
    const lista: ResultadoCaso[] = [];
    for (const caso of casos) {
      const r = await rodarCaso(modo, caso);
      lista.push(r);
      const marca = r.aceito ? "ok " : r.correta ? "VIOLACAO" : "ERRO";
      console.log(
        `  ${caso.id} ${marca.padEnd(8)} ${r.tokensEntrada}/${r.tokensSaida} tokens  ${formatarCusto(r.custoUsd)}  ${(r.latenciaMs / 1000).toFixed(1)}s` +
          (r.correta ? "" : `  obtido=${r.erro ? `erro: ${r.erro.slice(0, 60)}` : JSON.stringify(r.decisao && { ...r.decisao, justificativa: undefined })}`),
      );
    }
    resultados.push({ modelo, modo, resumo: resumir(lista), casos: lista });
  }
}

const tabela = tabelaMarkdown(resultados.map(({ modelo, modo, resumo }) => ({ modelo, modo, resumo })));
console.log(`\n${tabela}\n`);

if (!filtroCasos) {
  const data = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD no fuso local
  const pasta = resolve(RAIZ, "evals/resultados");
  mkdirSync(pasta, { recursive: true });
  const arquivo = resolve(pasta, `${data}.json`);
  writeFileSync(
    arquivo,
    JSON.stringify(
      {
        data,
        baseUrl: process.env.LLM_BASE_URL ?? "https://openrouter.ai/api/v1",
        temperatura: 0,
        casos: casos.length,
        definicoes: {
          aceito: "decisão e valor corretos e nenhuma violação da guarda",
          latencia: "tempo de parede por caso (todas as chamadas do caso); p95 por posição (nearest-rank)",
          custoPorAceito: "custo total do modo/modelo dividido pelos casos aceitos",
        },
        tabelaMarkdown: tabela,
        resultados,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Resultado gravado em evals/resultados/${data}.json`);
} else {
  console.log("(EVAL_CASOS definido: resultado parcial, não gravado)");
}
