import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useScopedRestaurantIds } from "@/hooks/use-scoped-restaurants";
import { setActiveGroup } from "@/lib/active-scope";
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
  Target,
  FileText,
  CalendarRange,
  Calculator,

} from "lucide-react";
import DashboardTargetsEditor, {
  targetsFor,
  useDashboardTargets,
  type IndicatorKey,
} from "@/components/DashboardTargetsEditor";
import SalesDiagnosticReport from "@/components/SalesDiagnosticReport";

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
  const { restaurantId, activeGroupId, groups, memberships } = useAuth();
  const { ids: scopeIds, isGroup } = useScopedRestaurantIds();
  const [tab, setTab] = useState<TabKey>("faturamento");
  const [metasOpen, setMetasOpen] = useState(false);
  const [diagOpen, setDiagOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [period, setPeriod] = useState<{ year: number; month: number; mode?: "year" } | null>(null);


  const now = new Date();
  const currentYear = now.getFullYear();
  const previousYear = currentYear - 1;
  const currentMonth = now.getMonth();

  // Metas continuam sendo por unidade — no modo consolidado, ocultamos edição
  const { data: targets = [] } = useDashboardTargets(restaurantId, currentYear);

  const scopeKey = scopeIds.join(",");
  const enabled = scopeIds.length > 0;

  const { data: wines = [] } = useQuery({
    queryKey: ["dash-wines", scopeKey],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("wines")
        .select("id,name,wine_type,volume,cost_price,sale_price,active_on_menu")
        .in("restaurant_id", scopeIds);
      return (data ?? []) as WineRow[];
    },
  });

  const { data: stockMap = {} } = useQuery<Record<string, number>>({
    queryKey: ["dash-stock", scopeKey],
    enabled,
    queryFn: async () => {
      // pega a última contagem fechada de cada restaurante do escopo
      const { data: sess } = await supabase
        .from("stock_count_sessions")
        .select("id, restaurant_id, reference_date")
        .in("restaurant_id", scopeIds)
        .eq("status", "closed")
        .order("reference_date", { ascending: false });
      const latestByRest = new Map<string, string>();
      for (const s of sess ?? []) {
        if (!latestByRest.has(s.restaurant_id)) latestByRest.set(s.restaurant_id, s.id);
      }
      const map: Record<string, number> = {};
      const sessionIds = Array.from(latestByRest.values());
      if (sessionIds.length === 0) return map;
      const { data: items } = await supabase
        .from("stock_count_items")
        .select("wine_id, counted_qty")
        .in("session_id", sessionIds);
      for (const it of items ?? []) {
        map[it.wine_id] = (map[it.wine_id] ?? 0) + (it.counted_qty ?? 0);
      }
      return map;
    },
  });

  const { data: movements = [] } = useQuery<Movement[]>({
    queryKey: ["dash-movements", scopeKey, currentYear],
    enabled,
    queryFn: async () => {
      const start = new Date(previousYear, 0, 1).toISOString();
      const { data } = await supabase
        .from("inventory_movements")
        .select("wine_id, quantity, unit_price, unit_cost, occurred_at")
        .in("restaurant_id", scopeIds)
        .eq("movement_type", "sale")
        .gte("occurred_at", start);
      return (data ?? []) as Movement[];
    },
  });

  type CorkageRow = { reference_year: number; reference_month: number; quantity: number; total_amount: number };
  const { data: corkage = [] } = useQuery<CorkageRow[]>({
    queryKey: ["dash-corkage", scopeKey],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("corkage_fees")
        .select("reference_year, reference_month, quantity, total_amount")
        .in("restaurant_id", scopeIds)
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
    const cmvByMonthPrev: number[] = Array(12).fill(0);
    for (let i = 0; i < 12; i++) {
      const r = revWineByYearMonth[currentYear][i];
      const c = costWineByYearMonth[currentYear][i];
      cmvByMonth[i] = r > 0 ? (c / r) * 100 : 0;
      const rp = revWineByYearMonth[previousYear][i];
      const cp = costWineByYearMonth[previousYear][i];
      cmvByMonthPrev[i] = rp > 0 ? (cp / rp) * 100 : 0;
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

    // Preço médio por mês — ano atual e anterior
    const avgAllByMonth: number[] = Array(12).fill(0);
    const avgBottleByMonth: number[] = Array(12).fill(0);
    const avgGlassByMonth: number[] = Array(12).fill(0);
    const avgAllByMonthPrev: number[] = Array(12).fill(0);
    const avgBottleByMonthPrev: number[] = Array(12).fill(0);
    const avgGlassByMonthPrev: number[] = Array(12).fill(0);
    for (let i = 0; i < 12; i++) {
      const b = bottlesByYearMonth[currentYear][i];
      const g = glassesByYearMonth[currentYear][i];
      const rb = revBottlesByYearMonth[currentYear][i];
      const rg = revGlassesByYearMonth[currentYear][i];
      avgBottleByMonth[i] = b > 0 ? rb / b : 0;
      avgGlassByMonth[i] = g > 0 ? rg / g : 0;
      avgAllByMonth[i] = b + g > 0 ? (rb + rg) / (b + g) : 0;
      const bp = bottlesByYearMonth[previousYear][i];
      const gp = glassesByYearMonth[previousYear][i];
      const rbp = revBottlesByYearMonth[previousYear][i];
      const rgp = revGlassesByYearMonth[previousYear][i];
      avgBottleByMonthPrev[i] = bp > 0 ? rbp / bp : 0;
      avgGlassByMonthPrev[i] = gp > 0 ? rgp / gp : 0;
      avgAllByMonthPrev[i] = bp + gp > 0 ? (rbp + rgp) / (bp + gp) : 0;
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

    const pick = (byYM: Record<number, number[]>) => {
      if (period) return { year: period.year, month: period.month };
      return findLastMonthWithData(byYM, currentYear, previousYear, currentMonth);
    };

    const lastRev = pick(revByYearMonth);
    const lastBottles = pick(bottlesByYearMonth);
    const lastGlasses = pick(glassesByYearMonth);
    const lastCmv = pick({ [currentYear]: cmvByMonth, [previousYear]: cmvByMonthPrev });
    const lastAvg = pick({ [currentYear]: avgAllByMonth, [previousYear]: avgAllByMonthPrev });
    const lastCorkage = pick(corkageAmtByYearMonth);

    const isPrev = (p: { year: number; month: number }) => p.year === previousYear;
    let revLast = lastRev.month >= 0 ? revByYearMonth[lastRev.year][lastRev.month] : 0;
    let bottlesLast = lastBottles.month >= 0 ? bottlesByYearMonth[lastBottles.year][lastBottles.month] : 0;
    let glassesLast = lastGlasses.month >= 0 ? glassesByYearMonth[lastGlasses.year][lastGlasses.month] : 0;
    let cmvLast =
      lastCmv.month >= 0 ? (isPrev(lastCmv) ? cmvByMonthPrev[lastCmv.month] : cmvByMonth[lastCmv.month]) : 0;
    let avgLast =
      lastAvg.month >= 0
        ? (isPrev(lastAvg) ? avgAllByMonthPrev[lastAvg.month] : avgAllByMonth[lastAvg.month])
        : 0;
    let avgBottleLast =
      lastAvg.month >= 0
        ? (isPrev(lastAvg) ? avgBottleByMonthPrev[lastAvg.month] : avgBottleByMonth[lastAvg.month])
        : 0;
    let avgGlassLast =
      lastAvg.month >= 0
        ? (isPrev(lastAvg) ? avgGlassByMonthPrev[lastAvg.month] : avgGlassByMonth[lastAvg.month])
        : 0;
    let corkageAmtLast = lastCorkage.month >= 0 ? corkageAmtByYearMonth[lastCorkage.year][lastCorkage.month] : 0;
    let corkageQtyLast = lastCorkage.month >= 0 ? corkageQtyByYearMonth[lastCorkage.year][lastCorkage.month] : 0;

    // Visão ano: acumula do mês 0 até o mês atual (ano corrente) ou até dezembro (ano anterior)
    const yearView = period?.mode === "year" ? period.year : null;
    if (yearView) {
      const limit = yearView === currentYear ? currentMonth : 11;
      const sum = (arr: number[]) => arr.slice(0, limit + 1).reduce((a, b) => a + b, 0);
      revLast = sum(revByYearMonth[yearView]);
      bottlesLast = sum(bottlesByYearMonth[yearView]);
      glassesLast = sum(glassesByYearMonth[yearView]);
      const revWine = sum(revWineByYearMonth[yearView]);
      const costWine = sum(costWineByYearMonth[yearView]);
      cmvLast = revWine > 0 ? (costWine / revWine) * 100 : 0;
      const bq = bottlesLast;
      const gq = glassesLast;
      const rb = sum(revBottlesByYearMonth[yearView]);
      const rg = sum(revGlassesByYearMonth[yearView]);
      avgBottleLast = bq > 0 ? rb / bq : 0;
      avgGlassLast = gq > 0 ? rg / gq : 0;
      avgLast = bq + gq > 0 ? (rb + rg) / (bq + gq) : 0;
      corkageAmtLast = sum(corkageAmtByYearMonth[yearView]);
      corkageQtyLast = sum(corkageQtyByYearMonth[yearView]);
    }


    const corkageAmtYear = corkageAmtByYearMonth[currentYear].reduce((a, b) => a + b, 0);
    const corkageQtyYear = corkageQtyByYearMonth[currentYear].reduce((a, b) => a + b, 0);

    return {
      revByYearMonth,
      bottlesByYearMonth,
      glassesByYearMonth,
      corkageAmtByYearMonth,
      revBottlesByYearMonth,
      revGlassesByYearMonth,
      revYear,
      cmvByMonth,
      cmvByMonthPrev,
      cmvYear,
      stockBottles,
      stockValue,
      bottlesYear: bottlesYearTotal,
      glassesYear: glassesYearTotal,
      avgBottle,
      avgGlass,
      avgAll,
      avgAllByMonth,
      avgBottleByMonth,
      avgGlassByMonth,
      avgAllByMonthPrev,
      avgBottleByMonthPrev,
      avgGlassByMonthPrev,
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
  }, [movements, corkage, wineById, wines, stockMap, currentYear, previousYear, currentMonth, period]);


  const yearView = period?.mode === "year" ? period.year : null;
  const refLabel = (p: { year: number; month: number }) =>
    yearView
      ? yearView === currentYear
        ? `Acum. ${yearView}`
        : `Ano ${yearView}`
      : monthLabel(p.year, p.month);

  const TABS: Array<{
    key: TabKey;
    label: string;
    primary: string;
    sub: string;
    info: string;
  }> = [
    {
      key: "faturamento",
      label: "Faturamento",
      primary: `R$ ${fmtBRL(agg.revLast)}`,
      sub: refLabel(agg.lastRev),
      info: "Receita total do último mês com dados (vendas de vinhos + taxas de rolha). Abaixo, o gráfico compara mês a mês o ano atual com o anterior.",
    },
    {
      key: "garrafas",
      label: "Garrafas Vendidas",
      primary: `${agg.bottlesLast}`,
      sub: refLabel(agg.lastBottles),
      info: "Quantidade de garrafas vendidas no último mês com dados. O painel abre o comparativo mensal com o ano anterior.",
    },
    {
      key: "tacas",
      label: "Taças Vendidas",
      primary: `${agg.glassesLast}`,
      sub: refLabel(agg.lastGlasses),
      info: "Quantidade de taças de vinho vendidas no último mês com dados, comparadas mês a mês com o ano anterior.",
    },
    {
      key: "estoque",
      label: "Estoque Gfas",
      primary: `${agg.stockBottles}`,
      sub: `R$ ${fmtBRL(agg.stockValue)}`,
      info: "Total de garrafas em adega e o valor correspondente (preço de venda) segundo a última contagem fechada.",
    },
    {
      key: "preco",
      label: "Preço Médio",
      primary: `R$ ${fmtBRL(agg.avgLast)}`,
      sub: refLabel(agg.lastAvg),
      info: "Preço médio praticado no último mês com dados (receita ÷ unidades vendidas, considerando garrafas e taças).",
    },
    {
      key: "cmv",
      label: "CMV",
      primary: `${agg.cmvLast.toFixed(1)}%`,
      sub: refLabel(agg.lastCmv),
      info: "Custo da mercadoria vendida no último mês com dados: custo total ÷ receita das vendas de vinhos. Meta usual: ≤ 33%.",
    },
    {
      key: "rolha",
      label: "Taxa de Rolha",
      primary: `R$ ${fmtBRL(agg.corkageAmtLast)}`,
      sub: refLabel(agg.lastCorkage),
      info: "Valor arrecadado com taxas de rolha no último mês lançado. Lance mensalmente em 'Taxa de rolha'; o valor entra no faturamento.",
    },
    {
      key: "outras",
      label: "Outras",
      primary: `+`,
      sub: `Personalizar`,
      info: "Espaço para indicadores personalizados do restaurante (em breve).",
    },
  ];

  const activeGroupName = groups.find((g) => g.id === activeGroupId)?.name;
  const consolidatedUnitCount = isGroup ? memberships.filter((m) => m.groupId === activeGroupId).length : 0;

  return (
    <div className="p-3 md:p-10 space-y-3 md:space-y-6">
      {isGroup && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/40 bg-[color:var(--wine)]/20 px-3 py-2 md:px-4 md:py-3">
          <div className="text-[11px] md:text-[12px] text-foreground">
            <span className="font-semibold text-primary">
              Rede: {activeGroupName ?? "—"} — consolidado
            </span>
            <span className="text-muted-foreground"> ({consolidatedUnitCount} unidade{consolidatedUnitCount !== 1 ? "s" : ""})</span>
          </div>
          <button
            onClick={() => setActiveGroup(null)}
            className="rounded-md border border-primary/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary hover:bg-[color:var(--wine)]/30"
          >
            Ver uma unidade
          </button>
        </div>
      )}

      {/* Mobile header — compact */}
      <header className="md:hidden space-y-2.5 border-b border-border pb-3">
        <h1 className="text-center text-[12px] font-bold uppercase tracking-[0.16em] text-primary">
          Gestão de Vinhos <span className="text-muted-foreground">para Restaurantes</span>
        </h1>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setDiagOpen(true)}
            className="flex h-9 items-center justify-center gap-2 rounded-lg border border-primary bg-card text-[11px] font-semibold uppercase tracking-wider text-primary"
          >
            <FileText size={13} /> Diagnóstico
          </button>
          <button
            onClick={() => setPeriodOpen((v) => !v)}
            className={`flex h-9 items-center justify-between gap-2 rounded-lg border px-3 text-[11px] font-semibold uppercase tracking-wider ${
              period
                ? "border-primary bg-[color:var(--wine)]/25 text-primary"
                : "border-border bg-card text-primary"
            }`}
          >
            <span className="truncate">
              {period
                ? period.mode === "year"
                  ? period.year === currentYear
                    ? `Acum. ${String(period.year).slice(-2)}`
                    : `Ano ${String(period.year).slice(-2)}`
                  : monthLabel(period.year, period.month)
                : "Mês / Ano"}
            </span>
            <CalendarRange size={13} className="shrink-0" />
          </button>
        </div>
        {!isGroup && (
          <button
            onClick={() => setMetasOpen(true)}
            className="flex h-8 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            <Target size={12} /> Metas
          </button>
        )}
      </header>


      <header className="hidden md:flex items-center justify-between border-b border-border pb-4">

        <div>
          <h1 className="page-title">Painel de Controle</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {isGroup
              ? "Indicadores consolidados de todas as unidades da rede."
              : "Indicadores da adega em tempo real — clique nos botões para ver detalhes."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDiagOpen(true)}
            className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-primary transition hover:border-primary"
            title="Relatório de diagnóstico de vendas do mês e YTD"
          >
            <FileText size={14} /> Diagnóstico
          </button>
          {!isGroup && (
            <button
              onClick={() => setMetasOpen(true)}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-primary transition hover:border-primary"
              title="Definir metas mensais e anuais dos indicadores"
            >
              <Target size={14} /> Metas
            </button>
          )}
          <div className="relative">
            <button
              onClick={() => setPeriodOpen((v) => !v)}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-[11px] font-semibold uppercase tracking-wider transition ${
                period ? "border-primary bg-[color:var(--wine)]/20 text-primary" : "border-border bg-card text-primary hover:border-primary"
              }`}
              title="Escolher o mês ou o ano de referência do painel"
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
                      !period ? "border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/60"
                    }`}
                  >
                    Último mês com dados
                  </button>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Visão ano
                  </div>
                  <div className="mb-3 grid grid-cols-2 gap-1">
                    {[currentYear, previousYear].map((y) => {
                      const active = period?.mode === "year" && period.year === y;
                      return (
                        <button
                          key={`year-${y}`}
                          onClick={() => {
                            setPeriod({ year: y, month: -1, mode: "year" });
                            setPeriodOpen(false);
                          }}
                          className={`rounded-md border px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition ${
                            active
                              ? "border-primary bg-[color:var(--wine)]/25 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/60 hover:text-primary"
                          }`}
                          title={
                            y === currentYear
                              ? "Acumulado do ano atual até o mês corrente"
                              : "Ano anterior completo"
                          }
                        >
                          {y === currentYear ? `Acum. ${y}` : `Ano ${y}`}
                        </button>
                      );
                    })}
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
                              key={m}
                              disabled={disabled}
                              onClick={() => {
                                setPeriod({ year: y, month: i });
                                setPeriodOpen(false);
                              }}
                              className={`rounded-md border px-1 py-1 text-[10px] font-semibold uppercase transition ${
                                active
                                  ? "border-primary bg-[color:var(--wine)]/25 text-primary"
                                  : "border-border text-muted-foreground hover:border-primary/60 hover:text-primary"
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

      {/* Mobile KPI grid — 3 columns, compact */}
      <div className="md:hidden grid grid-cols-3 gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg border px-1.5 py-1.5 text-center transition ${
              tab === t.key
                ? "border-primary bg-[color:var(--wine)]/25"
                : "border-border bg-card"
            }`}
          >
            <div className="truncate text-[7.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {t.label}
            </div>
            <div className="mt-0.5 truncate text-[13px] font-bold leading-tight text-primary">
              {t.primary}
            </div>
          </button>
        ))}
      </div>


      {/* KPI buttons row (desktop) */}
      <div className="hidden md:grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
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
            <div className="mb-1 pr-5">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t.label}
              </span>
            </div>
            <div className="text-lg font-bold text-primary leading-tight">
              {t.primary}
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">{t.sub}</div>
          </button>
        ))}
      </div>

      {/* Mobile period sheet */}
      {periodOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setPeriodOpen(false)}>
          <div
            className="max-h-[80vh] w-full overflow-y-auto rounded-t-2xl border-t border-border bg-card p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-primary">
              Período de referência
            </div>
            <button
              onClick={() => {
                setPeriod(null);
                setPeriodOpen(false);
              }}
              className={`mb-3 w-full rounded-md border px-2 py-2 text-[10px] font-semibold uppercase tracking-wider ${
                !period ? "border-primary text-primary" : "border-border text-muted-foreground"
              }`}
            >
              Último mês com dados
            </button>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Visão ano
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2">
              {[currentYear, previousYear].map((y) => (
                <button
                  key={`m-year-${y}`}
                  onClick={() => {
                    setPeriod({ year: y, month: -1, mode: "year" });
                    setPeriodOpen(false);
                  }}
                  className={`rounded-md border px-2 py-2 text-[10px] font-semibold uppercase tracking-wider ${
                    period?.mode === "year" && period.year === y
                      ? "border-primary bg-[color:var(--wine)]/25 text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {y === currentYear ? `Acum. ${y}` : `Ano ${y}`}
                </button>
              ))}
            </div>
            {[currentYear, previousYear].map((y) => (
              <div key={`m-${y}`} className="mb-3">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {y}
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {MONTHS.map((m, i) => {
                    const disabled = y === currentYear && i > currentMonth;
                    const active = !period?.mode && period?.year === y && period?.month === i;
                    return (
                      <button
                        key={`m-${y}-${m}`}
                        disabled={disabled}
                        onClick={() => {
                          setPeriod({ year: y, month: i });
                          setPeriodOpen(false);
                        }}
                        className={`rounded-md border px-1 py-2 text-[10px] font-semibold uppercase ${
                          active
                            ? "border-primary bg-[color:var(--wine)]/25 text-primary"
                            : "border-border text-muted-foreground"
                        } disabled:opacity-30`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail panel */}
      <div className="rounded-xl border border-border bg-card p-3 md:p-5">

        {tab === "faturamento" && (
          <FaturamentoPanel
            revByYearMonth={agg.revByYearMonth}
            revBottlesByYearMonth={agg.revBottlesByYearMonth}
            revGlassesByYearMonth={agg.revGlassesByYearMonth}
            corkageAmtByYearMonth={agg.corkageAmtByYearMonth}
            currentYear={currentYear}
            previousYear={previousYear}
            revLast={agg.revLast}
            lastMonth={agg.lastRev}
            revYear={agg.revYear}
            corkageAmtYear={agg.corkageAmtYear}
            currentMonth={currentMonth}
            targets={targetsFor(targets, "faturamento")}
          />
        )}
        {tab === "garrafas" && (
          <SimpleYearPanel
            title="Vendas de Garrafas"
            unit="gfa"
            byYearMonth={agg.bottlesByYearMonth}
            currentYear={currentYear}
            previousYear={previousYear}
            currentMonth={currentMonth}
            targets={targetsFor(targets, "garrafas")}
          />
        )}
        {tab === "tacas" && (
          <SimpleYearPanel
            title="Vendas em Taças"
            unit="taça"
            byYearMonth={agg.glassesByYearMonth}
            currentYear={currentYear}
            previousYear={previousYear}
            currentMonth={currentMonth}
            targets={targetsFor(targets, "tacas")}
          />
        )}
        {tab === "estoque" && (
          <EstoquePanel
            wines={wines}
            stockMap={stockMap}
            totalBottles={agg.stockBottles}
            totalValue={agg.stockValue}
            targets={targetsFor(targets, "estoque")}
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
            avgAllByMonth={agg.avgAllByMonth}
            avgBottleByMonth={agg.avgBottleByMonth}
            avgGlassByMonth={agg.avgGlassByMonth}
            avgAllByMonthPrev={agg.avgAllByMonthPrev}
            avgBottleByMonthPrev={agg.avgBottleByMonthPrev}
            avgGlassByMonthPrev={agg.avgGlassByMonthPrev}
            currentYear={currentYear}
            previousYear={previousYear}
            lastMonth={agg.lastAvg}
            targets={targetsFor(targets, "preco")}
          />
        )}
        {tab === "cmv" && (
          <CmvPanel
            cmvMonth={agg.cmvLast}
            cmvYear={agg.cmvYear}
            lastMonth={agg.lastCmv}
            wines={wines}
            movements={movements}
            wineById={wineById}

            cmvByMonth={agg.cmvByMonth}
            cmvByMonthPrev={agg.cmvByMonthPrev}
            currentYear={currentYear}
            previousYear={previousYear}
            targets={targetsFor(targets, "cmv")}
          />
        )}
        {tab === "rolha" && (
          <RolhaPanel
            amtLast={agg.corkageAmtLast}
            qtyLast={agg.corkageQtyLast}
            amtYear={agg.corkageAmtYear}
            qtyYear={agg.corkageQtyYear}
            lastMonth={agg.lastCorkage}
            corkageAmtByYearMonth={agg.corkageAmtByYearMonth}
            currentYear={currentYear}
            previousYear={previousYear}
            currentMonth={currentMonth}
            targets={targetsFor(targets, "rolha")}
          />
        )}

        {tab === "outras" && <OutrasPanel />}
      </div>

      {restaurantId && (
        <>
          <DashboardTargetsEditor
            open={metasOpen}
            onClose={() => setMetasOpen(false)}
            restaurantId={restaurantId}
            year={currentYear}
          />
          <SalesDiagnosticReport
            open={diagOpen}
            onClose={() => setDiagOpen(false)}
            wines={wines}
            movements={movements}
            corkage={corkage}
            stockMap={stockMap}
            targets={targets}
            currentYear={currentYear}
            previousYear={previousYear}
            currentMonth={currentMonth}
          />
        </>
      )}
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
  revBottlesByYearMonth,
  revGlassesByYearMonth,
  corkageAmtByYearMonth,
  currentYear,
  previousYear,
  revLast,
  lastMonth,
  revYear,
  corkageAmtYear,
  currentMonth,
  targets,
}: {
  revByYearMonth: Record<number, number[]>;
  revBottlesByYearMonth: Record<number, number[]>;
  revGlassesByYearMonth: Record<number, number[]>;
  corkageAmtByYearMonth: Record<number, number[]>;
  currentYear: number;
  previousYear: number;
  revLast: number;
  lastMonth: { year: number; month: number };
  revYear: number;
  corkageAmtYear: number;
  currentMonth: number;
  targets: TargetSet;
}) {
  const curr = revByYearMonth[currentYear];
  const prev = revByYearMonth[previousYear];

  const prevYearTotal = prev.reduce((a, b) => a + b, 0);
  // Acumulado comparativo: sempre até o mês anterior ao corrente
  const accMonth = Math.max(currentMonth - 1, 0);
  const currAcc = curr.slice(0, accMonth + 1).reduce((a, b) => a + b, 0);
  const prevAcc = prev.slice(0, accMonth + 1).reduce((a, b) => a + b, 0);
  const diff = prevAcc > 0 ? ((currAcc - prevAcc) / prevAcc) * 100 : 0;
  const annualTarget = resolveAnnualTarget(targets);
  const monthTarget = lastMonth.month >= 0 ? targets.monthly[lastMonth.month] ?? 0 : 0;

  const [pieMode, setPieMode] = useState<"mes" | "ano">("mes");
  const useMonth = pieMode === "mes" && lastMonth.month >= 0;
  const yr = useMonth ? lastMonth.year : currentYear;
  const bottlesRev = useMonth
    ? revBottlesByYearMonth[yr][lastMonth.month]
    : revBottlesByYearMonth[currentYear].reduce((a, b) => a + b, 0);
  const glassesRev = useMonth
    ? revGlassesByYearMonth[yr][lastMonth.month]
    : revGlassesByYearMonth[currentYear].reduce((a, b) => a + b, 0);
  const corkageRev = useMonth
    ? corkageAmtByYearMonth[yr][lastMonth.month]
    : corkageAmtYear;

  return (
    <div>
      <SectionHeader
        icon={<TrendingUp size={14} />}
        title="Faturamento — mensal e acumulado"
      />

      <div className="mb-5 space-y-1 border-b border-border pb-4">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>
            {monthLabel(currentYear, 0)} - {monthLabel(currentYear, accMonth)}:
          </span>
          <span className="text-foreground">R$ {fmtBRL(currAcc)}</span>
          <span className={diff >= 0 ? "text-primary" : "text-destructive"}>
            {diff >= 0 ? "+" : ""}{diff.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>
            {monthLabel(previousYear, 0)} - {monthLabel(previousYear, accMonth)}:
          </span>
          <span className="text-foreground">R$ {fmtBRL(prevAcc)}</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[210px_minmax(0,1fr)_minmax(220px,260px)]">
        <div className="grid min-w-0 grid-cols-2 gap-2 lg:flex lg:flex-col lg:gap-3">
          {monthTarget > 0 && lastMonth.month >= 0 && (
            <TargetGauge
              label={`Meta ${monthLabel(lastMonth.year, lastMonth.month)}`}
              achieved={revLast}
              target={monthTarget}
              valuePrefix="R$ "
              size="sm"
            />
          )}
          {annualTarget !== null && (
            <TargetGauge
              label={`Meta anual ${currentYear}`}
              achieved={currAcc}
              target={annualTarget}
              valuePrefix="R$ "
              size="sm"
            />
          )}
        </div>
        <div>
          <BarChart
            curr={curr}
            prev={prev}
            currentYear={currentYear}
            previousYear={previousYear}
            valuePrefix="R$ "
            height={280}
            targets={targets.monthly.length === 12 ? targets.monthly : undefined}
          />
        </div>
        <div className="rounded-lg border border-border bg-[color:var(--surface-2)]/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Composição do Faturamento
            </div>
            <div className="flex overflow-hidden rounded-md border border-border text-[10px]">
              <button
                onClick={() => setPieMode("mes")}
                className={`px-2 py-1 ${pieMode === "mes" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary"}`}
              >
                Mês
              </button>
              <button
                onClick={() => setPieMode("ano")}
                className={`px-2 py-1 ${pieMode === "ano" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary"}`}
              >
                Ano
              </button>
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground mb-3">
            {pieMode === "mes"
              ? `Referência: ${monthLabel(lastMonth.year, lastMonth.month)}`
              : `Acumulado ${currentYear}`}
          </div>
          <PieChart
            slices={[
              { label: "Garrafas", value: bottlesRev, color: "var(--gold)" },
              { label: "Taças", value: glassesRev, color: "var(--wine)" },
              { label: "Taxa de Rolha", value: corkageRev, color: "#c9a8a8" },
            ]}
          />
        </div>
      </div>

    </div>
  );
}

function PieChart({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((a, s) => a + (s.value || 0), 0);
  const size = 180;
  const r = 78;
  const cx = size / 2;
  const cy = size / 2;

  let acc = 0;
  const paths =
    total > 0
      ? slices.map((s) => {
          const frac = s.value / total;
          const startAngle = acc * 2 * Math.PI;
          const endAngle = (acc + frac) * 2 * Math.PI;
          acc += frac;
          const large = frac > 0.5 ? 1 : 0;
          const x1 = cx + r * Math.sin(startAngle);
          const y1 = cy - r * Math.cos(startAngle);
          const x2 = cx + r * Math.sin(endAngle);
          const y2 = cy - r * Math.cos(endAngle);
          // Handle 100% single-slice case with a full circle
          const d =
            frac >= 0.9999
              ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
              : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
          return { d, color: s.color, label: s.label, value: s.value, pct: frac * 100 };
        })
      : [];

  return (
    <div className="flex flex-col items-center gap-3">
      {total > 0 ? (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {paths.map((p, i) => (
            <path
              key={i}
              d={p.d}
              fill={p.color}
              stroke="var(--card)"
              strokeWidth={1.5}
            />
          ))}
        </svg>
      ) : (
        <div
          className="flex items-center justify-center rounded-full border border-dashed border-border text-[10px] text-muted-foreground"
          style={{ width: size, height: size }}
        >
          Sem dados
        </div>
      )}
      <div className="w-full space-y-1.5">
        {slices.map((s) => {
          const pct = total > 0 ? (s.value / total) * 100 : 0;
          return (
            <div key={s.label} className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded"
                  style={{ background: s.color }}
                />
                <span className="text-muted-foreground">{s.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-foreground">R$ {fmtBRL(s.value)}</span>
                <span className="text-primary font-semibold w-12 text-right">
                  {pct.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
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
  currentMonth,
  targets,
}: {
  title: string;
  unit: string;
  byYearMonth: Record<number, number[]>;
  currentYear: number;
  previousYear: number;
  currentMonth: number;
  targets: TargetSet;
}) {
  const curr = byYearMonth[currentYear];
  const prev = byYearMonth[previousYear];
  const currTotal = curr.reduce((a, b) => a + b, 0);
  const prevTotal = prev.reduce((a, b) => a + b, 0);
  const currAcc = curr.slice(0, currentMonth + 1).reduce((a, b) => a + b, 0);
  const annualTarget = resolveAnnualTarget(targets);

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
      {annualTarget !== null && (
        <TargetSummary
          label={`Meta anual ${currentYear}`}
          achieved={currAcc}
          target={annualTarget}
          valueSuffix={` ${unit}`}
        />
      )}
      <BarChart
        curr={curr}
        prev={prev}
        currentYear={currentYear}
        previousYear={previousYear}
        valueSuffix={` ${unit}`}
        height={240}
        targets={targets.monthly.length === 12 ? targets.monthly : undefined}
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
  targets,
}: {
  curr: number[];
  prev: number[];
  currentYear: number;
  previousYear: number;
  valuePrefix?: string;
  valueSuffix?: string;
  height?: number;
  targets?: number[];
}) {
  const hasTargets = !!targets && targets.some((t) => t > 0);
  const targetsForMax = hasTargets ? targets!.filter((t) => t > 0) : [];
  const rawMax = Math.max(1, ...curr, ...prev, ...targetsForMax);
  const maxVal = niceMax(rawMax);
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((f) => maxVal * f);
  const axisWidth = 0;
  const fmtFull = (n: number) =>
    n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

  return (
    <div>
      <div className="relative w-full" style={{ height }}>
        {/* Horizontal gridlines (Y axis labels suppressed) */}
        <div className="absolute inset-0" style={{ paddingLeft: axisWidth, paddingBottom: 22 }}>
          <div className="relative h-full w-full">
            {ticks.map((t, i) => (
              <div
                key={i}
                className="absolute left-0 right-0 flex items-center"
                style={{ top: `${(i / (ticks.length - 1)) * 100}%`, transform: "translateY(-0.5px)" }}
              >
                <div
                  className="h-px w-full"
                  style={{ background: "color-mix(in oklab, var(--muted-foreground) 45%, transparent)" }}
                />
              </div>
            ))}

            {/* Vertical gridlines between months */}
            <div className="absolute inset-0 flex">
              {MONTHS.map((_, i) => (
                <div
                  key={i}
                  className="flex-1 border-l"
                  style={{ borderColor: "color-mix(in oklab, var(--muted-foreground) 30%, transparent)" }}
                />
              ))}
              <div
                className="border-l"
                style={{ borderColor: "color-mix(in oklab, var(--muted-foreground) 45%, transparent)" }}
              />
            </div>

            {/* Bars */}
            <div className="absolute inset-0 flex items-end justify-between gap-2 pt-6">
              {MONTHS.map((mo, i) => {
                const cPct = (curr[i] / maxVal) * 100;
                const pPct = (prev[i] / maxVal) * 100;
                const tVal = targets?.[i] ?? 0;
                const tPct = tVal > 0 ? (tVal / maxVal) * 100 : 0;
                const met = tVal > 0 && curr[i] >= tVal;
                return (
                  <div key={mo} className="relative flex h-full min-w-0 flex-1 items-end justify-center gap-0.5">
                    {/* Target line: rendered first so bar values paint on top */}
                    {tVal > 0 && (
                      <div
                        className="pointer-events-none absolute left-[10%] right-[10%] z-0"
                        style={{
                          bottom: `${tPct}%`,
                          height: 0,
                          borderTop: "1px solid #e5484d",
                        }}
                        title={`Meta ${mo}: ${valuePrefix}${fmtBRL(tVal)}${valueSuffix}`}
                      />
                    )}

                    <div
                      className="relative flex w-2/5 justify-center rounded-t-sm transition-all"
                      style={{
                        height: prev[i] > 0 ? `max(2px, ${pPct}%)` : "0%",
                        background: "#444444",
                      }}
                      title={`${previousYear}: ${valuePrefix}${fmtBRL(prev[i])}${valueSuffix}`}
                    >
                      {prev[i] > 0 && (
                        <span className="absolute bottom-full z-10 mb-1 whitespace-nowrap rounded bg-[color:var(--card)] px-1 text-[9px] font-semibold leading-none tabular-nums text-muted-foreground">
                          {fmtFull(prev[i])}
                        </span>
                      )}
                    </div>


                    <div
                      className="relative flex w-2/5 justify-center rounded-t-sm transition-all"
                      style={{
                        height: `${cPct}%`,
                        background: "var(--gold)",
                      }}
                      title={`${currentYear}: ${valuePrefix}${fmtBRL(curr[i])}${valueSuffix}${
                        tVal > 0 ? ` • Meta: ${valuePrefix}${fmtBRL(tVal)}${valueSuffix}` : ""
                      }`}
                    >
                      {curr[i] > 0 && (
                        <span className="absolute bottom-full z-10 mb-1 whitespace-nowrap rounded bg-[color:var(--card)] px-1 text-[9px] font-semibold leading-none tabular-nums text-primary">
                          {fmtFull(curr[i])}
                        </span>
                      )}
                    </div>
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
            className="inline-block h-3 w-3 rounded-full"
            style={{ background: "#444444" }}
          />
          <span className="text-muted-foreground">{previousYear}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ background: "var(--gold)" }}
          />

          <span className="text-muted-foreground">{currentYear}</span>
        </div>
        {hasTargets && (
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-6"
              style={{ borderTop: "1px solid #e5484d" }}
            />
            <span className="text-muted-foreground">Meta mensal</span>
          </div>
        )}
      </div>
    </div>
  );
}

function TargetGauge({
  label,
  achieved,
  target,
  unit,
  valuePrefix = "",
  valueSuffix = "",
  decimals = 0,
  invert = false,
  size = "sm",
}: {
  label: string;
  achieved: number;
  target: number | null;
  unit?: string;
  valuePrefix?: string;
  valueSuffix?: string;
  decimals?: number;
  invert?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  if (target === null || !isFinite(target) || target <= 0) return null;
  const pct = target > 0 ? (achieved / target) * 100 : 0;
  const clamped = Math.max(0, Math.min(100, pct));
  const good = invert ? achieved <= target : achieved >= target;
  const color = "var(--gold)";
  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });


  // Donut ring (same model as the "Participação no restaurante" chart)
  const box = size === "lg" ? 160 : size === "md" ? 144 : 128;
  const stroke = size === "lg" ? 18 : size === "md" ? 16 : 14;
  const c = box / 2;
  const r = c - stroke / 2 - 2;
  const circ = 2 * Math.PI * r;
  const bigVal = size === "lg" ? "text-2xl" : size === "md" ? "text-xl" : "text-lg";

  return (
    <div className="flex w-full min-w-0 flex-col rounded-lg border border-border bg-[color:var(--surface-2)] p-3">
      <div className="mb-2 truncate text-center text-[9px] font-semibold uppercase tracking-wider text-primary">
        {label}
      </div>
      <div className="relative mx-auto w-full" style={{ maxWidth: box, aspectRatio: "1 / 1" }}>
        <svg viewBox={`0 0 ${box} ${box}`} className="block h-full w-full -rotate-90">
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke="#3a3a3a"
            strokeWidth={stroke}
          />
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={good ? color : "var(--wine)"}
            strokeWidth={stroke}
            strokeLinecap="butt"
            strokeDasharray={`${(clamped / 100) * circ} ${circ}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`${bigVal} font-bold leading-none tabular-nums`} style={{ color }}>
            {pct.toFixed(1)}%
          </span>
          <span className="mt-1 text-[8px] uppercase tracking-wider text-muted-foreground">
            da meta
          </span>
        </div>
      </div>
      <div className="mt-3 space-y-1 border-t border-border pt-2 text-[10px]">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
            Real
          </span>
          <span className={`whitespace-nowrap font-semibold tabular-nums ${good ? "text-primary" : "text-foreground"}`}>
            {valuePrefix}{fmt(achieved)}{valueSuffix}{unit ? ` ${unit}` : ""}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-[#3a3a3a]" />
            Meta
          </span>
          <span className="whitespace-nowrap font-semibold tabular-nums text-foreground">
            {valuePrefix}{fmt(target)}{valueSuffix}{unit ? ` ${unit}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

// Backwards-compatible alias — all previous usages render as a gauge now.
const TargetSummary = TargetGauge;


type TargetSet = { monthly: number[]; annual: number | null };

function resolveAnnualTarget(t: TargetSet): number | null {
  if (t.annual !== null && t.annual > 0) return t.annual;
  if (t.monthly.length === 12) {
    const s = t.monthly.reduce((a, b) => a + b, 0);
    if (s > 0) return s;
  }
  return null;
}



function EstoquePanel({
  wines,
  stockMap,
  totalBottles,
  totalValue,
  targets,
}: {
  wines: WineRow[];
  stockMap: Record<string, number>;
  totalBottles: number;
  totalValue: number;
  targets: TargetSet;
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
  const annualTarget = resolveAnnualTarget(targets);

  return (
    <div>
      <SectionHeader icon={<Package size={14} />} title="Estoque em adega" subtitle="Consolidação da última contagem fechada." />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3">
        <MiniStat label="Garrafas em estoque" value={`${totalBottles}`} tone="primary" />
        <MiniStat label="Valor de venda" value={`R$ ${fmtBRL(totalValue)}`} />
        <MiniStat label="Valor de custo" value={`R$ ${fmtBRL(totalCost)}`} />
      </div>
      {annualTarget !== null && (
        <TargetSummary
          label="Meta de estoque (garrafas)"
          achieved={totalBottles}
          target={annualTarget}
          valueSuffix=" gfa"
        />
      )}
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
  avgAllByMonth,
  avgBottleByMonth,
  avgGlassByMonth,
  avgAllByMonthPrev,
  avgBottleByMonthPrev,
  avgGlassByMonthPrev,
  currentYear,
  previousYear,
  lastMonth,
  targets,
}: {
  avgAll: number;
  avgBottle: number;
  avgGlass: number;
  avgAllYear: number;
  avgBottleYear: number;
  avgGlassYear: number;
  avgAllByMonth: number[];
  avgBottleByMonth: number[];
  avgGlassByMonth: number[];
  avgAllByMonthPrev: number[];
  avgBottleByMonthPrev: number[];
  avgGlassByMonthPrev: number[];
  currentYear: number;
  previousYear: number;
  lastMonth: { year: number; month: number };
  targets: TargetSet;
}) {
  const ml = monthLabel(lastMonth.year, lastMonth.month);
  const annualTarget = resolveAnnualTarget(targets);
  const monthTarget = lastMonth.month >= 0 ? targets.monthly[lastMonth.month] ?? 0 : 0;
  const [view, setView] = useState<"all" | "bottle" | "glass">("all");
  const curr =
    view === "bottle" ? avgBottleByMonth : view === "glass" ? avgGlassByMonth : avgAllByMonth;
  const prev =
    view === "bottle"
      ? avgBottleByMonthPrev
      : view === "glass"
        ? avgGlassByMonthPrev
        : avgAllByMonthPrev;
  const viewLabel =
    view === "bottle" ? "Garrafas" : view === "glass" ? "Taças" : "Geral";
  return (
    <div>
      <SectionHeader
        icon={<Tag size={14} />}
        title="Preço médio praticado"
        subtitle={`Referência: último mês com dados (${ml}). Ao lado, média do ano corrente.`}
      />
      {monthTarget > 0 && (
        <TargetSummary
          label={`Meta de preço médio — ${ml}`}
          achieved={avgAll}
          target={monthTarget}
          valuePrefix="R$ "
          decimals={2}
        />
      )}
      {annualTarget !== null && (
        <TargetSummary
          label="Meta de preço médio (ano)"
          achieved={avgAllYear}
          target={annualTarget}
          valuePrefix="R$ "
          decimals={2}
        />
      )}
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <MiniStat label={`Geral — ${ml}`} value={`R$ ${fmtBRL(avgAll)}`} tone="primary" />
        <MiniStat label={`Garrafa — ${ml}`} value={`R$ ${fmtBRL(avgBottle)}`} />
        <MiniStat label={`Taça — ${ml}`} value={`R$ ${fmtBRL(avgGlass)}`} />
        <MiniStat label="Geral (ano)" value={`R$ ${fmtBRL(avgAllYear)}`} />
        <MiniStat label="Garrafa (ano)" value={`R$ ${fmtBRL(avgBottleYear)}`} />
        <MiniStat label="Taça (ano)" value={`R$ ${fmtBRL(avgGlassYear)}`} />
      </div>

      <div className="rounded-lg border border-border bg-[color:var(--surface-2)]/40 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">
            Preço médio mensal — {viewLabel}
          </div>
          <div className="flex overflow-hidden rounded-md border border-border text-[10px]">
            {(
              [
                { k: "all", label: "Geral" },
                { k: "bottle", label: "Garrafas" },
                { k: "glass", label: "Taças" },
              ] as const
            ).map((o) => (
              <button
                key={o.k}
                onClick={() => setView(o.k)}
                className={`px-2 py-1 ${
                  view === o.k
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-primary"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <BarChart
          curr={curr}
          prev={prev}
          currentYear={currentYear}
          previousYear={previousYear}
          valuePrefix="R$ "
          height={260}
          targets={targets.monthly.length === 12 ? targets.monthly : undefined}
        />
      </div>
    </div>
  );
}

function CmvPanel({
  cmvMonth,
  cmvYear,
  lastMonth,
  wines,
  movements,
  wineById,
  cmvByMonth,
  cmvByMonthPrev,
  currentYear,
  previousYear,
  targets,
}: {
  cmvMonth: number;
  cmvYear: number;
  lastMonth: { year: number; month: number };
  wines: WineRow[];
  movements: Movement[];
  wineById: Record<string, WineRow>;
  cmvByMonth: number[];
  cmvByMonthPrev: number[];
  currentYear: number;
  previousYear: number;
  targets: TargetSet;
}) {
  const ml = monthLabel(lastMonth.year, lastMonth.month);
  const annualTarget = resolveAnnualTarget(targets);
  const monthTarget = lastMonth.month >= 0 ? targets.monthly[lastMonth.month] ?? 0 : 0;
  const [auditOpen, setAuditOpen] = useState(false);

  const audit = useMemo(() => {
    type Line = {
      name: string;
      qty: number;
      unitCost: number;
      unitPrice: number;
      cost: number;
      revenue: number;
      costFallback: boolean;
    };
    const map = new Map<string, Line>();
    let cost = 0;
    let revenue = 0;
    for (const m of movements) {
      const d = new Date(m.occurred_at);
      if (d.getFullYear() !== lastMonth.year || d.getMonth() !== lastMonth.month) continue;
      const w = wineById[m.wine_id];
      const q = m.quantity ?? 0;
      const price = Number(m.unit_price ?? w?.sale_price ?? 0);
      const unitCost = Number(m.unit_cost ?? w?.cost_price ?? 0);
      const c = unitCost * q;
      const r = price * q;
      cost += c;
      revenue += r;
      const key = m.wine_id;
      const prev = map.get(key);
      if (prev) {
        prev.qty += q;
        prev.cost += c;
        prev.revenue += r;
        prev.unitCost = prev.qty ? prev.cost / prev.qty : 0;
        prev.unitPrice = prev.qty ? prev.revenue / prev.qty : 0;
        prev.costFallback = prev.costFallback || m.unit_cost == null;
      } else {
        map.set(key, {
          name: w?.name ?? "Rótulo removido",
          qty: q,
          unitCost,
          unitPrice: price,
          cost: c,
          revenue: r,
          costFallback: m.unit_cost == null,
        });
      }
    }
    const lines = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
    const zeroCost = lines.filter((l) => l.cost === 0 && l.revenue > 0);
    return {
      lines,
      cost,
      revenue,
      cmv: revenue > 0 ? (cost / revenue) * 100 : 0,
      zeroCost,
    };
  }, [movements, wineById, lastMonth.year, lastMonth.month]);

  return (
    <div>
      <SectionHeader icon={<Percent size={14} />} title="CMV do restaurante" subtitle="Custo da mercadoria vendida (custo / preço de venda das vendas de vinhos)." />
      <div className="mb-3 rounded-lg border border-dashed border-border bg-[color:var(--surface-2)] p-3 text-[11px] text-muted-foreground">
        <span className="font-semibold text-primary">Como o CMV é calculado:</span> soma do
        (custo unitário × quantidade vendida) ÷ soma do (preço de venda × quantidade vendida), somente
        vendas de vinho do mês. A taxa de rolha fica fora (não tem custo de mercadoria). O custo usado é o
        <em> custo histórico registrado na venda</em>; quando a venda não tem custo gravado, cai para o
        custo atual do cadastro do rótulo — se o rótulo estiver com custo zerado, o CMV cai
        artificialmente.
      </div>
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
      <div className="mb-4 rounded-lg border border-border bg-[color:var(--surface-2)] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] text-foreground">
            <span className="text-muted-foreground">Memória de cálculo {ml}: </span>
            custo <b className="text-primary">R$ {fmtBRL(audit.cost, 2)}</b> ÷ receita{" "}
            <b className="text-primary">R$ {fmtBRL(audit.revenue, 2)}</b> ={" "}
            <b className="text-primary">{audit.cmv.toFixed(1)}%</b>
          </div>
          <button
            onClick={() => setAuditOpen((v) => !v)}
            className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary hover:border-primary"
          >
            <Calculator size={12} /> {auditOpen ? "Ocultar detalhe" : "Ver rótulo por rótulo"}
          </button>
        </div>
        {audit.zeroCost.length > 0 && (
          <div className="mt-2 text-[10px] text-[color:var(--danger,#e05a5a)]">
            Atenção: {audit.zeroCost.length} rótulo(s) vendido(s) sem custo informado — isso reduz o CMV
            calculado. Revise o preço de custo no cadastro.
          </div>
        )}
        {auditOpen && (
          <div className="mt-3 max-h-72 overflow-auto rounded-md border border-border">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-card text-[9px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-left">Rótulo</th>
                  <th className="px-2 py-1.5 text-right">Qtd</th>
                  <th className="px-2 py-1.5 text-right">Custo un.</th>
                  <th className="px-2 py-1.5 text-right">Venda un.</th>
                  <th className="px-2 py-1.5 text-right">Custo total</th>
                  <th className="px-2 py-1.5 text-right">Receita</th>
                  <th className="px-2 py-1.5 text-right">CMV</th>
                </tr>
              </thead>
              <tbody>
                {audit.lines.map((l, i) => (
                  <tr key={i} className="border-t border-border/60">
                    <td className="px-2 py-1.5 text-foreground">
                      {l.name}
                      {l.cost === 0 && l.revenue > 0 && (
                        <span className="ml-1 text-[9px] text-muted-foreground">(sem custo)</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right">{l.qty}</td>
                    <td className="px-2 py-1.5 text-right">R$ {fmtBRL(l.unitCost, 2)}</td>
                    <td className="px-2 py-1.5 text-right">R$ {fmtBRL(l.unitPrice, 2)}</td>
                    <td className="px-2 py-1.5 text-right">R$ {fmtBRL(l.cost, 2)}</td>
                    <td className="px-2 py-1.5 text-right">R$ {fmtBRL(l.revenue, 2)}</td>
                    <td className="px-2 py-1.5 text-right text-primary">
                      {l.revenue > 0 ? `${((l.cost / l.revenue) * 100).toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))}
                {audit.lines.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-2 py-4 text-center text-muted-foreground">
                      Sem vendas registradas em {ml}.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="border-t border-primary/40 bg-card font-semibold">
                <tr>
                  <td className="px-2 py-1.5 text-primary">Total</td>
                  <td className="px-2 py-1.5 text-right">
                    {audit.lines.reduce((s, l) => s + l.qty, 0)}
                  </td>
                  <td />
                  <td />
                  <td className="px-2 py-1.5 text-right">R$ {fmtBRL(audit.cost, 2)}</td>
                  <td className="px-2 py-1.5 text-right">R$ {fmtBRL(audit.revenue, 2)}</td>
                  <td className="px-2 py-1.5 text-right text-primary">{audit.cmv.toFixed(1)}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
      {monthTarget > 0 && (
        <TargetSummary
          label={`Meta de CMV — ${ml}`}
          achieved={cmvMonth}
          target={monthTarget}
          valueSuffix="%"
          decimals={1}
          invert
        />
      )}
      {annualTarget !== null && (
        <TargetSummary
          label="Meta de CMV (ano)"
          achieved={cmvYear}
          target={annualTarget}
          valueSuffix="%"
          decimals={1}
          invert
        />
      )}
      <div className="section-title mt-4">CMV mês a mês — {currentYear} vs {previousYear}</div>
      <BarChart
        curr={cmvByMonth}
        prev={cmvByMonthPrev}
        currentYear={currentYear}
        previousYear={previousYear}
        valueSuffix="%"
        height={260}
        targets={targets.monthly.length === 12 ? targets.monthly : undefined}
      />
    </div>
  );
}


function RolhaPanel({
  amtLast,
  qtyLast,
  amtYear,
  qtyYear,
  lastMonth,
  corkageAmtByYearMonth,
  currentYear,
  previousYear,
  currentMonth,
  targets,
}: {
  amtLast: number;
  qtyLast: number;
  amtYear: number;
  qtyYear: number;
  lastMonth: { year: number; month: number };
  corkageAmtByYearMonth: Record<number, number[]>;
  currentYear: number;
  previousYear: number;
  currentMonth: number;
  targets: TargetSet;
}) {
  const ml = monthLabel(lastMonth.year, lastMonth.month);
  const curr = corkageAmtByYearMonth[currentYear];
  const prev = corkageAmtByYearMonth[previousYear];
  const prevYearTotal = prev.reduce((a, b) => a + b, 0);
  const currAcc = curr.slice(0, currentMonth + 1).reduce((a, b) => a + b, 0);
  const annualTarget = resolveAnnualTarget(targets);
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
        <MiniStat label={`Valor ${currentYear}`} value={`R$ ${fmtBRL(amtYear)}`} />
        <MiniStat label={`${previousYear} completo`} value={`R$ ${fmtBRL(prevYearTotal)}`} />
      </div>
      {annualTarget !== null && (
        <TargetSummary
          label={`Meta anual ${currentYear}`}
          achieved={currAcc}
          target={annualTarget}
          valuePrefix="R$ "
        />
      )}
      <BarChart
        curr={curr}
        prev={prev}
        currentYear={currentYear}
        previousYear={previousYear}
        valuePrefix="R$ "
        height={260}
        targets={targets.monthly.length === 12 ? targets.monthly : undefined}
      />
      <div className="mt-4 rounded-lg border border-dashed border-border bg-[color:var(--surface-2)] p-3 text-center text-[11px] text-muted-foreground">
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
