// Cliente MCP mínimo: sobe o servidor numa porta livre, lista as tools e chama cada uma. Não usa modelo.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { resetarEstado } from "./api/estado";
import { iniciar } from "./mcp-server";

resetarEstado();
const servidor = iniciar(0);
const cliente = new Client({ name: "teste-aula", version: "1.0.0" });
await cliente.connect(new StreamableHTTPClientTransport(new URL(`http://localhost:${servidor.port}/mcp`)));

const tools = await cliente.listTools();
console.log(`tools expostas: ${tools.tools.map((t) => t.name).join(", ")}`);

async function chamar(name: string, args: Record<string, unknown>) {
  const r: any = await cliente.callTool({ name, arguments: args });
  console.log(`\n> ${name}(${JSON.stringify(args)})${r.isError ? "  [isError]" : ""}`);
  console.log(r.content[0].text.split("\n").slice(0, 14).join("\n"));
}

await chamar("consultar_pedido", { pedidoId: 1842 });
await chamar("propor_reembolso", { pedidoId: 1842 });
await chamar("propor_reembolso", { pedidoId: 1850 });
await chamar("propor_reembolso", { pedidoId: 1875 });
await chamar("consultar_pedido", { pedidoId: 9999 });

await cliente.close();
servidor.stop(true);
resetarEstado();
