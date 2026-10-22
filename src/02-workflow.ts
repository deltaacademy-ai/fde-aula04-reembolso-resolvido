// Workflow determinístico: o código conduz cada passo; o modelo só extrai e redige.
import { consultarPedido, consultarPolitica, diasDesdeEntrega } from "./api";
import { extrairPedido } from "./01-chamada-unica";
import { chat, imprimirTotais } from "./llm";
import { avaliarPedido, checarDuplicidade, type Decisao, type DecisaoComJustificativa } from "./regras";

const log = (msg: string) => {
  if (process.env.WORKFLOW_SILENCIOSO !== "1") console.log(`  [passo] ${msg}`);
};

async function redigirJustificativa(decisao: Decisao, fatos: Record<string, unknown>): Promise<string> {
  const r = await chat({
    rotulo: "justificativa",
    messages: [
      {
        role: "system",
        content:
          "Você escreve justificativas curtas (até duas frases, português do Brasil) para o atendente conferir uma decisão de reembolso. " +
          "A decisão já foi tomada pelo sistema: não a questione e não invente fatos além dos fornecidos. Cite a regra da política que se aplica.",
      },
      { role: "user", content: JSON.stringify({ decisao, fatos }) },
    ],
  });
  return (r.mensagem.content ?? "").trim();
}

export async function processarSolicitacao(mensagem: string): Promise<DecisaoComJustificativa> {
  log("extrair dados da mensagem");
  const ext = await extrairPedido(mensagem);
  const pedidoId = ext.ok ? ext.dados.pedidoId : null;
  const valorSolicitado = ext.ok ? ext.dados.valorSolicitado : null;

  log(`consultar pedido ${pedidoId ?? "(nenhum)"}`);
  const pedido = pedidoId === null ? null : consultarPedido(pedidoId);
  const politica = consultarPolitica();
  const duplicidade = pedidoId === null ? { duplicado: false, reembolsos: [] } : checarDuplicidade(pedidoId);

  log("aplicar regras da política em código");
  const decisao = avaliarPedido({
    pedido,
    pedidoId,
    valorSolicitado,
    reembolsosDoPedido: duplicidade.reembolsos,
    politica,
  });

  log("redigir justificativa (modelo)");
  // Só fatos objetivos vão ao modelo. A nota_cliente do pedido fica de fora de propósito.
  const justificativa = await redigirJustificativa(decisao, {
    valorPedido: pedido?.valor ?? null,
    diasDesdeEntrega: pedido ? diasDesdeEntrega(pedido) : null,
    statusPedido: pedido?.status ?? null,
    reembolsosAnteriores: duplicidade.reembolsos.length,
    prazoDias: politica.prazoDias,
    limiteAprovacaoHumana: politica.limiteAprovacaoHumana,
    valorSolicitado,
  });
  return { ...decisao, justificativa };
}

if (import.meta.main) {
  const mensagens = [
    "Oi, o fone do pedido 1842 chegou quebrado. Quero meu dinheiro de volta.",
    "Pedido 1850: a capa não serviu no meu celular. Reembolso, por favor.",
    "Pedido 1861 veio com defeito, quero o reembolso.",
    "O monitor do pedido 1875 chegou com a tela riscada, quero o dinheiro de volta.",
  ];
  for (const m of mensagens) {
    console.log(`\n> ${m}`);
    const d = await processarSolicitacao(m);
    console.log(`< decisão: ${JSON.stringify({ ...d, justificativa: undefined })}`);
    console.log(`  justificativa: ${d.justificativa}`);
  }
  console.log();
  imprimirTotais();
}
