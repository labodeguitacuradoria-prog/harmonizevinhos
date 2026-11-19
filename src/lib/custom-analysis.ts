// Explorador de análises customizadas do Painel: cruza cadastro, vendas e estoque.
// Funções puras para a tela e para os testes — sem acesso ao banco.

export type AnalysisWine = {
  id: string;
  name: string;
  wine_type: string | null;
  volume: string | null;
  country: string | null;
  producer: string | null;
  cost_price: number | null;
  sale_price: number | null;
  active_on_menu: boolean | null;
  internal_code?: string | null;
  supplier_id?: string | null;
  suppliers?: string[] | null;
};

export type AnalysisMovement = {
  wine_id: string;
  quantity: number;
  unit_price: number | null;
  unit_cost: number | null;
  occurred_at: string;
};

export type Origin = "all" | "br" | "import";
export type MenuStatus = "all" | "on" | "off";
export type Turnover = "all" | "zero" | "low" | "high";
export type Format = "all" | "bottle" | "glass";
export type GroupBy = "none" | "origin" | "country" | "type" | "supplier" | "menu";
export type SortKey =
  | "code" | "name" | "country" | "menu" | "stock" | "capital"
  | "sold" | "revenue" | "cmv" | "coverage";

export type AnalysisFilters = {
  start: string; // YYYY-MM-DD inclusive
  end: string;   // YYYY-MM-DD inclusive
  origin: Origin;
  country: string; // "" = todos
  menu: MenuStatus;
  types: string[]; // vazio = todos
  suppliers: string[]; // nomes; vazio = todos
  turnover: Turnover;
  format: Format;
  onlyWithStock: boolean;
  search: string;
};

export type AnalysisRow = {
  id: string;
  code: string;
  name: string;
  producer: string;
  country: string;
  type: string;
  supplier: string;
  onMenu: boolean;
  glass: boolean;
  stock: number;
  capital: number; // estoque × custo
  sold: number;
  soldPerMonth: number;
  revenue: number;
  cost: number;
  cmv: number | null; // % do faturamento
  coverageDays: number | null; // null = sem venda no período
  turnover: Exclude<Turnover, "all">;
};

export type AnalysisTotals = {
  labels: number;
  stock: number;
  capital: number;
  sold: number;
  revenue: number;
  cost: number;
  cmv: number | null;
  margin: number | null;
  coverageDays: number | null;
};

export const LOW_TURNOVER_PER_MONTH = 2;

export const fold = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export const isGlass = (v: string | null | undefined) => !!v && /taça|taca|glass/i.test(v);
export const isBrazil = (country: string | null | undefined) => /^(brasil|brazil|br)$/.test(fold(country));

export function wineTypeLabel(t: string | null | undefined): string {
  const f = fold(t);
  if (!f) return "Sem tipo";
  if (f.includes("espum") || f.includes("champ") || f.includes("sparkl")) return "Espumante";
  if (f.includes("rose")) return "Rosé";
  if (f.includes("branc") || f.includes("white")) return "Branco";
  if (f.includes("fortif") || f.includes("porto") || f.includes("madeira") || f.includes("jerez")) return "Fortificado";
  if (f.includes("sobrem") || f.includes("doce") || f.includes("dessert") || f.includes("colheita tardia")) return "Sobremesa";
  if (f.includes("tint") || f.includes("red")) return "Tinto";
  return t!.trim().charAt(0).toUpperCase() + t!.trim().slice(1);
}

export function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Data local (YYYY-MM-DD) de um movimento. */
export function movementDay(ts: string) {
  const d = new Date(ts);
  return isNaN(d.getTime()) ? ts.slice(0, 10) : dateKey(d);
}

/** Dias corridos do período, inclusive. */
export function periodDays(start: string, end: string) {
  const a = new Date(start + "T00:00:00").getTime();
  const b = new Date(end + "T00:00:00").getTime();
  if (isNaN(a) || isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

/** Meses equivalentes do período (30,44 dias = 1 mês), mínimo 1. */
export function periodMonths(start: string, end: string) {
  return Math.max(1, periodDays(start, end) / 30.44);
}

export type PeriodPreset = "lastMonth" | "last3" | "last6" | "last12" | "ytd" | "prevYear" | "custom";

/** Períodos rápidos ancorados no último mês com vendas (vendas são importadas por mês). */
export function presetRange(preset: Exclude<PeriodPreset, "custom">, anchor: Date): { start: string; end: string } {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const endOfMonth = (yy: number, mm: number) => dateKey(new Date(yy, mm + 1, 0));
  switch (preset) {
    case "lastMonth": return { start: dateKey(new Date(y, m, 1)), end: endOfMonth(y, m) };
    case "last3": return { start: dateKey(new Date(y, m - 2, 1)), end: endOfMonth(y, m) };
    case "last6": return { start: dateKey(new Date(y, m - 5, 1)), end: endOfMonth(y, m) };
    case "last12": return { start: dateKey(new Date(y, m - 11, 1)), end: endOfMonth(y, m) };
    case "ytd": return { start: `${y}-01-01`, end: endOfMonth(y, m) };
    case "prevYear": return { start: `${y - 1}-01-01`, end: `${y - 1}-12-31` };
  }
}

export function supplierOf(w: AnalysisWine, supplierNames: Map<string, string>): string {
  const main = w.supplier_id ? supplierNames.get(w.supplier_id) : undefined;
  if (main) return main;
  const first = (w.suppliers ?? []).find((s) => s && s.trim());
  return first?.trim() || "Sem fornecedor";
}

function supplierMatches(w: AnalysisWine, wanted: string[], supplierNames: Map<string, string>) {
  if (!wanted.length) return true;
  const names = new Set<string>();
  const main = w.supplier_id ? supplierNames.get(w.supplier_id) : undefined;
  if (main) names.add(fold(main));
  for (const s of w.suppliers ?? []) if (s?.trim()) names.add(fold(s));
  if (!names.size) names.add(fold("Sem fornecedor"));
  return wanted.some((s) => names.has(fold(s)));
}

export function classifyTurnover(soldPerMonth: number): Exclude<Turnover, "all"> {
  if (soldPerMonth <= 0) return "zero";
  return soldPerMonth < LOW_TURNOVER_PER_MONTH ? "low" : "high";
}

export function buildRows(
  wines: AnalysisWine[],
  movements: AnalysisMovement[],
  stockMap: Record<string, number>,
  supplierNames: Map<string, string>,
  start: string,
  end: string,
): AnalysisRow[] {
  const days = periodDays(start, end);
  const months = periodMonths(start, end);
  const sales = new Map<string, { q: number; rev: number; cost: number }>();
  const byId = new Map(wines.map((w) => [w.id, w]));
  for (const m of movements) {
    const day = movementDay(m.occurred_at);
    if (day < start || day > end) continue;
    const w = byId.get(m.wine_id);
    if (!w) continue;
    const q = Number(m.quantity) || 0;
    const price = Number(m.unit_price ?? w.sale_price ?? 0) || 0;
    const movCost = Number(m.unit_cost ?? 0);
    const cost = movCost > 0 ? movCost : Number(w.cost_price ?? 0) || 0;
    const s = sales.get(w.id) ?? { q: 0, rev: 0, cost: 0 };
    s.q += q; s.rev += price * q; s.cost += cost * q;
    sales.set(w.id, s);
  }
  return wines.map((w) => {
    const glass = isGlass(w.volume);
    const s = sales.get(w.id) ?? { q: 0, rev: 0, cost: 0 };
    const stock = glass ? 0 : Math.max(0, Number(stockMap[w.id] ?? 0));
    const perMonth = s.q / months;
    const perDay = days > 0 ? s.q / days : 0;
    return {
      id: w.id,
      code: (w.internal_code ?? "").trim(),
      name: w.name,
      producer: (w.producer ?? "").trim(),
      country: (w.country ?? "").trim() || "Sem país",
      type: wineTypeLabel(w.wine_type),
      supplier: supplierOf(w, supplierNames),
      onMenu: w.active_on_menu !== false,
      glass,
      stock,
      capital: stock * (Number(w.cost_price) || 0),
      sold: s.q,
      soldPerMonth: perMonth,
      revenue: s.rev,
      cost: s.cost,
      cmv: s.rev > 0 ? (s.cost / s.rev) * 100 : null,
      coverageDays: perDay > 0 ? stock / perDay : null,
      turnover: classifyTurnover(perMonth),
    };
  });
}

export function filterRows(
  rows: AnalysisRow[],
  wines: AnalysisWine[],
  f: AnalysisFilters,
  supplierNames: Map<string, string>,
): AnalysisRow[] {
  const byId = new Map(wines.map((w) => [w.id, w]));
  const q = fold(f.search);
  const types = new Set(f.types);
  return rows.filter((r) => {
    const w = byId.get(r.id);
    if (!w) return false;
    if (f.origin === "br" && !isBrazil(w.country)) return false;
    if (f.origin === "import" && isBrazil(w.country)) return false;
    if (f.country && fold(r.country) !== fold(f.country)) return false;
    if (f.menu === "on" && !r.onMenu) return false;
    if (f.menu === "off" && r.onMenu) return false;
    if (types.size && !types.has(r.type)) return false;
    if (!supplierMatches(w, f.suppliers, supplierNames)) return false;
    if (f.turnover !== "all" && r.turnover !== f.turnover) return false;
    if (f.format === "bottle" && r.glass) return false;
    if (f.format === "glass" && !r.glass) return false;
    if (f.onlyWithStock && r.stock <= 0) return false;
    if (q && !fold(`${r.code} ${r.name} ${r.producer}`).includes(q)) return false;
    return true;
  });
}

export function totalsOf(rows: AnalysisRow[], start: string, end: string): AnalysisTotals {
  const t = rows.reduce(
    (a, r) => ({ stock: a.stock + r.stock, capital: a.capital + r.capital, sold: a.sold + r.sold, revenue: a.revenue + r.revenue, cost: a.cost + r.cost }),
    { stock: 0, capital: 0, sold: 0, revenue: 0, cost: 0 },
  );
  const days = periodDays(start, end);
  // Cobertura só considera garrafas, pois taças não têm estoque próprio.
  const bottleSold = rows.filter((r) => !r.glass).reduce((a, r) => a + r.sold, 0);
  const perDay = days > 0 ? bottleSold / days : 0;
  return {
    labels: rows.length,
    ...t,
    cmv: t.revenue > 0 ? (t.cost / t.revenue) * 100 : null,
    margin: t.revenue > 0 ? ((t.revenue - t.cost) / t.revenue) * 100 : null,
    coverageDays: perDay > 0 ? t.stock / perDay : null,
  };
}

export function groupKey(r: AnalysisRow, by: GroupBy, wine: AnalysisWine | undefined): string {
  switch (by) {
    case "origin": return isBrazil(wine?.country) ? "Nacionais (Brasil)" : "Importados";
    case "country": return r.country;
    case "type": return r.type;
    case "supplier": return r.supplier;
    case "menu": return r.onMenu ? "Na carta" : "Fora da carta";
    default: return "Todos";
  }
}

export function groupRows(
  rows: AnalysisRow[],
  wines: AnalysisWine[],
  by: GroupBy,
  start: string,
  end: string,
): Array<{ key: string; totals: AnalysisTotals; revenueShare: number }> {
  if (by === "none") return [];
  const byId = new Map(wines.map((w) => [w.id, w]));
  const groups = new Map<string, AnalysisRow[]>();
  for (const r of rows) {
    const k = groupKey(r, by, byId.get(r.id));
    const list = groups.get(k) ?? [];
    list.push(r);
    groups.set(k, list);
  }
  const totalRev = rows.reduce((a, r) => a + r.revenue, 0);
  return Array.from(groups.entries())
    .map(([key, list]) => {
      const totals = totalsOf(list, start, end);
      return { key, totals, revenueShare: totalRev > 0 ? (totals.revenue / totalRev) * 100 : 0 };
    })
    .sort((a, b) => b.totals.revenue - a.totals.revenue || b.totals.capital - a.totals.capital || a.key.localeCompare(b.key, "pt-BR"));
}

export function sortRows(rows: AnalysisRow[], key: SortKey, dir: "asc" | "desc"): AnalysisRow[] {
  const val = (r: AnalysisRow): number | string => {
    switch (key) {
      case "code": return r.code;
      case "name": return fold(r.name);
      case "country": return fold(`${r.country} ${r.type}`);
      case "menu": return r.onMenu ? 1 : 0;
      case "stock": return r.stock;
      case "capital": return r.capital;
      case "sold": return r.sold;
      case "revenue": return r.revenue;
      case "cmv": return r.cmv ?? -1;
      case "coverage": return r.coverageDays ?? (r.stock > 0 ? Number.POSITIVE_INFINITY : -1);
    }
  };
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = val(a), y = val(b);
    const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "pt-BR", { numeric: true });
    return c * sign || a.name.localeCompare(b.name, "pt-BR");
  });
}
