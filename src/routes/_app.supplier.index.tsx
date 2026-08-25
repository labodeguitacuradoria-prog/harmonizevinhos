import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { CalendarRange, Info, Store, TrendingUp } from "lucide-react";
import { BarChart, PieSvg } from "@/routes/_app.app.dashboard";
import { MaterialsManager } from "@/routes/_app.app.suppliers";
import { useSupplierScope } from "@/lib/supplier-scope";

export const Route = createFileRoute("/_app/supplier/")({
  component: SupplierPortal,
});

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const TOP_COLORS = ["var(--gold)", "var(--wine)", "#f1e788", "#c9a8a8", "#4a0404", "#8a7a2a"];

function fmtBRL(n: number, digits = 0) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function monthLabel(year: number, monthIdx: number) {
  if (monthIdx < 0) return "—";
  return `${MONTHS[monthIdx]}/${String(year).slice(-2)}`;
}

const isGlassVol = (v: string | null | undefined) => !!v && /taça|taca|glass/i.test(v);

type SupplierWine = {
  id: string;
  name: string;
  vintage: number | null;
  volume: string | null;
  cost_price: number | null;
  sale_price: number | null;
  restaurant_id: string;
  restaurants: { name?: string | null; city?: string | null } | null;
};

type Mov = {
  wine_id: string;
  restaurant_id: string;
  movement_type: string;
  quantity: number;
  unit_price: number | null;
  unit_cost: number | null;
  occurred_at: string;
};

type TabKey = "faturamento" | "garrafas" | "estoque" | "preco" | "cmv";

function SupplierPortal() {
  const { role, supplierId, loading } = useAuth();
  const navigate = useNavigate();
  const { restaurantId, setRestaurantId } = useSupplierScope();
  const [tab, setTab] = useState<TabKey>("faturamento");
  const [periodOpen, setPeriodOpen] = useState(false);
  const [period, setPeriod] = useState<{ year: number; month: number; mode?: "year" } | null>(null);

  useEffect(() => {
    if (!loading && role !== "supplier") navigate({ to: "/app" });
  }, [role, loading, navigate]);

  const now = new Date();
  const currentYear = now.getFullYear();
  const previousYear = currentYear - 1;
  const currentMonth = now.getMonth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["supplier-portal", supplierId],
    enabled: !!supplierId,
    queryFn: async () => {
      const { data: wines } = await supabase
        .from("wines")
        .select(
          "id, name, vintage, volume, sale_price, cost_price, restaurant_id, restaurants(name, city)",
        )
        .eq("supplier_id", supplierId!)
        .order("name");
      const wineIds = (wines ?? []).map((w) => w.id);
      const { data: movs } = wineIds.length
        ? await supabase
            .from("inventory_movements")
            .select("wine_id, restaurant_id, movement_type, quantity, unit_price, unit_cost, occurred_at")
            .in("wine_id", wineIds)
        : { data: [] };
      const { data: materials } = await supabase
        .from("supplier_materials")
        .select("*")
        .eq("supplier_id", supplierId!)
        .order("created_at", { ascending: false });
      return {
        wines: (wines ?? []) as SupplierWine[],
        movs: (movs ?? []) as Mov[],
        materials: materials ?? [],
      };
    },
  });

  const allWines = data?.wines ?? [];
  const allMovs = data?.movs ?? [];

  const restaurants = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of allWines) m.set(w.restaurant_id, w.restaurants?.name ?? "Restaurante");
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [allWines]);

  useEffect(() => {
    if (!restaurantId && restaurants.length) setRestaurantId(restaurants[0].id);
    if (restaurantId && restaurants.length && !restaurants.some((r) => r.id === restaurantId)) {
      setRestaurantId(restaurants[0].id);
    }
  }, [restaurantId, restaurants, setRestaurantId]);

  const wines = useMemo(
    () => allWines.filter((w) => !restaurantId || w.restaurant_id === restaurantId),
    [allWines, restaurantId],
  );
  const wineIdSet = useMemo(() => new Set(wines.map((w) => w.id)), [wines]);
  const movs = useMemo(() => allMovs.filter((m) => wineIdSet.has(m.wine_id)), [allMovs, wineIdSet]);

  const wineById = useMemo(() => {
    const m: Record<string, SupplierWine> = {};
    for (const w of wines) m[w.id] = w;
    return m;
  }, [wines]);

  const agg = useMemo(() => {
    const empty = () => Array(12).fill(0) as number[];
    const rev: Record<number, number[]> = { [currentYear]: empty(), [previousYear]: empty() };
    const bottles: Record<number, number[]> = { [currentYear]: empty(), [previousYear]: empty() };
    const cost: Record<number, number[]> = { [currentYear]: empty(), [previousYear]: empty() };
    const units: Record<number, number[]> = { [currentYear]: empty(), [previousYear]: empty() };
    const stockByWine: Record<string, number> = {};
    const revByWineYear: Record<string, number> = {};
    const revByWineMonth: Record<string, number> = {};

    for (const m of movs) {
      const sign = m.movement_type === "sale" ? -1 : 1;
      stockByWine[m.wine_id] = (stockByWine[m.wine_id] ?? 0) + sign * (m.quantity ?? 0);
      if (m.movement_type !== "sale") continue;
      const d = new Date(m.occurred_at);
      const y = d.getFullYear();
      const mo = d.getMonth();
      if (y !== currentYear && y !== previousYear) continue;
      const w = wineById[m.wine_id];
      const q = m.quantity ?? 0;
      const price = Number(m.unit_price ?? w?.sale_price ?? 0);
      const c = Number(m.unit_cost ?? w?.cost_price ?? 0);
      const r = price * q;
      rev[y][mo] += r;
      cost[y][mo] += c * q;
      units[y][mo] += q;
      if (!w || !isGlassVol(w.volume)) bottles[y][mo] += q;
      if (y === currentYear) revByWineYear[m.wine_id] = (revByWineYear[m.wine_id] ?? 0) + r;
    }

    // referência do período
    let refYear = currentYear;
    let refMonth = -1;
    const yearMode = period?.mode === "year";
    if (period && !yearMode) {
      refYear = period.year;
      refMonth = period.month;
    } else if (!period) {
      for (let i = Math.min(currentMonth, 11); i >= 0; i--) {
        if (rev[currentYear][i] > 0) {
          refMonth = i;
          break;
        }
      }
      if (refMonth < 0) {
        for (let i = 11; i >= 0; i--) {
          if (rev[previousYear][i] > 0) {
            refYear = previousYear;
            refMonth = i;
            break;
          }
        }
      }
    } else if (period) {
      refYear = period.year;
    }

    for (const m of movs) {
      if (m.movement_type !== "sale") continue;
      const d = new Date(m.occurred_at);
      if (yearMode) {
        if (d.getFullYear() !== refYear) continue;
      } else if (d.getFullYear() !== refYear || d.getMonth() !== refMonth) continue;
      const w = wineById[m.wine_id];
      const q = m.quantity ?? 0;
      const r = q * Number(m.unit_price ?? w?.sale_price ?? 0);
      revByWineMonth[m.wine_id] = (revByWineMonth[m.wine_id] ?? 0) + r;
    }

    const sumTo = (arr: number[], limit: number) => arr.slice(0, limit + 1).reduce((a, b) => a + b, 0);
    const limit = yearMode ? (refYear === currentYear ? currentMonth : 11) : refMonth;

    const revRef = yearMode
      ? sumTo(rev[refYear], limit)
      : refMonth >= 0
        ? rev[refYear][refMonth]
        : 0;
    const bottlesRef = yearMode
      ? sumTo(bottles[refYear], limit)
      : refMonth >= 0
        ? bottles[refYear][refMonth]
        : 0;
    const unitsRef = yearMode
      ? sumTo(units[refYear], limit)
      : refMonth >= 0
        ? units[refYear][refMonth]
        : 0;
    const costRef = yearMode
      ? sumTo(cost[refYear], limit)
      : refMonth >= 0
        ? cost[refYear][refMonth]
        : 0;

    const stockBottles = Object.entries(stockByWine).reduce((acc, [id, q]) => {
      const w = wineById[id];
      if (w && isGlassVol(w.volume)) return acc;
      return acc + Math.max(q, 0);
    }, 0);
    const stockValue = Object.entries(stockByWine).reduce((acc, [id, q]) => {
      const w = wineById[id];
      if (!w || isGlassVol(w.volume)) return acc;
      return acc + Math.max(q, 0) * (Number(w.sale_price) || 0);
    }, 0);

    return {
      rev,
      bottles,
      revRef,
      bottlesRef,
      avgRef: unitsRef > 0 ? revRef / unitsRef : 0,
      cmvRef: revRef > 0 ? (costRef / revRef) * 100 : 0,
      stockByWine,
      stockBottles,
      stockValue,
      refYear,
      refMonth,
      yearMode,
      revByWineMonth,
      revByWineYear,
    };
  }, [movs, wineById, currentYear, previousYear, currentMonth, period]);

  if (loading || isLoading) return <div className="p-10 text-muted-foreground">Carregando...</div>;

  const refLabel = agg.yearMode
    ? agg.refYear === currentYear
      ? `Acum. ${agg.refYear}`
      : `Ano ${agg.refYear}`
    : monthLabel(agg.refYear, agg.refMonth);

  const TABS: Array<{ key: TabKey; label: string; primary: string; sub: string; info: string }> = [
    {
      key: "faturamento",
      label: "Faturamento",
      primary: `R$ ${fmtBRL(agg.revRef)}`,
      sub: refLabel,
      info: "Receita gerada pelos seus rótulos no restaurante selecionado.",
    },
    {
      key: "garrafas",
      label: "Garrafas Vendidas",
      primary: `${agg.bottlesRef}`,
      sub: refLabel,
      info: "Garrafas dos seus rótulos vendidas no período.",
    },
    {
      key: "estoque",
      label: "Estoque Gfas",
      primary: `${agg.stockBottles}`,
      sub: `R$ ${fmtBRL(agg.stockValue)}`,
      info: "Garrafas dos seus rótulos em estoque, conforme entradas e vendas registradas.",
    },
    {
      key: "preco",
      label: "Preço Médio",
      primary: `R$ ${fmtBRL(agg.avgRef)}`,
      sub: refLabel,
      info: "Receita ÷ unidades vendidas dos seus rótulos no período.",
    },
    {
      key: "cmv",
      label: "CMV",
      primary: `${agg.cmvRef.toFixed(1)}%`,
      sub: refLabel,
      info: "Custo das mercadorias vendidas ÷ receita dos seus rótulos no período.",
    },
  ];

  const pieRows = Object.entries(agg.revByWineMonth)
    .map(([id, rev]) => ({ id, name: wineById[id]?.name ?? "—", rev }))
    .sort((a, b) => b.rev - a.rev);
  const pieTop = pieRows.slice(0, 5);
  const pieOthers = pieRows.slice(5).reduce((a, r) => a + r.rev, 0);
  const pieTotal = pieRows.reduce((a, r) => a + r.rev, 0);
  const slices = [
    ...pieTop.map((r, i) => ({ label: r.name, value: r.rev, color: TOP_COLORS[i % TOP_COLORS.length] })),
    ...(pieOthers > 0 ? [{ label: "Outros", value: pieOthers, color: "#2a2a2a" }] : []),
  ];

  return (
    <div className="p-3 md:p-10 space-y-3 md:space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="page-title">Painel do Fornecedor</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Desempenho dos seus rótulos no restaurante selecionado.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {restaurants.length > 1 && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
              <Store size={14} className="text-primary" />
              <select
                value={restaurantId ?? ""}
                onChange={(e) => setRestaurantId(e.target.value)}
                className="bg-transparent text-[11px] font-semibold uppercase tracking-wider text-primary focus:outline-none"
              >
                {restaurants.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="relative">
            <button
              onClick={() => setPeriodOpen((v) => !v)}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-[11px] font-semibold uppercase tracking-wider transition ${
                period
                  ? "border-primary bg-[color:var(--wine)]/20 text-primary"
                  : "border-border bg-card text-primary hover:border-primary"
              }`}
            >
              <CalendarRange size={14} />
              {period
                ? period.mode === "year"
                  ? period.year === currentYear
                    ? `Acum. ${period.year}`
                    : `Ano ${period.year}`
                  : monthLabel(period.year, period.month)
                : "Mês"}
            </button>
            {periodOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setPeriodOpen(false)} />
                <div className="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-border bg-card p-3 shadow-xl">
                  <button
                    onClick={() => {
                      setPeriod(null);
                      setPeriodOpen(false);
                    }}
                    className={`mb-2 w-full rounded-md border px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${
                      !period ? "border-primary text-primary" : "border-border text-muted-foreground"
                    }`}
                  >
                    Último mês com dados
                  </button>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Visão ano
                  </div>
                  <div className="mb-3 grid grid-cols-2 gap-1">
                    {[currentYear, previousYear].map((y) => (
                      <button
                        key={`y-${y}`}
                        onClick={() => {
                          setPeriod({ year: y, month: -1, mode: "year" });
                          setPeriodOpen(false);
                        }}
                        className={`rounded-md border px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${
                          period?.mode === "year" && period.year === y
                            ? "border-primary bg-[color:var(--wine)]/25 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/60"
                        }`}
                      >
                        {y === currentYear ? `Acum. ${y}` : `Ano ${y}`}
                      </button>
                    ))}
                  </div>
                  {[currentYear, previousYear].map((y) => (
                    <div key={y} className="mb-2">
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {y}
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {MONTHS.map((m, i) => {
                          const disabled = y === currentYear && i > currentMonth;
                          const active = !period?.mode && period?.year === y && period?.month === i;
                          return (
                            <button
                              key={`${y}-${m}`}
                              disabled={disabled}
                              onClick={() => {
                                setPeriod({ year: y, month: i });
                                setPeriodOpen(false);
                              }}
                              className={`rounded-md border px-1 py-1 text-[10px] font-semibold uppercase transition ${
                                active
                                  ? "border-primary bg-[color:var(--wine)]/25 text-primary"
                                  : "border-border text-muted-foreground hover:border-primary/60"
                              } disabled:cursor-not-allowed disabled:opacity-30`}
                            >
                              {m}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 md:gap-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative rounded-xl border p-3 text-left transition ${
              tab === t.key
                ? "border-primary bg-[color:var(--wine)]/20 shadow-[0_0_0_1px_var(--gold)]"
                : "border-border bg-card hover:border-primary/60"
            }`}
          >
            <span
              className="absolute right-1.5 top-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/70"
              title={t.info}
              aria-label={t.info}
              onClick={(e) => e.stopPropagation()}
            >
              <Info size={11} />
            </span>
            <div className="mb-1 pr-5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t.label}
            </div>
            <div className="text-lg font-bold leading-tight text-primary">{t.primary}</div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">{t.sub}</div>
          </button>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="section-box">
          <div className="section-title flex items-center gap-2">
            <TrendingUp size={14} />
            <span>
              {tab === "garrafas" ? "Garrafas vendidas — mensal" : "Faturamento — mensal"}
            </span>
          </div>
          <BarChart
            curr={tab === "garrafas" ? agg.bottles[currentYear] : agg.rev[currentYear]}
            prev={tab === "garrafas" ? agg.bottles[previousYear] : agg.rev[previousYear]}
            currentYear={currentYear}
            previousYear={previousYear}
            valuePrefix={tab === "garrafas" ? "" : "R$ "}
            height={280}
          />
        </div>

        <div className="section-box">
          <div className="section-title">Participação dos seus rótulos</div>
          <div className="mb-3 text-[10px] text-muted-foreground">Referência: {refLabel}</div>
          <div className="flex justify-center">
            <PieSvg slices={slices} />
          </div>
          <div className="mt-4 space-y-1.5">
            {slices.length === 0 && (
              <div className="text-[11px] text-muted-foreground">Sem vendas no período.</div>
            )}
            {slices.map((s, i) => (
              <div key={`${s.label}-${i}`} className="flex items-center gap-2 text-[11px]">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                <span className="shrink-0 font-semibold text-primary">
                  {pieTotal > 0 ? ((s.value / pieTotal) * 100).toFixed(1) : "0.0"}%
                </span>
                <span className="w-20 shrink-0 text-right text-muted-foreground">
                  R$ {fmtBRL(s.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {wines.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Ainda não há restaurantes compartilhando dados dos seus rótulos.
        </div>
      )}

      {supplierId && (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-semibold">Meus materiais</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Publique listas de preços, apresentações e fichas técnicas.
          </p>
          <MaterialsManager
            supplierId={supplierId}
            materials={(data?.materials ?? []) as Parameters<typeof MaterialsManager>[0]["materials"]}
            onChange={() => refetch()}
            canEdit
          />
        </section>
      )}
    </div>
  );
}
