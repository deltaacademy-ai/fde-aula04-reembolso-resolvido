// Demo: o modelo propõe, o humano aprova um hash, o executor recusa qualquer outra coisa.
// Uso: bun run cp4 [--auto]   (sem --auto e com terminal, o script espera você rodar `bun run aprovar <hash>`)
import { createInterface } from "node:readline/promises";
import { consultarPolitica } from "./api";
import { resetarEstado } from "./api/estado";
import { AutoridadeError, aprovar, canonico, criarProposta, executarAprovado, hashProposta, registrarProposta } from "./autoridade";
import { imprimirTotais } from "./llm";
import { processarSolicitacao } from "./02-workflow";

process.env.WORKFLOW_SILENCIOSO = "1";
resetarEstado();

const mensagem = "Oi, o fone do pedido 1842 chegou quebrado. Quero meu dinheiro de volta.";
console.log(`> ${mensagem}`);
const decisao = await processarSolicitacao(mensagem);
console.log(`< decisão: ${JSON.stringify({ ...decisao, justificativa: undefined })}`);
if (decisao.tipo !== "propor") throw new Error("a demo espera uma proposta");

const proposta = criarProposta(decisao, consultarPolitica());
const hash = registrarProposta(proposta);
console.log(`\nProposta canônica: ${canonico(proposta)}\nHash SHA-256:      ${hash}`);

console.log("\n1) Executar sem aprovação:");
try {
  executarAprovado(proposta);
} catch (e) {
  if (!(e instanceof AutoridadeError)) throw e;
  console.log(`   RECUSADO -> ${e.message}`);
}

console.log("\n2) Aprovação humana:");
if (process.stdin.isTTY && !process.argv.includes("--auto")) {
  console.log(`   em outro terminal: bun run aprovar ${hash.slice(0, 12)}`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await rl.question("   depois de aprovar, tecle Enter aqui... ");
  rl.close();
} else {
  const { aprovacao } = aprovar(hash, { aprovador: "demo-automatica" });
  console.log(`   (aprovação simulada pelo script; equivale a "bun run aprovar ${hash.slice(0, 12)}")`);
  console.log(`   aprovada por ${aprovacao.aprovador}, vence em ${aprovacao.venceEm}`);
}

console.log("\n3) Alterar o valor depois de aprovar (180 -> 1800):");
const adulterada = { ...proposta, valor: 1800 };
console.log(`   hash da adulterada: ${hashProposta(adulterada).slice(0, 16)}... (aprovado era ${hash.slice(0, 16)}...)`);
try {
  executarAprovado(adulterada);
  console.log("   ERRO: executou");
} catch (e) {
  console.log(`   RECUSADO -> ${(e as Error).message}`);
}

console.log("\n4) Aprovação vencida (1 hora depois):");
try {
  executarAprovado(proposta, new Date(Date.now() + 3_600_000));
} catch (e) {
  console.log(`   RECUSADO -> ${(e as Error).message}`);
}

console.log("\n5) A proposta aprovada, sem alteração:");
const reembolso = executarAprovado(proposta);
console.log(`   EXECUTADO -> ${reembolso.id}, pedido ${reembolso.pedidoId}, R$ ${reembolso.valor.toFixed(2)}, aprovação ${reembolso.aprovacao}`);
console.log();
imprimirTotais();
