// Aprovação humana por CLI: bun run aprovar <hash> [--aprovador nome] [--validade-min N] [--sim]
import { createInterface } from "node:readline/promises";
import { VALIDADE_PADRAO_MIN, aprovar, canonico, resolverHash } from "./autoridade";
import { carregarEstado } from "./api/estado";

const args = process.argv.slice(2);
const valorDe = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const hashArg = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--aprovador" && args[i - 1] !== "--validade-min");

if (!hashArg) {
  console.error("uso: bun run aprovar <hash> [--aprovador nome] [--validade-min N] [--sim]");
  process.exit(2);
}

let hash: string;
try {
  hash = resolverHash(hashArg);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}

const proposta = carregarEstado().propostas[hash]!;
console.log(`Proposta ${hash}\n  ${canonico(proposta)}`);
console.log(`  pedido ${proposta.pedidoId}, cliente ${proposta.clienteId}, valor R$ ${proposta.valor.toFixed(2)}`);

if (!args.includes("--sim")) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const r = (await rl.question("Aprovar esta proposta? (s/N) ")).trim().toLowerCase();
  rl.close();
  if (r !== "s") {
    console.log("Não aprovada.");
    process.exit(1);
  }
}

const aprovador = valorDe("--aprovador") ?? process.env.USER ?? "humano";
const validadeMin = Number(valorDe("--validade-min") ?? VALIDADE_PADRAO_MIN);
const { aprovacao } = aprovar(hash, { aprovador, validadeMin });
console.log(`Aprovada por ${aprovacao.aprovador}, válida até ${aprovacao.venceEm}.`);
