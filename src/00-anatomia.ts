// Anatomia de uma chamada: o modelo não tem memória. Quem guarda a conversa é o seu código.
import { chat, imprimirTotais, type Mensagem } from "./llm";

const sistema: Mensagem = {
  role: "system",
  content: "Você é um atendente de e-commerce. Responda em no máximo duas frases.",
};

console.log("== 1. Chamada crua, sem estado ==");
const p1 = "Meu pedido 1842 chegou com o fone quebrado. O que eu faço?";
const p2 = "E o valor?";

const r1 = await chat({ rotulo: "cru-pergunta-1", messages: [sistema, { role: "user", content: p1 }] });
console.log(`> ${p1}\n< ${r1.mensagem.content}\n`);

// Segunda pergunta numa chamada nova: nada do turno anterior vai junto.
const r2 = await chat({ rotulo: "cru-pergunta-2", messages: [sistema, { role: "user", content: p2 }] });
console.log(`> ${p2}\n< ${r2.mensagem.content}\n`);
console.log("Repare: o modelo não sabe de que valor se fala. Cada chamada começa do zero.\n");

console.log("== 2. Com array de mensagens ==");
const conversa: Mensagem[] = [sistema];
const turnos = [p1, p2, "E quanto tempo leva para cair na conta?"];
for (const [i, fala] of turnos.entries()) {
  conversa.push({ role: "user", content: fala });
  const r = await chat({ rotulo: `turno-${i + 1}`, messages: conversa });
  conversa.push(r.mensagem);
  console.log(`> ${fala}\n< ${r.mensagem.content}`);
  console.log(`  tokens de entrada neste turno: ${r.chamada.tokensEntrada} (a conversa inteira é reenviada)\n`);
}
imprimirTotais();
