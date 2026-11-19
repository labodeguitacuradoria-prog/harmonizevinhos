import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildRows, filterRows, groupRows, presetRange, totalsOf, type AnalysisFilters, type AnalysisWine } from "./custom-analysis";

const wines: AnalysisWine[] = [
  { id: "a", name: "Quatro Castas", wine_type: "Tinto", volume: "750ml", country: "Brasil", producer: "Almaunica", cost_price: 80, sale_price: 300, active_on_menu: true, internal_code: "1002075", supplier_id: "s1" },
  { id: "b", name: "Bocca di Lupo", wine_type: "Tinto", volume: "750ml", country: "Itália", producer: "Tormaresca", cost_price: 170, sale_price: 520, active_on_menu: false, internal_code: "1002133", suppliers: ["Mistral"] },
  { id: "c", name: "Malbec", wine_type: "tinto", volume: "750ml", country: "Argentina", producer: "Catena", cost_price: 60, sale_price: 200, active_on_menu: true },
];
const names = new Map([["s1", "Don Laurindo"]]);
const movements = [
  { wine_id: "a", quantity: 24, unit_price: 300, unit_cost: 0, occurred_at: "2026-08-15T12:00:00Z" },
  { wine_id: "c", quantity: 3, unit_price: 200, unit_cost: 60, occurred_at: "2026-09-15T12:00:00Z" },
  { wine_id: "a", quantity: 99, unit_price: 300, unit_cost: 80, occurred_at: "2025-01-15T12:00:00Z" },
];
const stock = { a: 14, b: 11, c: 5 };
const range = { start: "2026-08-01", end: "2026-10-31" }; // 92 dias ≈ 3 meses
const base: AnalysisFilters = { ...range, origin: "all", country: "", menu: "all", types: [], suppliers: [], turnover: "all", format: "all", onlyWithStock: false, search: "" };
const rows = buildRows(wines, movements, stock, names, range.start, range.end);

describe("explorador de análises", () => {
  it("separa nacionais (Brasil) de importados", () => {
    assert.deepEqual(filterRows(rows, wines, { ...base, origin: "br" }, names).map((r) => r.id), ["a"]);
    assert.deepEqual(filterRows(rows, wines, { ...base, origin: "import" }, names).map((r) => r.id), ["b", "c"]);
  });

  it("capital parado = estoque × custo do cadastro", () => {
    assert.equal(rows.find((r) => r.id === "b")!.capital, 11 * 170);
  });

  it("giro baixo abaixo de 2 garrafas/mês, zero sem venda", () => {
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.turnover]));
    assert.deepEqual(byId, { a: "high", b: "zero", c: "low" });
  });

  it("queima de estoque: fora da carta com garrafas em adega", () => {
    const out = filterRows(rows, wines, { ...base, menu: "off", onlyWithStock: true }, names);
    assert.deepEqual(out.map((r) => r.id), ["b"]);
  });

  it("conta só as vendas do período e usa o custo do cadastro quando a venda vem sem custo", () => {
    const a = rows.find((r) => r.id === "a")!;
    assert.equal(a.sold, 24);
    assert.equal(a.revenue, 7200);
    assert.ok(Math.abs(a.cmv - ((24 * 80) / 7200 * 100)) < 1e-6);
  });

  it("cobertura em dias = estoque ÷ venda diária do período", () => {
    assert.ok(Math.abs(rows.find((r) => r.id === "a")!.coverageDays - (14 / (24 / 92))) < 1e-6);
    assert.equal(rows.find((r) => r.id === "b")!.coverageDays, null);
  });

  it("filtra por fornecedor principal ou da lista", () => {
    assert.deepEqual(filterRows(rows, wines, { ...base, suppliers: ["Mistral"] }, names).map((r) => r.id), ["b"]);
    assert.deepEqual(filterRows(rows, wines, { ...base, suppliers: ["Sem fornecedor"] }, names).map((r) => r.id), ["c"]);
  });

  it("agrupa por origem com participação no faturamento", () => {
    const g = groupRows(rows, wines, "origin", range.start, range.end);
    assert.deepEqual(g.map((x) => x.key), ["Nacionais (Brasil)", "Importados"]);
    assert.ok(Math.abs(g[0].revenueShare - ((7200 / 7800) * 100)) < 1e-6);
    assert.equal(totalsOf(rows, range.start, range.end).stock, 30);
  });

  it("últimos 3 meses terminam no fim do mês de referência", () => {
    assert.deepEqual(presetRange("last3", new Date(2026, 9, 15)), { start: "2026-08-01", end: "2026-10-31" });
  });
});
