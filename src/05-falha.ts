// Demo da falha que dá dinheiro errado: timeout DEPOIS da escrita.
// Roda com SIMULAR_TIMEOUT_APOS_ESCRITA=1 (o script liga sozinho se você esquecer).
import { randomUUID } from "node:crypto";
import { consultarPolitica, executarReembolso, listarReembolsosDoPedido, type Proposta } from "./api";
import { resetarEstado } from "./api/estado";
import { aprovar, criarProposta, registrarProposta } from "./autoridade";
import { executarProposta } from "./executar";
import { imprimirTotais } from "./llm";
import { reconciliar, resolverExecucao } from "./reconciliar";
import { processarSolicitacao } from "./02-workflow";

process.env.WORKFLOW_SILENCIOSO = "1";
if (process.env.SIMULAR_TIMEOUT_APOS_ESCRITA !== "1") {
  process.env.SIMULAR_TIMEOUT_APOS_ESCRITA = "1";
  console.log("(SIMULAR_TIMEOUT_APOS_ESCRITA=1 ligado pelo script)\n");
}
const rede = {
  falha: () => (process.env.SIMULAR_TIMEOUT_APOS_ESCRITA = "1"),
  volta: () => delete process.env.SIMULAR_TIMEOUT_APOS_ESCRITA,
};

const mensagem = "Oi, o fone do pedido 1842 chegou quebrado. Quero meu dinheiro de volta.";
console.log(`> ${mensagem}`);
// parte de estado limpo: o cp4 deixa um reembolso do 1842 gravado e o workflow negaria por duplicidade
resetarEstado();
const decisao = await processarSolicitacao(mensagem);
if (decisao.tipo !== "propor") throw new Error("a demo espera uma proposta");
const proposta = criarProposta(decisao, consultarPolitica());
console.log(`< proposta: pedido ${proposta.pedidoId}, R$ ${proposta.valor.toFixed(2)}`);

function prepararEstado(p: Proposta) {
  resetarEstado();
  aprovar(registrarProposta(p), { aprovador: "demo-automatica" });
}
const total = () => listarReembolsosDoPedido(proposta.pedidoId);
const mostrar = () => {
  const rs = total();
  console.log(`   reembolsos do pedido ${proposta.pedidoId}: ${rs.length} -> ${rs.map((r) => `${r.id} (R$ ${r.valor.toFixed(2)})`).join(", ") || "nenhum"}`);
};

console.log("\n=== A) Retry ingênuo: timeout, chave nova ===");
prepararEstado(proposta);
rede.falha();
const a1 = executarProposta(proposta);
console.log(`   1a tentativa: ${a1.estado}${a1.estado === "DESCONHECIDO" ? ` (${a1.erro})` : ""}`);
rede.volta();
console.log("   'deu timeout, vou tentar de novo' -> chave nova (randomUUID)");
const naive = executarReembolso({
  pedidoId: proposta.pedidoId,
  valor: proposta.valor,
  chaveIdempotencia: randomUUID(),
  aprovacao: "ap-reaproveitada",
});
console.log(`   2a tentativa: confirmou ${naive.id}`);
mostrar();
console.log(`   RESULTADO: ${total().length > 1 ? "DUPLICADO, o cliente recebeu duas vezes" : "ok"}`);

console.log("\n=== B) Estado DESCONHECIDO + reconciliar pela chave ===");
prepararEstado(proposta);
rede.falha();
const b1 = executarProposta(proposta);
console.log(`   1a tentativa: ${b1.estado} (chave ${b1.chave.slice(0, 12)}...)`);
rede.volta();
const rec = reconciliar(b1.chave);
console.log(`   reconciliar(chave): ${rec.estado}${rec.estado === "CONFIRMADO" ? ` -> ${rec.reembolso.id}` : ""}`);
const b2 = resolverExecucao(proposta, b1);
console.log(`   resolverExecucao: ${b2.estado}; sem nova escrita`);
const mesmaChave = executarProposta(proposta);
console.log(`   mesmo um retry com a MESMA chave devolve ${mesmaChave.estado === "CONFIRMADO" ? mesmaChave.reembolso.id : mesmaChave.estado}`);
mostrar();
console.log(`   RESULTADO: ${total().length === 1 ? "um único reembolso" : "DUPLICADO"}`);

console.log("\n=== C) Reconciliar quando nada foi escrito ===");
prepararEstado(proposta);
const c0 = reconciliar("chave-que-nunca-foi-usada");
console.log(`   reconciliar: ${c0.estado} -> retry com a mesma chave é seguro`);

console.log();
imprimirTotais();
