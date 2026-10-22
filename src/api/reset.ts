import { caminhoEstado, resetarEstado } from "./estado";

const estado = resetarEstado();
console.log(`Estado recriado em ${caminhoEstado()} (${estado.reembolsos.length} reembolso(s) inicial(is)).`);
