import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import {
  ArrowLeft, ArrowDown, ArrowUp, Flame, Flag, Snowflake, Trophy, RotateCcw,
  FileSpreadsheet, Printer, Search, SlidersHorizontal, Check, ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  buildRows, dateKey, filterRows, fold, groupRows, movementDay, presetRange, sortRows, totalsOf,
  LOW_TURNOVER_PER_MONTH,
  type AnalysisFilters, type AnalysisMovement, type AnalysisRow, type AnalysisWine,
  type GroupBy, type PeriodPreset, type SortKey,
} from "@/lib/custom-analysis";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Rótulos já carregados pelo painel (também usados no acesso por link). */
  wines: AnalysisWine[];
  /** Vendas já carregadas pelo painel — usadas no acesso por link. */
  movements: AnalysisMovement[];
  stockMap: Record<string, number>;
  stockDate: string | null;
  scopeIds: string[];
  guest?: boolean;
};

const PRESETS: Array<{ key: PeriodPreset; label: string }> = [
  { key: "lastMonth", label: "Último mês com vendas" },
  { key: "last3", label: "Últimos 3 meses" },
  { key: "last6", label: "Últimos 6 meses" },
  { key: "last12", label: "Últimos 12 meses" },
  { key: "ytd", label: "Ano atual (acumulado)" },
  { key: "prevYear", label: "Ano anterior" },
  { key: "custom", label: "Personalizado" },
];

const TYPE_ORDER = ["Tinto", "Branco", "Rosé", "Espumante", "Sobremesa", "Fortificado"];

const GROUPS: Array<{ key: GroupBy; label: string }> = [
  { key: "none", label: "Sem agrupamento" },
  { key: "origin", label: "Nacionais x Importados" },
  { key: "country", label: "País" },
  { key: "type", label: "Tipo de vinho" },
  { key: "supplier", label: "Fornecedor" },
  { key: "menu", label: "Situação na carta" },
];

type QuickView = "burn" | "origin" | "still" | "top10" | null;

const brl = (n: number, d = 0) => n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (n: number | null) => (n === null ? "—" : `${n.toFixed(1)}%`);
const days = (r: { coverageDays: number | null; stock: number }) =>
  r.coverageDays === null ? (r.stock > 0 ? "Encalhado" : "—")
    : r.stock <= 0 ? "Sem estoque"
    : r.coverageDays > 999 ? "+999 dias" : `~${Math.round(r.coverageDays)} dias`;
const fmtDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR");
};

async function fetchAllSales(scopeIds: string[]): Promise<AnalysisMovement[]> {
  const since = new Date(new Date().getFullYear() - 3, 0, 1).toISOString();
  const out: AnalysisMovement[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("inventory_movements")
      .select("id, wine_id, quantity, unit_price, unit_cost, occurred_at")
      .in("restaurant_id", scopeIds)
      .eq("movement_type", "sale")
      .gte("occurred_at", since)
      .order("occurred_at")
      .order("id")
      .range(offset, offset + 999);
    if (error) throw error;
    out.push(...((data ?? []) as AnalysisMovement[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export default function CustomAnalysisExplorer({ open, onClose, wines: baseWines, movements: baseMovements, stockMap, stockDate, scopeIds, guest }: Props) {
  const scopeKey = scopeIds.join(",");
  const live = open && !guest && scopeIds.length > 0;

  const { data: extra, isLoading: extraLoading } = useQuery({
    queryKey: ["analysis-wines-extra", scopeKey],
    enabled: live,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wines")
        .select("id, internal_code, supplier_id, suppliers")
        .in("restaurant_id", scopeIds);
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((w) => w.supplier_id).filter(Boolean))) as string[];
      let sup: Array<{ id: string; name: string }> = [];
      if (ids.length) {
        const { data: s } = await supabase.from("suppliers").select("id, name").in("id", ids);
        sup = s ?? [];
      }
      return { wines: data ?? [], suppliers: sup };
    },
  });

  const { data: liveSales, isLoading: salesLoading } = useQuery({
    queryKey: ["analysis-sales", scopeKey],
    enabled: live,
    queryFn: () => fetchAllSales(scopeIds),
  });

  const wines: AnalysisWine[] = useMemo(() => {
    if (!extra) return baseWines;
    const ex = new Map(extra.wines.map((w) => [w.id, w]));
    return baseWines.map((w) => {
      const e = ex.get(w.id);
      return e ? { ...w, internal_code: e.internal_code, supplier_id: e.supplier_id, suppliers: e.suppliers } : w;
    });
  }, [baseWines, extra]);
  const movements = guest ? baseMovements : liveSales ?? baseMovements;
  const supplierNames = useMemo(() => new Map((extra?.suppliers ?? []).map((s) => [s.id, s.name])), [extra]);
  const hasSupplierData = !guest;

  // Âncora dos períodos rápidos: último mês com vendas registradas (vendas são lançadas por mês).
  const anchor = useMemo(() => {
    let last = "";
    for (const m of movements) {
      const d = movementDay(m.occurred_at);
      if (d > last) last = d;
    }
    return last ? new Date(last + "T00:00:00") : new Date();
  }, [movements]);

  const [preset, setPreset] = useState<PeriodPreset>("last3");
  const initial = presetRange("last3", anchor);
  const [filters, setFilters] = useState<AnalysisFilters>({
    ...initial, origin: "all", country: "", menu: "all", types: [], suppliers: [],
    turnover: "all", format: "all", onlyWithStock: false, search: "",
  });
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "revenue", dir: "desc" });
  const [limit, setLimit] = useState<number | null>(null);
  const [quick, setQuick] = useState<QuickView>(null);

  // Quando as vendas chegam, reposiciona o período rápido no último mês com dados.
  const anchorKey = dateKey(anchor);
  useEffect(() => {
    if (preset === "custom") return;
    setFilters((f) => ({ ...f, ...presetRange(preset, anchor) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorKey, preset]);

  const set = <K extends keyof AnalysisFilters>(k: K, v: AnalysisFilters[K]) => {
    setQuick(null);
    setFilters((f) => ({ ...f, [k]: v }));
  };

  const rows = useMemo(
    () => buildRows(wines, movements, stockMap, supplierNames, filters.start, filters.end),
    [wines, movements, stockMap, supplierNames, filters.start, filters.end],
  );
  const filtered = useMemo(() => filterRows(rows, wines, filters, supplierNames), [rows, wines, filters, supplierNames]);
  const sorted = useMemo(() => {
    const s = sortRows(filtered, sort.key, sort.dir);
    return limit ? s.slice(0, limit) : s;
  }, [filtered, sort, limit]);
  const totals = useMemo(() => totalsOf(sorted, filters.start, filters.end), [sorted, filters.start, filters.end]);
  const groups = useMemo(() => groupRows(sorted, wines, groupBy, filters.start, filters.end), [sorted, wines, groupBy, filters.start, filters.end]);

  const countries = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (!m.has(fold(r.country))) m.set(fold(r.country), r.country);
    return Array.from(m.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [rows]);
  const types = useMemo(() => {
    const s = new Set(rows.map((r) => r.type));
    return Array.from(s).sort((a, b) => {
      const ia = TYPE_ORDER.indexOf(a), ib = TYPE_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, "pt-BR");
    });
  }, [rows]);
  const supplierOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of wines) {
      const main = w.supplier_id ? supplierNames.get(w.supplier_id) : undefined;
      for (const n of [main, ...(w.suppliers ?? [])]) if (n?.trim() && !m.has(fold(n))) m.set(fold(n), n.trim());
    }
    const list = Array.from(m.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return [...list, "Sem fornecedor"];
  }, [wines, supplierNames]);

  if (!open) return null;

  const loading = live && (extraLoading || salesLoading);

  function applyPreset(p: PeriodPreset) {
    setPreset(p);
    setQuick(null);
    if (p !== "custom") setFilters((f) => ({ ...f, ...presetRange(p, anchor) }));
  }

  function resetAll() {
    setPreset("last3");
    setFilters({
      ...presetRange("last3", anchor), origin: "all", country: "", menu: "all", types: [], suppliers: [],
      turnover: "all", format: "all", onlyWithStock: false, search: "",
    });
    setGroupBy("none");
    setSort({ key: "revenue", dir: "desc" });
    setLimit(null);
    setQuick(null);
  }

  function applyQuick(q: Exclude<QuickView, null>) {
    resetAll();
    setQuick(q);
    if (q === "burn") {
      setFilters((f) => ({ ...f, menu: "off", onlyWithStock: true, format: "bottle" }));
      setSort({ key: "capital", dir: "desc" });
    } else if (q === "origin") {
      setGroupBy("origin");
    } else if (q === "still") {
      setPreset("custom");
      const end = presetRange("lastMonth", anchor).end;
      const start = dateKey(new Date(new Date(end + "T00:00:00").getTime() - 59 * 86_400_000));
      setFilters((f) => ({ ...f, start, end, turnover: "zero", onlyWithStock: true, format: "bottle" }));
      setSort({ key: "capital", dir: "desc" });
    } else if (q === "top10") {
      setSort({ key: "revenue", dir: "desc" });
      setLimit(10);
    }
  }

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" || key === "code" || key === "country" ? "asc" : "desc" }));
  }

  function exportExcel() {
    const data = sorted.map((r) => ({
      Código: r.code,
      Rótulo: r.name,
      Produtor: r.producer,
      País: r.country,
      Tipo: r.type,
      Fornecedor: r.supplier,
      "Situação na carta": r.onMenu ? "Na carta" : "Fora da carta",
      Formato: r.glass ? "Taça" : "Garrafa",
      "Estoque (gf)": r.stock,
      "Capital parado (R$)": Number(r.capital.toFixed(2)),
      "Vendas no período": r.sold,
      "Vendas/mês": Number(r.soldPerMonth.toFixed(2)),
      "Faturamento (R$)": Number(r.revenue.toFixed(2)),
      "CMV (%)": r.cmv === null ? "" : Number(r.cmv.toFixed(1)),
      "Cobertura (dias)": r.coverageDays === null ? (r.stock > 0 ? "Encalhado" : "") : Math.round(r.coverageDays),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Rótulos");
    if (groups.length) {
      const g = groups.map((x) => ({
        Grupo: x.key,
        Rótulos: x.totals.labels,
        "Estoque (gf)": x.totals.stock,
        "Capital parado (R$)": Number(x.totals.capital.toFixed(2)),
        Vendas: x.totals.sold,
        "Faturamento (R$)": Number(x.totals.revenue.toFixed(2)),
        "Participação (%)": Number(x.revenueShare.toFixed(1)),
        "CMV (%)": x.totals.cmv === null ? "" : Number(x.totals.cmv.toFixed(1)),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(g), "Resumo");
    }
    XLSX.writeFile(wb, `analise-vinhos-${filters.start}-a-${filters.end}.xlsx`);
  }

  const activeCount =
    (filters.origin !== "all" ? 1 : 0) + (filters.country ? 1 : 0) + (filters.menu !== "all" ? 1 : 0) +
    (filters.types.length ? 1 : 0) + (filters.suppliers.length ? 1 : 0) + (filters.turnover !== "all" ? 1 : 0) +
    (filters.format !== "all" ? 1 : 0) + (filters.onlyWithStock ? 1 : 0) + (filters.search ? 1 : 0);

  const sel = "h-9 w-full rounded-md border border-border bg-[color:var(--surface-2)] px-2 text-[12px] text-foreground outline-none focus:border-primary";
  const lbl = "mb-1 block text-[9px] font-semibold uppercase tracking-wider text-muted-foreground";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-0 sm:p-4 print:static print:bg-white print:p-0">
      <div
        id="print-area"
        className="analysis-print relative max-h-[100dvh] w-full max-w-7xl overflow-y-auto no-scrollbar rounded-none border-0 bg-card p-4 sm:max-h-[92vh] sm:rounded-xl sm:border sm:border-border sm:p-6 print:max-h-none print:overflow-visible print:border-0"
      >
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={onClose}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-primary transition hover:bg-primary hover:text-primary-foreground no-print"
            >
              <ArrowLeft size={13} /> Voltar
            </button>
            <div className="min-w-0">
              <h2 className="page-title truncate text-base">Outras análises</h2>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                Vendas de {fmtDate(filters.start)} a {fmtDate(filters.end)}
                {stockDate ? ` · estoque da contagem de ${fmtDate(stockDate)}` : " · sem contagem de estoque fechada"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2 no-print">
            <button
              onClick={exportExcel}
              disabled={!sorted.length}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-[color:var(--surface-2)] px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-primary transition hover:border-primary disabled:opacity-40"
            >
              <FileSpreadsheet size={13} /> Excel
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-primary-foreground transition hover:opacity-90"
            >
              <Printer size={13} /> Imprimir
            </button>
          </div>
        </div>

        {/* Visões rápidas */}
        <div className="mt-4 no-print">
          <div className={lbl}>Visões rápidas</div>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {([
              { k: "burn", icon: <Flame size={13} />, label: "Queima de estoque", hint: "Fora da carta com garrafas em adega" },
              { k: "origin", icon: <Flag size={13} />, label: "Nacionais x Importados", hint: "Comparativo de vendas e estoque" },
              { k: "still", icon: <Snowflake size={13} />, label: "Sem giro (60 dias)", hint: "Com estoque e nenhuma venda em 60 dias" },
              { k: "top10", icon: <Trophy size={13} />, label: "Top 10 faturamento", hint: "Rótulos que mais faturaram no período" },
            ] as const).map((q) => (
              <button
                key={q.k}
                onClick={() => applyQuick(q.k)}
                title={q.hint}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition ${
                  quick === q.k ? "border-primary bg-[color:var(--surface-2)] text-primary" : "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary"
                }`}
              >
                {q.icon} {q.label}
              </button>
            ))}
            <button
              onClick={resetAll}
              className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition hover:border-primary hover:text-primary"
            >
              <RotateCcw size={13} /> Limpar tudo
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="mt-4 rounded-xl border border-border bg-[color:var(--surface-2)]/40 p-3 no-print">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-primary">
            <SlidersHorizontal size={13} /> Filtros combinados
            {activeCount > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] text-primary-foreground">{activeCount}</span>}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            <div className="col-span-2 md:col-span-2">
              <label className={lbl}>Período de vendas</label>
              <select className={sel} value={preset} onChange={(e) => applyPreset(e.target.value as PeriodPreset)}>
                {PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
              {preset === "custom" && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input type="date" aria-label="Data inicial" className={sel} value={filters.start} max={filters.end} onChange={(e) => e.target.value && set("start", e.target.value)} />
                  <input type="date" aria-label="Data final" className={sel} value={filters.end} min={filters.start} onChange={(e) => e.target.value && set("end", e.target.value)} />
                </div>
              )}
            </div>
            <div>
              <label className={lbl}>Origem</label>
              <select className={sel} value={filters.origin} onChange={(e) => set("origin", e.target.value as AnalysisFilters["origin"])}>
                <option value="all">Todos</option>
                <option value="br">Nacionais (Brasil)</option>
                <option value="import">Importados</option>
              </select>
            </div>
            <div>
              <label className={lbl}>País</label>
              <select className={sel} value={filters.country} onChange={(e) => set("country", e.target.value)}>
                <option value="">Todos</option>
                {countries.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Situação na carta</label>
              <select className={sel} value={filters.menu} onChange={(e) => set("menu", e.target.value as AnalysisFilters["menu"])}>
                <option value="all">Todos</option>
                <option value="on">Na carta</option>
                <option value="off">Fora da carta</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Giro no período</label>
              <select className={sel} value={filters.turnover} onChange={(e) => set("turnover", e.target.value as AnalysisFilters["turnover"])}>
                <option value="all">Todos</option>
                <option value="zero">Sem saída (giro zero)</option>
                <option value="low">Giro baixo (&lt; {LOW_TURNOVER_PER_MONTH} gf/mês)</option>
                <option value="high">Alto giro (≥ {LOW_TURNOVER_PER_MONTH} gf/mês)</option>
              </select>
            </div>
            {hasSupplierData && (
              <div className="col-span-2 md:col-span-2">
                <label className={lbl}>Fornecedores</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className={`${sel} flex items-center justify-between text-left`}>
                      <span className="truncate">
                        {filters.suppliers.length === 0 ? "Todos" : filters.suppliers.length === 1 ? filters.suppliers[0] : `${filters.suppliers.length} fornecedores`}
                      </span>
                      <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="z-[60] max-h-72 w-72 overflow-y-auto p-1">
                    {supplierOptions.map((s) => {
                      const on = filters.suppliers.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => set("suppliers", on ? filters.suppliers.filter((x) => x !== s) : [...filters.suppliers, s])}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] hover:bg-[color:var(--surface-2)]"
                        >
                          <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                            {on && <Check size={11} />}
                          </span>
                          <span className="truncate">{s}</span>
                        </button>
                      );
                    })}
                    {filters.suppliers.length > 0 && (
                      <button type="button" onClick={() => set("suppliers", [])} className="mt-1 w-full rounded border-t border-border px-2 py-1.5 text-left text-[11px] text-primary">
                        Limpar seleção
                      </button>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            )}
            <div>
              <label className={lbl}>Formato</label>
              <select className={sel} value={filters.format} onChange={(e) => set("format", e.target.value as AnalysisFilters["format"])}>
                <option value="all">Garrafas e taças</option>
                <option value="bottle">Só garrafas</option>
                <option value="glass">Só taças</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Agrupar resumo por</label>
              <select className={sel} value={groupBy} onChange={(e) => { setQuick(null); setGroupBy(e.target.value as GroupBy); }}>
                {GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className={lbl}>Buscar rótulo, código ou produtor</label>
              <div className="relative">
                <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input className={`${sel} pl-8`} value={filters.search} onChange={(e) => set("search", e.target.value)} placeholder="Ex.: Malbec, 1002075…" />
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`${lbl} mb-0 mr-1`}>Tipo</span>
            {types.map((t) => {
              const on = filters.types.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => set("types", on ? filters.types.filter((x) => x !== t) : [...filters.types, t])}
                  className={`rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
                    on ? "border-primary bg-[color:var(--surface-2)] text-primary" : "border-border text-muted-foreground hover:border-primary/60"
                  }`}
                >
                  {t}
                </button>
              );
            })}
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground">
              <input type="checkbox" className="accent-[color:var(--gold)]" checked={filters.onlyWithStock} onChange={(e) => set("onlyWithStock", e.target.checked)} />
              Só rótulos com estoque
            </label>
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
              Mostrar
              <select className="h-7 rounded-md border border-border bg-[color:var(--surface-2)] px-1 text-[11px] text-foreground" value={limit ?? 0} onChange={(e) => { setQuick(null); setLimit(Number(e.target.value) || null); }}>
                <option value={0}>todos</option>
                <option value={10}>top 10</option>
                <option value={20}>top 20</option>
                <option value={50}>top 50</option>
              </select>
            </label>
          </div>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary border-b-transparent" />
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-7">
              <Kpi label="Rótulos" value={String(totals.labels)} />
              <Kpi label="Estoque atual" value={`${brl(totals.stock)} gf`} />
              <Kpi label="Capital parado (custo)" value={`R$ ${brl(totals.capital)}`} />
              <Kpi label="Vendas no período" value={`${brl(totals.sold)} un.`} />
              <Kpi label="Faturamento" value={`R$ ${brl(totals.revenue)}`} />
              <Kpi label="CMV · Margem" value={`${pct(totals.cmv)} · ${pct(totals.margin)}`} />
              <Kpi label="Cobertura média" value={days(totals)} />
            </div>

            {/* Resumo agrupado */}
            {groups.length > 0 && (
              <div className="mt-4 rounded-xl border border-border bg-card p-4">
                <div className="section-title">Resumo por {GROUPS.find((g) => g.key === groupBy)?.label.toLowerCase()}</div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-[12px]">
                    <thead>
                      <tr className="border-b border-border text-left text-[9px] uppercase tracking-wider text-muted-foreground">
                        <th className="py-2 pr-2">Grupo</th>
                        <th className="py-2 pr-2 text-right">Rótulos</th>
                        <th className="py-2 pr-2 text-right">Estoque</th>
                        <th className="py-2 pr-2 text-right">Capital parado</th>
                        <th className="py-2 pr-2 text-right">Vendas</th>
                        <th className="py-2 pr-2 text-right">Faturamento</th>
                        <th className="py-2 pr-2">Participação</th>
                        <th className="py-2 text-right">CMV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map((g) => (
                        <tr key={g.key} className="border-b border-border/50">
                          <td className="py-2 pr-2 font-semibold text-foreground">{g.key}</td>
                          <td className="py-2 pr-2 text-right">{g.totals.labels}</td>
                          <td className="py-2 pr-2 text-right">{brl(g.totals.stock)} gf</td>
                          <td className="py-2 pr-2 text-right">R$ {brl(g.totals.capital)}</td>
                          <td className="py-2 pr-2 text-right">{brl(g.totals.sold)}</td>
                          <td className="py-2 pr-2 text-right font-semibold text-primary">R$ {brl(g.totals.revenue)}</td>
                          <td className="py-2 pr-2">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[color:var(--surface-2)]">
                                <div className="h-full bg-primary" style={{ width: `${Math.min(100, g.revenueShare)}%` }} />
                              </div>
                              <span className="text-[11px] text-muted-foreground">{g.revenueShare.toFixed(1)}%</span>
                            </div>
                          </td>
                          <td className="py-2 text-right">{pct(g.totals.cmv)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tabela detalhada */}
            <div className="mt-4 rounded-xl border border-border bg-card p-4">
              <div className="section-title flex items-center justify-between">
                <span>Rótulo a rótulo</span>
                <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground">
                  {sorted.length} de {rows.length} rótulos · clique no título da coluna para ordenar
                </span>
              </div>
              {sorted.length === 0 ? (
                <p className="py-10 text-center text-[12px] text-muted-foreground">Nenhum rótulo atende aos filtros escolhidos.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-[12px]">
                    <thead>
                      <tr className="border-b border-border text-left text-[9px] uppercase tracking-wider text-muted-foreground">
                        <Th k="code" sort={sort} onSort={toggleSort}>Código</Th>
                        <Th k="name" sort={sort} onSort={toggleSort}>Rótulo / Produtor</Th>
                        <Th k="country" sort={sort} onSort={toggleSort}>País / Tipo</Th>
                        <Th k="menu" sort={sort} onSort={toggleSort}>Carta</Th>
                        <Th k="stock" sort={sort} onSort={toggleSort} right>Estoque</Th>
                        <Th k="capital" sort={sort} onSort={toggleSort} right>Capital parado</Th>
                        <Th k="sold" sort={sort} onSort={toggleSort} right>Vendas</Th>
                        <Th k="revenue" sort={sort} onSort={toggleSort} right>Faturamento</Th>
                        <Th k="cmv" sort={sort} onSort={toggleSort} right>CMV</Th>
                        <Th k="coverage" sort={sort} onSort={toggleSort} right>Cobertura</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((r) => <Row key={r.id} r={r} showSupplier={hasSupplierData} />)}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <p className="mt-3 text-[10px] text-muted-foreground">
              Faturamento e CMV consideram apenas vendas de vinhos (sem taxa de rolha). Capital parado = garrafas da última contagem × custo do cadastro.
              Giro baixo: menos de {LOW_TURNOVER_PER_MONTH} unidades por mês no período.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-border bg-card px-2 py-3 text-center">
      <span className="mb-1 block text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <b className="block truncate text-[15px] text-primary">{value}</b>
    </div>
  );
}

function Th({ k, sort, onSort, right, children }: { k: SortKey; sort: { key: SortKey; dir: "asc" | "desc" }; onSort: (k: SortKey) => void; right?: boolean; children: React.ReactNode }) {
  const active = sort.key === k;
  return (
    <th className={`py-2 pr-2 ${right ? "text-right" : ""}`}>
      <button onClick={() => onSort(k)} className={`inline-flex items-center gap-1 uppercase tracking-wider ${active ? "text-primary" : "hover:text-primary"}`}>
        {children}
        {active && (sort.dir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
      </button>
    </th>
  );
}

function Row({ r, showSupplier }: { r: AnalysisRow; showSupplier: boolean }) {
  const stuck = r.coverageDays === null && r.stock > 0;
  return (
    <tr className="border-b border-border/50 align-top">
      <td className="py-2 pr-2 font-mono text-[11px] text-muted-foreground">{r.code || "—"}</td>
      <td className="py-2 pr-2">
        <div className="font-semibold text-foreground">{r.name}</div>
        <div className="text-[10px] text-muted-foreground">
          {[r.producer, showSupplier ? r.supplier : "", r.glass ? "Taça" : ""].filter(Boolean).join(" · ")}
        </div>
      </td>
      <td className="py-2 pr-2 text-muted-foreground">{r.country} · {r.type}</td>
      <td className="py-2 pr-2">
        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${r.onMenu ? "border border-primary/50 text-primary" : "border border-border text-muted-foreground"}`}>
          {r.onMenu ? "Na carta" : "Fora"}
        </span>
      </td>
      <td className="py-2 pr-2 text-right">{r.glass ? "—" : `${brl(r.stock)} gf`}</td>
      <td className="py-2 pr-2 text-right">{r.glass ? "—" : `R$ ${brl(r.capital)}`}</td>
      <td className="py-2 pr-2 text-right">
        {brl(r.sold)}
        <div className="text-[10px] text-muted-foreground">{r.soldPerMonth.toFixed(1)}/mês</div>
      </td>
      <td className="py-2 pr-2 text-right font-semibold text-primary">R$ {brl(r.revenue)}</td>
      <td className="py-2 pr-2 text-right">{pct(r.cmv)}</td>
      <td className={`py-2 text-right ${stuck ? "font-bold text-destructive" : ""}`}>{r.glass ? "—" : days(r)}</td>
    </tr>
  );
}
