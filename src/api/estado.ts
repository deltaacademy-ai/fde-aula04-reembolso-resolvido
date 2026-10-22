import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Banco, Estado } from "./tipos";

const RAIZ = resolve(import.meta.dir, "../..");

// Caminhos lidos a cada chamada para os testes poderem apontar para arquivos temporários.
export const caminhoBanco = () => process.env.BANCO_PATH ?? resolve(RAIZ, "dados/banco.json");
export const caminhoEstado = () => process.env.ESTADO_PATH ?? resolve(RAIZ, "dados/estado.json");
export const caminhoPoliticas = () => resolve(RAIZ, "politica");

export function carregarBanco(): Banco {
  return JSON.parse(readFileSync(caminhoBanco(), "utf8")) as Banco;
}

export function resetarEstado(): Estado {
  const estado: Estado = { reembolsos: carregarBanco().reembolsos, propostas: {}, aprovacoes: [] };
  salvarEstado(estado);
  return estado;
}

export function carregarEstado(): Estado {
  if (!existsSync(caminhoEstado())) return resetarEstado();
  const lido = JSON.parse(readFileSync(caminhoEstado(), "utf8")) as Partial<Estado>;
  return { reembolsos: [], propostas: {}, aprovacoes: [], ...lido };
}

export function salvarEstado(estado: Estado): void {
  writeFileSync(caminhoEstado(), JSON.stringify(estado, null, 2) + "\n");
}
