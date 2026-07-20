import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  DollarSign,
  Wine,
  GlassWater,
  Package,
  Tag,
  Percent,
  Coins,
  Sparkles,
  TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/_app/app/dashboard")({
  component: DashboardPage,
});

type WineRow = {
  id: string;
  name: string;
  wine_type: string | null;
  volume: string | null;
  cost_price: number | null;
  sale_price: number | null;
  active_on_menu: boolean | null;
};

type Movement = {
  wine_id: string;
  quantity: number;
  unit_price: number | null;
  unit_cost: number | null;
  occurred_at: string;
};

const isGlassVol = (v: string | null | undefined) =>
  !!v && /taça|taca|glass/i.test(v);

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function fmtBRL(n: number, digits = 0) {
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function monthLabel(year: number, monthIdx: number) {
  if (monthIdx < 0) return "—";
  return `${MONTHS[monthIdx]}/${String(year).slice(-2)}`;
}

function findLastMonthWithData(
  byYearMonth: Record<number, number[]>,
  currentYear: number,
  previousYear: number,
  currentMonth: number,
): { year: number; month: number } {
  const curr = byYearMonth[currentYear] || [];
  for (let i = Math.min(currentMonth, 11); i >= 0; i--) {
    if ((curr[i] ?? 0) > 0) return { year: currentYear, month: i };
  }
  const prev = byYearMonth[previousYear] || [];
  for (let i = 11; i >= 0; i--) {
    if ((prev[i] ?? 0) > 0) return { year: previousYear, month: i };
  }
  return { year: currentYear, month: -1 };
}

type TabKey =
  | "faturamento"
  | "garrafas"
  | "tacas"
  | "estoque"
  | "preco"
  | "cmv"
  | "rolha"
  | "outras";

function DashboardPage() {
  const { restaurantId } = useAuth();
  const [tab, setTab] = useState<TabKey>("faturamento");

  const now = new Date();
  const currentYear = now.getFullYear();
  const previousYear = currentYear - 1;
  const currentMonth = now.getMonth();

  const { data: wines = [] } = useQuery({
    queryKey: ["dash-wines", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("wines")
        .select("id,name,wine_type,volume,cost_price,sale_price,active_on_menu")
        .eq("restaurant_id", restaurantId!);
      return (data ?? []) as WineRow[];
    },
  });

  const { data: stockMap = {} } = useQuery<Record<string, number>>({
    queryKey: ["dash-stock", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data: sess } = await supabase
        .from("stock_count_sessions")
        .select("id")
        .eq("restaurant_id", restaurantId!)
        .eq("status", "closed")
        .order("reference_date", { ascending: false })
        .limit(1);
      const session = sess?.[0];
      const map: Record<string, number> = {};
      if (!session) return map;
      const { data: items } = await supabase
        .from("stock_count_items")
        .select("wine_id, counted_qty")
        .eq("session_id", session.id);
      for (const it of items ?? []) map[it.wine_id] = it.counted_qty ?? 0;
      return map;
    },
  });

  const { data: movements = [] } = useQuery<Movement[]>({
    queryKey: ["dash-movements", restaurantId, currentYear],
    enabled: !!restaurantId,
    queryFn: async () => {
      const start = new Date(previousYear, 0, 1).toISOString();
      const { data } = await supabase
        .from("inventory_movements")
        .select("wine_id, quantity, unit_price, unit_cost, occurred_at")
        .eq("restaurant_id", restaurantId!)
        .eq("movement_type", "sale")
        .gte("occurred_at", start);
      return (data ?? []) as Movement[];
    },
  });

  const wineById = useMemo(() => {
    const m: Record<string, WineRow> = {};
    for (const w of wines) m[w.id] = w;
    return m;
  }, [wines]);

  // Aggregations
  const agg = useMemo(() => {
    // per-year totals + monthly buckets
    const revByYearMonth: Record<number, number[]> = {
      [currentYear]: Array(12).fill(0),
      [previousYear]: Array(12).fill(0),
    };
    const bottlesByYearMonth: Record<number, number[]> = {
      [currentYear]: Array(12).fill(0),
      [previousYear]: Array(12).fill(0),
    };
    const glassesByYearMonth: Record<number, number[]> = {
      [currentYear]: Array(12).fill(0),
      [previousYear]: Array(12).fill(0),
    };
    let costCurrentMonth = 0;
    let revCurrentMonth = 0;
    let costYear = 0;
    let revYear = 0;

    for (const m of movements) {
      const d = new Date(m.occurred_at);
      const y = d.getFullYear();
      const mo = d.getMonth();
      if (y !== currentYear && y !== previousYear) continue;
      const w = wineById[m.wine_id];
      const price = Number(m.unit_price ?? w?.sale_price ?? 0);
      const cost = Number(m.unit_cost ?? w?.cost_price ?? 0);
      const q = m.quantity ?? 0;
      const rev = price * q;
      revByYearMonth[y][mo] += rev;
      if (w && isGlassVol(w.volume)) glassesByYearMonth[y][mo] += q;
      else bottlesByYearMonth[y][mo] += q;

      if (y === currentYear) {
        revYear += rev;
        costYear += cost * q;
        if (mo === currentMonth) {
          revCurrentMonth += rev;
          costCurrentMonth += cost * q;
        }
      }
    }

    const cmvMonth = revCurrentMonth > 0 ? (costCurrentMonth / revCurrentMonth) * 100 : 0;
    const cmvYear = revYear > 0 ? (costYear / revYear) * 100 : 0;

    // stock
    let stockBottles = 0;
    let stockValue = 0;
    for (const w of wines) {
      if (isGlassVol(w.volume)) continue;
      const q = stockMap[w.id] ?? 0;
      stockBottles += q;
      stockValue += q * (Number(w.sale_price) || 0);
    }

    // Preço médio (based on current-year sales)
    const bottlesYearTotal = bottlesByYearMonth[currentYear].reduce((a, b) => a + b, 0);
    const glassesYearTotal = glassesByYearMonth[currentYear].reduce((a, b) => a + b, 0);
    let revBottles = 0;
    let revGlasses = 0;
    for (const m of movements) {
      const d = new Date(m.occurred_at);
      if (d.getFullYear() !== currentYear) continue;
      const w = wineById[m.wine_id];
      const price = Number(m.unit_price ?? w?.sale_price ?? 0);
      const q = m.quantity ?? 0;
      if (w && isGlassVol(w.volume)) revGlasses += price * q;
      else revBottles += price * q;
    }
    const avgBottle = bottlesYearTotal ? revBottles / bottlesYearTotal : 0;
    const avgGlass = glassesYearTotal ? revGlasses / glassesYearTotal : 0;
    const avgAll =
      bottlesYearTotal + glassesYearTotal
        ? (revBottles + revGlasses) / (bottlesYearTotal + glassesYearTotal)
        : 0;

    const lastRev = findLastMonthWithData(revByYearMonth, currentYear, previousYear, currentMonth);
    const lastBottles = findLastMonthWithData(bottlesByYearMonth, currentYear, previousYear, currentMonth);
    const lastGlasses = findLastMonthWithData(glassesByYearMonth, currentYear, previousYear, currentMonth);

    const revLast = lastRev.month >= 0 ? revByYearMonth[lastRev.year][lastRev.month] : 0;
    const bottlesLast = lastBottles.month >= 0 ? bottlesByYearMonth[lastBottles.year][lastBottles.month] : 0;
    const glassesLast = lastGlasses.month >= 0 ? glassesByYearMonth[lastGlasses.year][lastGlasses.month] : 0;

    return {
      revByYearMonth,
      bottlesByYearMonth,
      glassesByYearMonth,
      revCurrentMonth,
      revYear,
      cmvMonth,
      cmvYear,
      stockBottles,
      stockValue,
      bottlesMonth: bottlesByYearMonth[currentYear][currentMonth],
      bottlesYear: bottlesYearTotal,
      glassesMonth: glassesByYearMonth[currentYear][currentMonth],
      glassesYear: glassesYearTotal,
      avgBottle,
      avgGlass,
      avgAll,
      lastRev,
      lastBottles,
      lastGlasses,
      revLast,
      bottlesLast,
      glassesLast,
    };
  }, [movements, wineById, wines, stockMap, currentYear, previousYear, currentMonth]);

  const TABS: Array<{
    key: TabKey;
    label: string;
    icon: React.ReactNode;
    primary: string;
    sub: string;
  }> = [
    {
      key: "faturamento",
      label: "Faturamento",
      icon: <DollarSign size={14} />,
      primary: `R$ ${fmtBRL(agg.revLast)}`,
      sub: monthLabel(agg.lastRev.year, agg.lastRev.month),
    },
    {
      key: "garrafas",
      label: "Garrafas",
      icon: <Wine size={14} />,
      primary: `${agg.bottlesLast}`,
      sub: monthLabel(agg.lastBottles.year, agg.lastBottles.month),
    },
    {
      key: "tacas",
      label: "Taças",
      icon: <GlassWater size={14} />,
      primary: `${agg.glassesLast}`,
      sub: monthLabel(agg.lastGlasses.year, agg.lastGlasses.month),
    },
    {
      key: "estoque",
      label: "Estoque",
      icon: <Package size={14} />,
      primary: `${agg.stockBottles} gfa`,
      sub: `R$ ${fmtBRL(agg.stockValue)}`,
    },
    {
      key: "preco",
      label: "Preço Médio",
      icon: <Tag size={14} />,
      primary: `R$ ${fmtBRL(agg.avgAll)}`,
      sub: `Geral (ano)`,
    },
    {
      key: "cmv",
      label: "CMV",
      icon: <Percent size={14} />,
      primary: `${agg.cmvMonth.toFixed(1)}%`,
      sub: `Ano: ${agg.cmvYear.toFixed(1)}%`,
    },
    {
      key: "rolha",
      label: "Taxa de Rolha",
      icon: <Coins size={14} />,
      primary: `0`,
      sub: `Em breve`,
    },
    {
      key: "outras",
      label: "Outras",
      icon: <Sparkles size={14} />,
      primary: `+`,
      sub: `Personalizar`,
    },
  ];

  return (
    <div className="p-6 md:p-10 space-y-6">
      <header className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="page-title">Painel de Controle</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Indicadores da adega em tempo real — clique nos botões para ver detalhes.
          </p>
        </div>
      </header>

      {/* KPI buttons row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-xl border p-3 text-left transition ${
              tab === t.key
                ? "border-primary bg-[color:var(--wine)]/20 shadow-[0_0_0_1px_var(--gold)]"
                : "border-border bg-card hover:border-primary/60"
            }`}
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t.label}
              </span>
              <div
                className={`rounded p-1 ${
                  tab === t.key
                    ? "bg-primary/20 text-primary"
                    : "bg-[color:var(--surface-2)] text-muted-foreground"
                }`}
              >
                {t.icon}
              </div>
            </div>
            <div className="text-lg font-bold text-primary leading-tight">
              {t.primary}
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">{t.sub}</div>
          </button>
        ))}
      </div>

      {/* Detail panel */}
      <div className="rounded-xl border border-border bg-card p-5">
        {tab === "faturamento" && (
          <FaturamentoPanel
            revByYearMonth={agg.revByYearMonth}
            currentYear={currentYear}
            previousYear={previousYear}
            revCurrentMonth={agg.revCurrentMonth}
            revYear={agg.revYear}
            currentMonth={currentMonth}
          />
        )}
        {tab === "garrafas" && (
          <SimpleYearPanel
            title="Vendas de Garrafas"
            unit="gfa"
            byYearMonth={agg.bottlesByYearMonth}
            currentYear={currentYear}
            previousYear={previousYear}
          />
        )}
        {tab === "tacas" && (
          <SimpleYearPanel
            title="Vendas em Taças"
            unit="taça"
            byYearMonth={agg.glassesByYearMonth}
            currentYear={currentYear}
            previousYear={previousYear}
          />
        )}
        {tab === "estoque" && (
          <EstoquePanel
            wines={wines}
            stockMap={stockMap}
            totalBottles={agg.stockBottles}
            totalValue={agg.stockValue}
          />
        )}
        {tab === "preco" && (
          <PrecoPanel avgAll={agg.avgAll} avgBottle={agg.avgBottle} avgGlass={agg.avgGlass} />
        )}
        {tab === "cmv" && (
          <CmvPanel cmvMonth={agg.cmvMonth} cmvYear={agg.cmvYear} wines={wines} />
        )}
        {tab === "rolha" && <RolhaPanel />}
        {tab === "outras" && <OutrasPanel />}
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <div className="section-title flex items-center gap-2">
        {icon}
        <span>{title}</span>
      </div>
      {subtitle && <p className="-mt-2 text-[11px] text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function FaturamentoPanel({
  revByYearMonth,
  currentYear,
  previousYear,
  revCurrentMonth,
  revYear,
  currentMonth,
}: {
  revByYearMonth: Record<number, number[]>;
  currentYear: number;
  previousYear: number;
  revCurrentMonth: number;
  revYear: number;
  currentMonth: number;
}) {
  const curr = revByYearMonth[currentYear];
  const prev = revByYearMonth[previousYear];
  const maxVal = Math.max(1, ...curr, ...prev);
  const prevYearTotal = prev.reduce((a, b) => a + b, 0);
  const currAcc = curr.slice(0, currentMonth + 1).reduce((a, b) => a + b, 0);
  const prevAcc = prev.slice(0, currentMonth + 1).reduce((a, b) => a + b, 0);
  const diff = prevAcc > 0 ? ((currAcc - prevAcc) / prevAcc) * 100 : 0;

  return (
    <div>
      <SectionHeader
        icon={<TrendingUp size={14} />}
        title="Faturamento — mensal e acumulado"
        subtitle="Barras do ano anterior (cinza) e do ano corrente (vinho→ouro)."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="Mês atual" value={`R$ ${fmtBRL(revCurrentMonth)}`} tone="primary" />
        <MiniStat label={`Acumulado ${currentYear}`} value={`R$ ${fmtBRL(revYear)}`} />
        <MiniStat label={`${previousYear} completo`} value={`R$ ${fmtBRL(prevYearTotal)}`} />
        <MiniStat
          label="Δ acumulado vs ano anterior"
          value={`${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`}
          tone={diff >= 0 ? "primary" : "danger"}
        />
      </div>

      <BarChart
        curr={curr}
        prev={prev}
        currentYear={currentYear}
        previousYear={previousYear}
        valuePrefix="R$ "
        height={280}
      />


      <div className="mt-4 flex items-center justify-center gap-6 text-[11px]">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded"
            style={{ background: "color-mix(in oklab, var(--muted-foreground) 45%, transparent)" }}
          />
          <span className="text-muted-foreground">{previousYear}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded"
            style={{ background: "linear-gradient(180deg, var(--gold), var(--wine))" }}
          />
          <span className="text-muted-foreground">{currentYear}</span>
        </div>
      </div>
    </div>
  );
}

function SimpleYearPanel({
  title,
  unit,
  byYearMonth,
  currentYear,
  previousYear,
}: {
  title: string;
  unit: string;
  byYearMonth: Record<number, number[]>;
  currentYear: number;
  previousYear: number;
}) {
  const curr = byYearMonth[currentYear];
  const prev = byYearMonth[previousYear];
  const currTotal = curr.reduce((a, b) => a + b, 0);
  const prevTotal = prev.reduce((a, b) => a + b, 0);

  return (
    <div>
      <SectionHeader
        icon={<TrendingUp size={14} />}
        title={title}
        subtitle="Comparativo mensal com o ano anterior."
      />
      <div className="mb-5 grid grid-cols-2 gap-3">
        <MiniStat label={`Acumulado ${currentYear}`} value={`${currTotal} ${unit}`} tone="primary" />
        <MiniStat label={`${previousYear} completo`} value={`${prevTotal} ${unit}`} />
      </div>
      <BarChart
        curr={curr}
        prev={prev}
        currentYear={currentYear}
        previousYear={previousYear}
        valueSuffix={` ${unit}`}
        height={240}
      />
    </div>
  );
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  let m: number;
  if (n <= 1) m = 1;
  else if (n <= 2) m = 2;
  else if (n <= 2.5) m = 2.5;
  else if (n <= 5) m = 5;
  else m = 10;
  return m * pow;
}

function BarChart({
  curr,
  prev,
  currentYear,
  previousYear,
  valuePrefix = "",
  valueSuffix = "",
  height = 260,
}: {
  curr: number[];
  prev: number[];
  currentYear: number;
  previousYear: number;
  valuePrefix?: string;
  valueSuffix?: string;
  height?: number;
}) {
  const rawMax = Math.max(1, ...curr, ...prev);
  const maxVal = niceMax(rawMax);
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((f) => maxVal * f);
  const axisWidth = 68;

  return (
    <div>
      <div className="relative w-full" style={{ height }}>
        {/* Y-axis labels + horizontal gridlines */}
        <div className="absolute inset-0" style={{ paddingLeft: axisWidth, paddingBottom: 22 }}>
          <div className="relative h-full w-full">
            {ticks.map((t, i) => (
              <div
                key={i}
                className="absolute left-0 right-0 flex items-center"
                style={{ top: `${(i / (ticks.length - 1)) * 100}%`, transform: "translateY(-0.5px)" }}
              >
                <span
                  className="absolute right-full pr-2 text-[10px] text-muted-foreground whitespace-nowrap"
                  style={{ transform: "translateY(-50%)" }}
                >
                  {valuePrefix}
                  {fmtBRL(t)}
                  {valueSuffix}
                </span>
                <div
                  className="h-px w-full"
                  style={{ background: "color-mix(in oklab, var(--muted-foreground) 20%, transparent)" }}
                />
              </div>
            ))}
            {/* Vertical gridlines between months */}
            <div className="absolute inset-0 flex">
              {MONTHS.map((_, i) => (
                <div
                  key={i}
                  className="flex-1 border-l"
                  style={{ borderColor: "color-mix(in oklab, var(--muted-foreground) 12%, transparent)" }}
                />
              ))}
              <div
                className="border-l"
                style={{ borderColor: "color-mix(in oklab, var(--muted-foreground) 20%, transparent)" }}
              />
            </div>
            {/* Bars */}
            <div className="absolute inset-0 flex items-end justify-between gap-2">
              {MONTHS.map((mo, i) => {
                const cPct = (curr[i] / maxVal) * 100;
                const pPct = (prev[i] / maxVal) * 100;
                return (
                  <div key={mo} className="relative flex h-full flex-1 items-end justify-center gap-0.5">
                    <div
                      className="w-2/5 rounded-t transition-all"
                      style={{
                        height: `${pPct}%`,
                        background: "color-mix(in oklab, var(--muted-foreground) 45%, transparent)",
                      }}
                      title={`${previousYear}: ${valuePrefix}${fmtBRL(prev[i])}${valueSuffix}`}
                    />
                    <div
                      className="w-2/5 rounded-t transition-all"
                      style={{
                        height: `${cPct}%`,
                        background: "linear-gradient(180deg, var(--gold), var(--wine))",
                      }}
                      title={`${currentYear}: ${valuePrefix}${fmtBRL(curr[i])}${valueSuffix}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {/* Month labels */}
        <div
          className="absolute bottom-0 left-0 right-0 flex justify-between gap-2"
          style={{ paddingLeft: axisWidth }}
        >
          {MONTHS.map((mo) => (
            <div key={mo} className="flex-1 text-center text-[10px] text-muted-foreground">
              {mo}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-center gap-6 text-[11px]">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded"
            style={{ background: "color-mix(in oklab, var(--muted-foreground) 45%, transparent)" }}
          />
          <span className="text-muted-foreground">{previousYear}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded"
            style={{ background: "linear-gradient(180deg, var(--gold), var(--wine))" }}
          />
          <span className="text-muted-foreground">{currentYear}</span>
        </div>
      </div>
    </div>
  );
}

function EstoquePanel({
  wines,
  stockMap,
  totalBottles,
  totalValue,
}: {
  wines: WineRow[];
  stockMap: Record<string, number>;
  totalBottles: number;
  totalValue: number;
}) {
  const byType: Record<string, { bottles: number; value: number }> = {};
  let totalCost = 0;
  for (const w of wines) {
    if (isGlassVol(w.volume)) continue;
    const q = stockMap[w.id] ?? 0;
    const t = w.wine_type || "Outros";
    if (!byType[t]) byType[t] = { bottles: 0, value: 0 };
    byType[t].bottles += q;
    byType[t].value += q * (Number(w.sale_price) || 0);
    totalCost += q * (Number(w.cost_price) || 0);
  }
  const rows = Object.entries(byType).sort((a, b) => b[1].value - a[1].value);

  return (
    <div>
      <SectionHeader icon={<Package size={14} />} title="Estoque em adega" subtitle="Consolidação da última contagem fechada." />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3">
        <MiniStat label="Garrafas em estoque" value={`${totalBottles}`} tone="primary" />
        <MiniStat label="Valor de venda" value={`R$ ${fmtBRL(totalValue)}`} />
        <MiniStat label="Valor de custo" value={`R$ ${fmtBRL(totalCost)}`} />
      </div>
      <table className="w-full text-left text-xs">
        <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr className="border-b border-border">
            <th className="py-2">Categoria</th>
            <th className="py-2 text-right">Garrafas</th>
            <th className="py-2 text-right">Valor (R$)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(([t, v]) => (
            <tr key={t}>
              <td className="py-2 font-medium">{t}</td>
              <td className="py-2 text-right">{v.bottles}</td>
              <td className="py-2 text-right text-primary">R$ {fmtBRL(v.value)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className="py-6 text-center text-muted-foreground">
                Sem contagem de estoque ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function PrecoPanel({ avgAll, avgBottle, avgGlass }: { avgAll: number; avgBottle: number; avgGlass: number }) {
  return (
    <div>
      <SectionHeader icon={<Tag size={14} />} title="Preço médio praticado" subtitle="Baseado nas vendas do ano corrente." />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MiniStat label="Geral" value={`R$ ${fmtBRL(avgAll)}`} tone="primary" />
        <MiniStat label="Garrafa" value={`R$ ${fmtBRL(avgBottle)}`} />
        <MiniStat label="Taça" value={`R$ ${fmtBRL(avgGlass)}`} />
      </div>
    </div>
  );
}

function CmvPanel({ cmvMonth, cmvYear, wines }: { cmvMonth: number; cmvYear: number; wines: WineRow[] }) {
  const high = wines
    .filter((w) => {
      const c = Number(w.cost_price) || 0;
      const s = Number(w.sale_price) || 0;
      return s > 0 && (c / s) * 100 > 33;
    })
    .map((w) => {
      const c = Number(w.cost_price) || 0;
      const s = Number(w.sale_price) || 0;
      const cmv = (c / s) * 100;
      const optimal = Math.round(c / 0.3);
      return { ...w, cmv, optimal };
    })
    .sort((a, b) => b.cmv - a.cmv)
    .slice(0, 10);

  return (
    <div>
      <SectionHeader icon={<Percent size={14} />} title="CMV do restaurante" subtitle="Custo da mercadoria vendida (custo / preço de venda)." />
      <div className="mb-5 grid grid-cols-2 gap-3">
        <MiniStat
          label="CMV do mês"
          value={`${cmvMonth.toFixed(1)}%`}
          tone={cmvMonth <= 33 ? "primary" : "danger"}
        />
        <MiniStat
          label="CMV do ano"
          value={`${cmvYear.toFixed(1)}%`}
          tone={cmvYear <= 33 ? "primary" : "danger"}
        />
      </div>
      <div className="section-title">Rótulos com CMV acima de 33%</div>
      <table className="w-full text-left text-xs">
        <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr className="border-b border-border">
            <th className="py-2">Rótulo</th>
            <th className="py-2 text-center">CMV</th>
            <th className="py-2 text-right">Preço sugerido</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {high.map((w) => (
            <tr key={w.id}>
              <td className="py-2 font-medium">{w.name}</td>
              <td className="py-2 text-center">
                <span className="rounded bg-[color:var(--wine)]/25 px-1.5 py-0.5 font-bold text-[#f4a5b0]">
                  {w.cmv.toFixed(1)}%
                </span>
              </td>
              <td className="py-2 text-right font-bold text-primary">R$ {w.optimal}</td>
            </tr>
          ))}
          {high.length === 0 && (
            <tr>
              <td colSpan={3} className="py-6 text-center text-muted-foreground">
                Nenhum rótulo com CMV acima de 33%. Excelente!
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function RolhaPanel() {
  return (
    <div>
      <SectionHeader icon={<Coins size={14} />} title="Taxa de rolha" subtitle="Cobranças por trazer o próprio vinho." />
      <div className="rounded-lg border border-dashed border-border bg-[color:var(--surface-2)] p-6 text-center text-xs text-muted-foreground">
        Módulo em preparação — em breve o restaurante poderá lançar a quantidade
        de taxas de rolha aplicadas no mês e no ano, com o valor total arrecadado.
      </div>
    </div>
  );
}

function OutrasPanel() {
  return (
    <div>
      <SectionHeader icon={<Sparkles size={14} />} title="Outras informações" subtitle="Espaço para indicadores personalizados do restaurante." />
      <div className="rounded-lg border border-dashed border-border bg-[color:var(--surface-2)] p-6 text-center text-xs text-muted-foreground">
        Em breve — você poderá cadastrar aqui indicadores específicos: ticket
        médio, mesa mais vendida, evento sazonal, ranking de sommelier, etc.
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "primary" | "danger";
}) {
  return (
    <div className="rounded-lg border border-border bg-[color:var(--surface-2)] p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 text-lg font-bold ${
          tone === "danger" ? "text-[#f4a5b0]" : "text-primary"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
