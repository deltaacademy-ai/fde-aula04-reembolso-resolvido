import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resetarEstado } from "../src/api/estado";

/** Aponta o estado para um arquivo temporário e recria a partir do banco. */
export function estadoLimpo() {
  const dir = mkdtempSync(join(tmpdir(), "reembolso-"));
  process.env.ESTADO_PATH = join(dir, "estado.json");
  delete process.env.SIMULAR_TIMEOUT_APOS_ESCRITA;
  resetarEstado();
}
