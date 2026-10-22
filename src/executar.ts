// Executar com honestidade sobre o que não se sabe: timeout depois de escrever NÃO é falha, é "desconhecido".
import { TimeoutError, type Proposta, type Reembolso } from "./api";
import { AutoridadeError, chaveIdempotencia, executarAprovado, type MotivoRecusa } from "./autoridade";

export type ResultadoExecucao =
  | { estado: "CONFIRMADO"; chave: string; reembolso: Reembolso }
  | { estado: "DESCONHECIDO"; chave: string; erro: string }
  | { estado: "RECUSADO"; chave: string; motivo: MotivoRecusa }
  | { estado: "FALHOU"; chave: string; erro: string };

export function executarProposta(proposta: Proposta, agora = new Date()): ResultadoExecucao {
  const chave = chaveIdempotencia(proposta);
  try {
    return { estado: "CONFIRMADO", chave, reembolso: executarAprovado(proposta, agora) };
  } catch (e) {
    if (e instanceof AutoridadeError) return { estado: "RECUSADO", chave, motivo: e.motivo };
    // Timeout: a escrita pode ou não ter acontecido. Não repita com chave nova; reconcilie pela chave.
    if (e instanceof TimeoutError) return { estado: "DESCONHECIDO", chave, erro: e.message };
    return { estado: "FALHOU", chave, erro: e instanceof Error ? e.message : String(e) };
  }
}
