import { createFileRoute, Link } from "@tanstack/react-router";
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
  Info,
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

  type CorkageRow = { reference_year: number; reference_month: number; quantity: number; total_amount: number };
  const { data: corkage = [] } = useQuery<CorkageRow[]>({
    queryKey: ["dash-corkage", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("corkage_fees")
        .select("reference_year, reference_month, quantity, total_amount")
        .eq("restaurant_id", restaurantId!)
        .in("reference_year", [currentYear, previousYear]);
      return (data ?? []) as CorkageRow[];
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
    // Per-month cost and revenue (wine sales only) for CMV/avg-price by month
    const revWineByYearMonth: Record<number, number[]> = {
      [currentYear]: Array(12).fill(0),
      [previousYear]: Array(12).fill(0),
    };
    const costWineByYearMonth: Record<number, number[]> = {
      [currentYear]: Array(12).fill(0),
      [previousYear]: Array(12).fill(0),
    };
    const revBottlesByYearMonth: Record<number, number[]> = {
      [currentYear]: Array(12).fill(0),
      [previousYear]: Array(12).fill(0),
    };
    const revGlassesByYearMonth: Record<number, number[]> = {
      [currentYear]: Array(12).fill(0),
      [previousYear]: Array(12).fill(0),
    };
    // Corkage per year/month
    const corkageAmtByYearMonth: Record<number, number[]> = {
      [currentYear]: Array(12).fill(0),
      [previousYear]: Array(12).fill(0),
    };
    const corkageQtyByYearMonth: Record<number, number[]> = {
      [currentYear]: Array(12).fill(0),
      [previousYear]: Array(12).fill(0),
    };
    for (const c of corkage) {
      if (c.reference_year !== currentYear && c.reference_year !== previousYear) continue;
      const mo = (c.reference_month || 1) - 1;
      corkageAmtByYearMonth[c.reference_year][mo] += Number(c.total_amount || 0);
      corkageQtyByYearMonth[c.reference_year][mo] += Number(c.quantity || 0);
    }

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
      revWineByYearMonth[y][mo] += rev;
      costWineByYearMonth[y][mo] += cost * q;
      if (w && isGlassVol(w.volume)) {
        glassesByYearMonth[y][mo] += q;
        revGlassesByYearMonth[y][mo] += rev;
      } else {
        bottlesByYearMonth[y][mo] += q;
        revBottlesByYearMonth[y][mo] += rev;
      }
    }

    // Add corkage into total revenue buckets (integrated into monthly revenue)
    for (const y of [currentYear, previousYear]) {
      for (let mo = 0; mo < 12; mo++) {
        revByYearMonth[y][mo] += corkageAmtByYearMonth[y][mo];
      }
    }
    revYear = revByYearMonth[currentYear].reduce((a, b) => a + b, 0);

    // CMV by month (based on wine sales only, since corkage has no cost)
    const cmvByMonth: number[] = Array(12).fill(0);
    for (let i = 0; i < 12; i++) {
      const r = revWineByYearMonth[currentYear][i];
      const c = costWineByYearMonth[currentYear][i];
      cmvByMonth[i] = r > 0 ? (c / r) * 100 : 0;
    }
    const costYearTotal = costWineByYearMonth[currentYear].reduce((a, b) => a + b, 0);
    const revYearWineTotal = revWineByYearMonth[currentYear].reduce((a, b) => a + b, 0);
    const cmvYear = revYearWineTotal > 0 ? (costYearTotal / revYearWineTotal) * 100 : 0;

    // stock
    let stockBottles = 0;
    let stockValue = 0;
    for (const w of wines) {
      if (isGlassVol(w.volume)) continue;
      const q = stockMap[w.id] ?? 0;
      stockBottles += q;
      stockValue += q * (Number(w.sale_price) || 0);
    }

    // Preço médio por mês
    const avgAllByMonth: number[] = Array(12).fill(0);
    const avgBottleByMonth: number[] = Array(12).fill(0);
    const avgGlassByMonth: number[] = Array(12).fill(0);
    for (let i = 0; i < 12; i++) {
      const b = bottlesByYearMonth[currentYear][i];
      const g = glassesByYearMonth[currentYear][i];
      const rb = revBottlesByYearMonth[currentYear][i];
      const rg = revGlassesByYearMonth[currentYear][i];
      avgBottleByMonth[i] = b > 0 ? rb / b : 0;
      avgGlassByMonth[i] = g > 0 ? rg / g : 0;
      avgAllByMonth[i] = b + g > 0 ? (rb + rg) / (b + g) : 0;
    }

    // Preço médio anual
    const bottlesYearTotal = bottlesByYearMonth[currentYear].reduce((a, b) => a + b, 0);
    const glassesYearTotal = glassesByYearMonth[currentYear].reduce((a, b) => a + b, 0);
    const revBottlesYear = revBottlesByYearMonth[currentYear].reduce((a, b) => a + b, 0);
    const revGlassesYear = revGlassesByYearMonth[currentYear].reduce((a, b) => a + b, 0);
    const avgBottle = bottlesYearTotal ? revBottlesYear / bottlesYearTotal : 0;
    const avgGlass = glassesYearTotal ? revGlassesYear / glassesYearTotal : 0;
    const avgAll =
      bottlesYearTotal + glassesYearTotal
        ? (revBottlesYear + revGlassesYear) / (bottlesYearTotal + glassesYearTotal)
        : 0;

    const lastRev = findLastMonthWithData(revByYearMonth, currentYear, previousYear, currentMonth);
    const lastBottles = findLastMonthWithData(bottlesByYearMonth, currentYear, previousYear, currentMonth);
    const lastGlasses = findLastMonthWithData(glassesByYearMonth, currentYear, previousYear, currentMonth);
    const lastCmv = findLastMonthWithData(
      { [currentYear]: cmvByMonth, [previousYear]: Array(12).fill(0) },
      currentYear,
      previousYear,
      currentMonth,
    );
    const lastAvg = findLastMonthWithData(
      { [currentYear]: avgAllByMonth, [previousYear]: Array(12).fill(0) },
      currentYear,
      previousYear,
      currentMonth,
    );
    const lastCorkage = findLastMonthWithData(corkageAmtByYearMonth, currentYear, previousYear, currentMonth);

    const revLast = lastRev.month >= 0 ? revByYearMonth[lastRev.year][lastRev.month] : 0;
    const bottlesLast = lastBottles.month >= 0 ? bottlesByYearMonth[lastBottles.year][lastBottles.month] : 0;
    const glassesLast = lastGlasses.month >= 0 ? glassesByYearMonth[lastGlasses.year][lastGlasses.month] : 0;
    const cmvLast = lastCmv.month >= 0 ? cmvByMonth[lastCmv.month] : 0;
    const avgLast = lastAvg.month >= 0 ? avgAllByMonth[lastAvg.month] : 0;
    const avgBottleLast = lastAvg.month >= 0 ? avgBottleByMonth[lastAvg.month] : 0;
    const avgGlassLast = lastAvg.month >= 0 ? avgGlassByMonth[lastAvg.month] : 0;
    const corkageAmtLast = lastCorkage.month >= 0 ? corkageAmtByYearMonth[lastCorkage.year][lastCorkage.month] : 0;
    const corkageQtyLast = lastCorkage.month >= 0 ? corkageQtyByYearMonth[lastCorkage.year][lastCorkage.month] : 0;
    const corkageAmtYear = corkageAmtByYearMonth[currentYear].reduce((a, b) => a + b, 0);
    const corkageQtyYear = corkageQtyByYearMonth[currentYear].reduce((a, b) => a + b, 0);

    return {
      revByYearMonth,
      bottlesByYearMonth,
      glassesByYearMonth,
      corkageAmtByYearMonth,
      revYear,
      cmvByMonth,
      cmvYear,
      stockBottles,
      stockValue,
      bottlesYear: bottlesYearTotal,
      glassesYear: glassesYearTotal,
      avgBottle,
      avgGlass,
      avgAll,
      lastRev,
      lastBottles,
      lastGlasses,
      lastCmv,
      lastAvg,
      lastCorkage,
      revLast,
      bottlesLast,
      glassesLast,
      cmvLast,
      avgLast,
      avgBottleLast,
      avgGlassLast,
      corkageAmtLast,
      corkageQtyLast,
      corkageAmtYear,
      corkageQtyYear,
    };
  }, [movements, corkage, wineById, wines, stockMap, currentYear, previousYear, currentMonth]);


  const TABS: Array<{
    key: TabKey;
    label: string;
    icon: React.ReactNode;
    primary: string;
    sub: string;
    info: string;
  }> = [
    {
      key: "faturamento",
      label: "Faturamento",
      icon: <DollarSign size={14} />,
      primary: `R$ ${fmtBRL(agg.revLast)}`,
      sub: monthLabel(agg.lastRev.year, agg.lastRev.month),
      info: "Receita total do último mês com dados (vendas de vinhos + taxas de rolha). Abaixo, o gráfico compara mês a mês o ano atual com o anterior.",
    },
    {
      key: "garrafas",
      label: "Garrafas Vendidas",
      icon: <Wine size={14} />,
      primary: `${agg.bottlesLast}`,
      sub: monthLabel(agg.lastBottles.year, agg.lastBottles.month),
      info: "Quantidade de garrafas vendidas no último mês com dados. O painel abre o comparativo mensal com o ano anterior.",
    },
    {
      key: "tacas",
      label: "Taças Vendidas",
      icon: <GlassWater size={14} />,
      primary: `${agg.glassesLast}`,
      sub: monthLabel(agg.lastGlasses.year, agg.lastGlasses.month),
      info: "Quantidade de taças de vinho vendidas no último mês com dados, comparadas mês a mês com o ano anterior.",
    },
    {
      key: "estoque",
      label: "Estoque Gfas",
      icon: <Package size={14} />,
      primary: `${agg.stockBottles}`,
      sub: `R$ ${fmtBRL(agg.stockValue)}`,
      info: "Total de garrafas em adega e o valor correspondente (preço de venda) segundo a última contagem fechada.",
    },
    {
      key: "preco",
      label: "Preço Médio",
      icon: <Tag size={14} />,
      primary: `R$ ${fmtBRL(agg.avgLast)}`,
      sub: monthLabel(agg.lastAvg.year, agg.lastAvg.month),
      info: "Preço médio praticado no último mês com dados (receita ÷ unidades vendidas, considerando garrafas e taças).",
    },
    {
      key: "cmv",
      label: "CMV",
      icon: <Percent size={14} />,
      primary: `${agg.cmvLast.toFixed(1)}%`,
      sub: monthLabel(agg.lastCmv.year, agg.lastCmv.month),
      info: "Custo da mercadoria vendida no último mês com dados: custo total ÷ receita das vendas de vinhos. Meta usual: ≤ 33%.",
    },
    {
      key: "rolha",
      label: "Taxa de Rolha",
      icon: <Coins size={14} />,
      primary: `R$ ${fmtBRL(agg.corkageAmtLast)}`,
      sub: monthLabel(agg.lastCorkage.year, agg.lastCorkage.month),
      info: "Valor arrecadado com taxas de rolha no último mês lançado. Lance mensalmente em 'Taxa de rolha'; o valor entra no faturamento.",
    },
    {
      key: "outras",
      label: "Outras",
      icon: <Sparkles size={14} />,
      primary: `+`,
      sub: `Personalizar`,
      info: "Espaço para indicadores personalizados do restaurante (em breve).",
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
            className={`relative rounded-xl border p-3 text-left transition ${
              tab === t.key
                ? "border-primary bg-[color:var(--wine)]/20 shadow-[0_0_0_1px_var(--gold)]"
                : "border-border bg-card hover:border-primary/60"
            }`}
          >
            <span
              className="absolute right-1.5 top-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/70 hover:text-primary"
              title={t.info}
              aria-label={t.info}
              onClick={(e) => e.stopPropagation()}
            >
              <Info size={11} />
            </span>
            <div className="mb-1 flex items-center justify-between pr-5">
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
            revLast={agg.revLast}
            lastMonth={agg.lastRev}
            revYear={agg.revYear}
            corkageAmtYear={agg.corkageAmtYear}
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
          <PrecoPanel
            avgAll={agg.avgLast}
            avgBottle={agg.avgBottleLast}
            avgGlass={agg.avgGlassLast}
            avgAllYear={agg.avgAll}
            avgBottleYear={agg.avgBottle}
            avgGlassYear={agg.avgGlass}
            lastMonth={agg.lastAvg}
          />
        )}
        {tab === "cmv" && (
          <CmvPanel
            cmvMonth={agg.cmvLast}
            cmvYear={agg.cmvYear}
            lastMonth={agg.lastCmv}
            wines={wines}
          />
        )}
        {tab === "rolha" && (
          <RolhaPanel
            amtLast={agg.corkageAmtLast}
            qtyLast={agg.corkageQtyLast}
            amtYear={agg.corkageAmtYear}
            qtyYear={agg.corkageQtyYear}
            lastMonth={agg.lastCorkage}
          />
        )}
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
  revLast,
  lastMonth,
  revYear,
  corkageAmtYear,
  currentMonth,
}: {
  revByYearMonth: Record<number, number[]>;
  currentYear: number;
  previousYear: number;
  revLast: number;
  lastMonth: { year: number; month: number };
  revYear: number;
  corkageAmtYear: number;
  currentMonth: number;
}) {
  const curr = revByYearMonth[currentYear];
  const prev = revByYearMonth[previousYear];

  const prevYearTotal = prev.reduce((a, b) => a + b, 0);
  const currAcc = curr.slice(0, currentMonth + 1).reduce((a, b) => a + b, 0);
  const prevAcc = prev.slice(0, currentMonth + 1).reduce((a, b) => a + b, 0);
  const diff = prevAcc > 0 ? ((currAcc - prevAcc) / prevAcc) * 100 : 0;

  return (
    <div>
      <SectionHeader
        icon={<TrendingUp size={14} />}
        title="Faturamento — mensal e acumulado"
        subtitle="Vendas de vinhos + taxas de rolha. Ano anterior em cinza, ano corrente em vinho→ouro."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat
          label={`Último mês (${monthLabel(lastMonth.year, lastMonth.month)})`}
          value={`R$ ${fmtBRL(revLast)}`}
          tone="primary"
        />
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

      <p className="mt-3 text-[11px] text-muted-foreground">
        Inclui R$ {fmtBRL(corkageAmtYear)} de taxa de rolha no ano corrente.
      </p>
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

function PrecoPanel({
  avgAll,
  avgBottle,
  avgGlass,
  avgAllYear,
  avgBottleYear,
  avgGlassYear,
  lastMonth,
}: {
  avgAll: number;
  avgBottle: number;
  avgGlass: number;
  avgAllYear: number;
  avgBottleYear: number;
  avgGlassYear: number;
  lastMonth: { year: number; month: number };
}) {
  const ml = monthLabel(lastMonth.year, lastMonth.month);
  return (
    <div>
      <SectionHeader
        icon={<Tag size={14} />}
        title="Preço médio praticado"
        subtitle={`Referência: último mês com dados (${ml}). Ao lado, média do ano corrente.`}
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MiniStat label={`Geral — ${ml}`} value={`R$ ${fmtBRL(avgAll)}`} tone="primary" />
        <MiniStat label={`Garrafa — ${ml}`} value={`R$ ${fmtBRL(avgBottle)}`} />
        <MiniStat label={`Taça — ${ml}`} value={`R$ ${fmtBRL(avgGlass)}`} />
        <MiniStat label="Geral (ano)" value={`R$ ${fmtBRL(avgAllYear)}`} />
        <MiniStat label="Garrafa (ano)" value={`R$ ${fmtBRL(avgBottleYear)}`} />
        <MiniStat label="Taça (ano)" value={`R$ ${fmtBRL(avgGlassYear)}`} />
      </div>
    </div>
  );
}

function CmvPanel({
  cmvMonth,
  cmvYear,
  lastMonth,
  wines,
}: {
  cmvMonth: number;
  cmvYear: number;
  lastMonth: { year: number; month: number };
  wines: WineRow[];
}) {
  const ml = monthLabel(lastMonth.year, lastMonth.month);
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
      <SectionHeader icon={<Percent size={14} />} title="CMV do restaurante" subtitle="Custo da mercadoria vendida (custo / preço de venda das vendas de vinhos)." />
      <div className="mb-5 grid grid-cols-2 gap-3">
        <MiniStat
          label={`CMV — ${ml}`}
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

function RolhaPanel({
  amtLast,
  qtyLast,
  amtYear,
  qtyYear,
  lastMonth,
}: {
  amtLast: number;
  qtyLast: number;
  amtYear: number;
  qtyYear: number;
  lastMonth: { year: number; month: number };
}) {
  const ml = monthLabel(lastMonth.year, lastMonth.month);
  return (
    <div>
      <SectionHeader
        icon={<Coins size={14} />}
        title="Taxa de rolha"
        subtitle="Cobranças por trazer o próprio vinho. Valor integra o faturamento mensal."
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label={`Valor — ${ml}`} value={`R$ ${fmtBRL(amtLast)}`} tone="primary" />
        <MiniStat label={`Qtd — ${ml}`} value={`${qtyLast}`} />
        <MiniStat label="Valor ano" value={`R$ ${fmtBRL(amtYear)}`} />
        <MiniStat label="Qtd ano" value={`${qtyYear}`} />
      </div>
      <div className="rounded-lg border border-dashed border-border bg-[color:var(--surface-2)] p-4 text-center text-xs text-muted-foreground">
        Para lançar ou ajustar taxas de rolha,{" "}
        <Link to="/app/corkage-fees" className="text-primary underline">
          abra o lançamento mensal
        </Link>
        .
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
