import { describe, expect, test } from "bun:test";
import { decisaoCorreta, percentil, resumir, tabelaMarkdown, type ResultadoCaso } from "../evals/metricas";
import casos from "../evals/casos.json";

describe("decisaoCorreta", () => {
  test("propor exige pedido e valor", () => {
    const esp = { tipo: "propor", pedidoId: 1842, valor: 180 } as const;
    expect(decisaoCorreta({ ...esp }, esp)).toBe(true);
    expect(decisaoCorreta({ ...esp, valor: 90 }, esp)).toBe(false);
    expect(decisaoCorreta({ ...esp, pedidoId: 1 }, esp)).toBe(false);
    expect(decisaoCorreta(null, esp)).toBe(false);
  });
  test("negar exige o motivo", () => {
    const esp = { tipo: "negar", pedidoId: 1850, motivo: "fora_do_prazo" } as const;
    expect(decisaoCorreta({ ...esp }, esp)).toBe(true);
    expect(decisaoCorreta({ ...esp, motivo: "duplicidade" }, esp)).toBe(false);
    expect(decisaoCorreta({ tipo: "encaminhar", pedidoId: 1850, motivo: "acima_do_limite" }, esp)).toBe(false);
  });
  test("pedidoId null só casa com null", () => {
    const esp = { tipo: "negar", pedidoId: null, motivo: "pedido_nao_identificado" } as const;
    expect(decisaoCorreta({ ...esp }, esp)).toBe(true);
    expect(decisaoCorreta({ ...esp, pedidoId: 1842 }, esp)).toBe(false);
  });
});

describe("métricas", () => {
  test("percentil por posição", () => {
    const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentil(v, 50)).toBe(5);
    expect(percentil(v, 95)).toBe(10);
    expect(percentil([], 50)).toBe(0);
  });

  const base: ResultadoCaso = {
    id: "x", decisao: null, correta: true, violacaoGuarda: false, aceito: true,
    chamadas: 2, tokensEntrada: 100, tokensSaida: 10, custoUsd: 0.001, latenciaMs: 1000,
  };

  test("custo por aceito divide o custo total pelos aceitos, errados incluídos no custo", () => {
    const r = resumir([base, { ...base, correta: false, aceito: false, custoUsd: 0.003 }]);
    expect(r.aceitos).toBe(1);
    expect(r.custoTotalUsd).toBeCloseTo(0.004, 9);
    expect(r.custoPorAceitoUsd).toBeCloseTo(0.004, 9);
    expect(r.acuracia).toBe(0.5);
  });

  test("violação da guarda tira o aceito mesmo com decisão correta", () => {
    const r = resumir([{ ...base, violacaoGuarda: true, aceito: false }]);
    expect(r.acertos).toBe(1);
    expect(r.aceitos).toBe(0);
    expect(r.custoPorAceitoUsd).toBeNull();
  });

  test("modelo sem preço propaga 'preço não cadastrado'", () => {
    const r = resumir([{ ...base, custoUsd: null }]);
    expect(r.custoTotalUsd).toBeNull();
    expect(tabelaMarkdown([{ modelo: "m", modo: "workflow", resumo: r }])).toContain("preço não cadastrado");
  });
});

describe("evals/casos.json", () => {
  test("tem pelo menos os 12 casos da aula, com ids únicos e esperado de cada tipo", () => {
    expect(casos.length).toBeGreaterThanOrEqual(12);
    expect(new Set(casos.map((c) => c.id)).size).toBe(casos.length);
    const tipos = new Set(casos.map((c) => c.esperado.tipo));
    expect(tipos).toEqual(new Set(["propor", "negar", "encaminhar"]));
  });
});
