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
  country: string | null;
  producer: string | null;
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

// Custo unitário efetivo: movimentos importados podem vir com unit_cost 0
// (custo não informado na venda). Nesse caso usamos o custo do cadastro.
const effUnitCost = (
  movCost: number | null | undefined,
  wineCost: number | null | undefined,
) => {
  const m = Number(movCost ?? 0);
  if (m > 0) return m;
  return Number(wineCost ?? 0) || 0;
};
const hasMovCost = (movCost: number | null | undefined) => Number(movCost ?? 0) > 0;

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

const MONTHS_FULL = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

function fullMonthLabel(year: number, monthIdx: number) {
  if (monthIdx < 0) return "—";
  return `${MONTHS_FULL[monthIdx]} ${year}`;
}


function formatDateBR(iso: string) {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
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
  | "rotulos";

export type GuestDashboardData = {
  restaurantName: string;
  wines: WineRow[];
  movements: Movement[];
  corkage: Array<{ reference_year: number; reference_month: number; quantity: number; total_amount: number }>;
  stock: { map: Record<string, number>; lastDate: string | null };
  targets: Array<{
    id: string;
    indicator: string;
    reference_year: number;
    reference_month: number | null;
    target_value: number;
  }>;
};

export function DashboardPage({ guest }: { guest?: GuestDashboardData } = {}) {
  const { restaurantId, activeGroupId, groups, memberships } = useAuth();
  const { ids: scopeIds, isGroup: isGroupScope } = useScopedRestaurantIds();
  const isGroup = guest ? false : isGroupScope;
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
  const { data: authTargets = [] } = useDashboardTargets(guest ? null : restaurantId, currentYear);
  const targets = guest ? guest.targets : authTargets;

  const scopeKey = scopeIds.join(",");
  const enabled = !guest && scopeIds.length > 0;

  const { data: authWines = [] } = useQuery({
    queryKey: ["dash-wines", scopeKey],
    enabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("wines")
        .select("id,name,wine_type,volume,country,producer,cost_price,sale_price,active_on_menu")
        .in("restaurant_id", scopeIds);
      return (data ?? []) as WineRow[];
    },
  });

  const { data: authStock = { map: {}, lastDate: null as string | null } } = useQuery<{ map: Record<string, number>; lastDate: string | null }>({
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
      let lastDate: string | null = null;
      for (const s of sess ?? []) {
        if (!latestByRest.has(s.restaurant_id)) latestByRest.set(s.restaurant_id, s.id);
        if (s.reference_date && (!lastDate || s.reference_date > lastDate)) lastDate = s.reference_date;
      }
      const map: Record<string, number> = {};
      const sessionIds = Array.from(latestByRest.values());
      if (sessionIds.length === 0) return { map, lastDate: null };
      const { data: items } = await supabase
        .from("stock_count_items")
        .select("wine_id, counted_qty")
        .in("session_id", sessionIds);
      for (const it of items ?? []) {
        map[it.wine_id] = (map[it.wine_id] ?? 0) + (it.counted_qty ?? 0);
      }
      return { map, lastDate };
    },
  });
  const wines = guest ? guest.wines : authWines;
  const stockData = guest ? guest.stock : authStock;
  const stockMap = stockData.map;

  const { data: authMovements = [] } = useQuery<Movement[]>({
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
  const { data: authCorkage = [] } = useQuery<CorkageRow[]>({
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

  const movements = guest ? guest.movements : authMovements;
  const corkage = guest ? guest.corkage : authCorkage;


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
      const cost = effUnitCost(m.unit_cost, w?.cost_price);
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

  const activeLabelsCount = wines.filter((w) => w.active_on_menu !== false).length;

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
      key: "rotulos",
      label: "Rótulos Ativos",
      primary: `${activeLabelsCount}`,
      sub: "Na carta",
      info: "Total de rótulos ativos na carta. O painel mostra a composição da carta por tipo, país e vinícola.",
    },
  ];

  const activeGroupName = groups.find((g) => g.id === activeGroupId)?.name;
  const consolidatedUnitCount = isGroup ? memberships.filter((m) => m.groupId === activeGroupId).length : 0;

  const restaurantName = guest
    ? guest.restaurantName
    : memberships.find((m) => m.restaurantId === restaurantId)?.name;
  const mobileTitle = isGroup ? (activeGroupName ?? "Rede") : (restaurantName ?? "Painel de Controle");
  const canEditTargets = !guest && !isGroup;
  const mobilePeriodLabel = period
    ? period.mode === "year"
      ? period.year === currentYear
        ? `Acumulado ${period.year}`
        : `Ano ${period.year}`
      : fullMonthLabel(period.year, period.month)
    : agg.lastRev.month >= 0
      ? fullMonthLabel(agg.lastRev.year, agg.lastRev.month)
      : "Sem dados de vendas";


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

      {/* Mobile header — compact (foco Chef/Owner) */}
      <header className="md:hidden space-y-2.5 border-b border-border pb-3">
        <div className="flex flex-col items-center gap-1.5">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full border"
            style={{
              borderColor: "color-mix(in oklab, var(--gold) 40%, transparent)",
              background: "var(--card-raw)",
              boxShadow: "0 0 15px color-mix(in oklab, var(--wine) 32%, transparent)",
            }}
          >
            <Wine className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-center text-[12px] font-bold uppercase tracking-[0.14em] text-primary">
            {mobileTitle}
          </h1>
          <p className="text-center text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {mobilePeriodLabel}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setDiagOpen(true)}
            className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border border-primary bg-card px-1 text-[9px] font-semibold uppercase tracking-wider text-primary"
          >
            <FileText size={11} /> Diagnóstico
          </button>
          <button
            onClick={() => setPeriodOpen((v) => !v)}
            className={`flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border px-1 text-[9px] font-semibold uppercase tracking-wider ${
              period
                ? "border-primary bg-[color:var(--wine)]/25 text-primary"
                : "border-border bg-card text-primary"
            }`}
          >
            <CalendarRange size={11} className="shrink-0" />
            <span className="truncate">
              {period
                ? period.mode === "year"
                  ? period.year === currentYear
                    ? `Acum. ${String(period.year).slice(-2)}`
                    : `Ano ${String(period.year).slice(-2)}`
                  : monthLabel(period.year, period.month)
                : "Mês / Ano"}
            </span>
          </button>
          {!isGroup && !guest && (

            <button
              onClick={() => setMetasOpen(true)}
              className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border border-border bg-card px-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              <Target size={11} /> Metas
            </button>
          )}
        </div>
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
          {!isGroup && !guest && (
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
            movements={movements}
            wineById={wineById}
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
            guest={!!guest}
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
            guest={!!guest}
          />
        )}
        {tab === "estoque" && (
          <EstoquePanel
            wines={wines}
            stockMap={stockMap}
            totalBottles={agg.stockBottles}
            totalValue={agg.stockValue}
            targets={targetsFor(targets, "estoque")}
            lastStockDate={stockData.lastDate}
            guest={!!guest}
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
            guest={!!guest}
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
            guest={!!guest}
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
            guest={!!guest}
          />
        )}

        {tab === "rotulos" && <RotulosPanel wines={wines} />}
      </div>

      {restaurantId && !guest && (
        <DashboardTargetsEditor
          open={metasOpen}
          onClose={() => setMetasOpen(false)}
          restaurantId={restaurantId}
          year={currentYear}
        />
      )}
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
  movements,
  wineById,
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
  movements: Movement[];
  wineById: Record<string, WineRow>;
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

      <div className="mb-5 border-b border-border pb-4" />

      <div className="grid gap-4 lg:grid-cols-[210px_minmax(0,1fr)_minmax(220px,260px)]">
        <div className="hidden min-w-0 gap-2 md:grid md:grid-cols-2 lg:flex lg:flex-col lg:gap-3">
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
          {/* Acumulado comparativo: abaixo das barras, dentro da área do gráfico */}
          <div className="mt-8 flex flex-col items-center gap-1 text-[11px]">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>
                {monthLabel(currentYear, 0)} - {monthLabel(currentYear, accMonth)}:
              </span>
              <span className="text-foreground">R$ {fmtBRL(currAcc)}</span>
              <span className={diff >= 0 ? "text-primary" : "text-destructive"}>
                {diff >= 0 ? "+" : ""}{diff.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>
                {monthLabel(previousYear, 0)} - {monthLabel(previousYear, accMonth)}:
              </span>
              <span className="text-foreground">R$ {fmtBRL(prevAcc)}</span>
            </div>
          </div>

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

      <div className="grid gap-4 lg:grid-cols-2">
        <TopWinesBlock
          movements={movements}
          wineById={wineById}
          lastMonth={lastMonth}
          currentYear={currentYear}
          totalMonth={bottlesRev + glassesRev + corkageRev}
          totalYear={
            revBottlesByYearMonth[currentYear].reduce((a, b) => a + b, 0) +
            revGlassesByYearMonth[currentYear].reduce((a, b) => a + b, 0) +
            corkageAmtYear
          }
        />
        <RevenueByTypeBlock
          movements={movements}
          wineById={wineById}
          lastMonth={lastMonth}
          currentYear={currentYear}
          totalMonth={bottlesRev + glassesRev + corkageRev}
          totalYear={
            revBottlesByYearMonth[currentYear].reduce((a, b) => a + b, 0) +
            revGlassesByYearMonth[currentYear].reduce((a, b) => a + b, 0) +
            corkageAmtYear
          }
        />
      </div>

      {/* Mobile: metas depois do Top 5 */}
      <div className="mt-3 grid grid-cols-2 gap-2 md:hidden">
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
    </div>

  );
}

const WINE_TYPE_LABEL: Record<string, string> = {
  red: "Tinto",
  white: "Branco",
  rose: "Rosé",
  sparkling: "Espumante",
  dessert: "Sobremesa",
  fortified: "Fortificado",
};

const TOP_COLORS = ["var(--gold)", "var(--wine)", "#f1e788", "#c9a8a8", "#4a0404"];

function TopWinesBlock({
  movements,
  wineById,
  lastMonth,
  currentYear,
  totalMonth,
  totalYear,
}: {
  movements: Movement[];
  wineById: Record<string, WineRow>;
  lastMonth: { year: number; month: number };
  currentYear: number;
  totalMonth: number;
  totalYear: number;
}) {
  const [mode, setMode] = useState<"mes" | "ano">("mes");
  const useMonth = mode === "mes" && lastMonth.month >= 0;

  const rows = useMemo(() => {
    const acc = new Map<string, { qty: number; rev: number; cost: number }>();
    for (const m of movements) {
      const w = wineById[m.wine_id];
      if (!w || isGlassVol(w.volume)) continue;
      const dt = new Date(m.occurred_at);
      if (useMonth) {
        if (dt.getFullYear() !== lastMonth.year || dt.getMonth() !== lastMonth.month) continue;
      } else if (dt.getFullYear() !== currentYear) continue;
      const qty = Number(m.quantity) || 0;
      const rev = qty * (Number(m.unit_price) || 0);
      const unitCost = effUnitCost(m.unit_cost, w.cost_price);
      const cur = acc.get(m.wine_id) ?? { qty: 0, rev: 0, cost: 0 };
      cur.qty += qty;
      cur.rev += rev;
      cur.cost += qty * unitCost;
      acc.set(m.wine_id, cur);
    }
    return Array.from(acc.entries())
      .map(([id, v]) => ({ id, wine: wineById[id], ...v }))
      .sort((a, b) => b.rev - a.rev)
      .slice(0, 5);
  }, [movements, wineById, useMonth, lastMonth.year, lastMonth.month, currentYear]);

  const base = useMonth ? totalMonth : totalYear;
  const topSum = rows.reduce((a, r) => a + r.rev, 0);
  const others = Math.max(base - topSum, 0);

  const slices = [
    ...rows.map((r, i) => ({
      label: r.wine?.name ?? "—",
      value: r.rev,
      color: TOP_COLORS[i % TOP_COLORS.length],
    })),
    { label: "Outros", value: others, color: "#2a2a2a" },
  ];

  return (
    <div className="rounded-lg border border-border bg-[color:var(--surface-2)]/40 p-4">
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          Top 5 Rótulos no Faturamento
        </div>
        <div className="flex overflow-hidden rounded-md border border-border text-[10px]">
          <button
            onClick={() => setMode("mes")}
            className={`px-2 py-1 ${mode === "mes" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary"}`}
          >
            Mês
          </button>
          <button
            onClick={() => setMode("ano")}
            className={`px-2 py-1 ${mode === "ano" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary"}`}
          >
            Ano
          </button>
        </div>
      </div>
      <div className="mb-4 text-[10px] text-muted-foreground">
        {useMonth ? `Referência: ${monthLabel(lastMonth.year, lastMonth.month)}` : `Acumulado ${currentYear}`}
        {" · "}exclui vendas em taças
      </div>

      <div className="flex flex-col items-center gap-4">
        <PieSvg slices={slices} />

        <div className="w-full min-w-0 space-y-1.5">
          {rows.length === 0 && (
            <div className="text-[11px] text-muted-foreground">Sem vendas no período.</div>
          )}
          {rows.length > 0 && (
            <div className="hidden items-center gap-3 px-2.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground md:flex">
              <span className="h-2.5 w-2.5 shrink-0" />
              <div className="min-w-0 flex-1">Rótulo</div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="w-12 text-right">% fat.</span>
                <span className="w-14 text-right">Garrafas</span>
                <span className="w-20 text-right">Faturam.</span>
                <span className="w-20 text-right">CMV</span>
              </div>
            </div>
          )}
          {rows.map((r, i) => {
            const pct = base > 0 ? (r.rev / base) * 100 : 0;
            const cmv = r.rev > 0 ? (r.cost / r.rev) * 100 : 0;
            const type = r.wine?.wine_type ? WINE_TYPE_LABEL[r.wine.wine_type] ?? r.wine.wine_type : null;
            const cells = [
              { label: "% fat.", value: `${pct.toFixed(1)}%`, cls: "font-semibold text-primary", w: "md:w-12" },
              { label: "Garrafas", value: `${fmtBRL(r.qty)}`, cls: "text-muted-foreground", w: "md:w-14" },
              { label: "Faturam.", value: `R$ ${fmtBRL(r.rev)}`, cls: "", w: "md:w-20" },
              { label: "CMV", value: `${cmv.toFixed(1)}%`, cls: "text-muted-foreground", w: "md:w-20" },
            ];
            return (
              <div
                key={r.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border/60 bg-card px-2.5 py-2"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: TOP_COLORS[i % TOP_COLORS.length] }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-medium">{r.wine?.name ?? "—"}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {[type, r.wine?.volume].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <div className="grid w-full grid-cols-4 gap-1 text-[10px] md:flex md:w-auto md:shrink-0 md:items-center md:gap-3 md:text-[11px]">
                  {cells.map((c) => (
                    <div key={c.label} className={`min-w-0 text-right ${c.w}`}>
                      <div className="truncate text-[8px] uppercase tracking-wider text-muted-foreground md:hidden">
                        {c.label}
                      </div>
                      <div className={`truncate ${c.cls}`}>{c.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

function RevenueByTypeBlock({
  movements,
  wineById,
  lastMonth,
  currentYear,
  totalMonth,
  totalYear,
}: {
  movements: Movement[];
  wineById: Record<string, WineRow>;
  lastMonth: { year: number; month: number };
  currentYear: number;
  totalMonth: number;
  totalYear: number;
}) {
  const [mode, setMode] = useState<"mes" | "ano">("mes");
  const useMonth = mode === "mes" && lastMonth.month >= 0;

  const rows = useMemo(() => {
    const acc = new Map<string, { qty: number; rev: number; cost: number }>();
    for (const m of movements) {
      const w = wineById[m.wine_id];
      if (!w) continue;
      const dt = new Date(m.occurred_at);
      if (useMonth) {
        if (dt.getFullYear() !== lastMonth.year || dt.getMonth() !== lastMonth.month) continue;
      } else if (dt.getFullYear() !== currentYear) continue;
      const qty = Number(m.quantity) || 0;
      const rev = qty * (Number(m.unit_price) || 0);
      const unitCost = effUnitCost(m.unit_cost, w.cost_price);
      const label = WINE_TYPE_LABEL[w.wine_type || ""] ?? "Outros";
      const cur = acc.get(label) ?? { qty: 0, rev: 0, cost: 0 };
      cur.qty += qty;
      cur.rev += rev;
      cur.cost += qty * unitCost;
      acc.set(label, cur);
    }
    return Array.from(acc.entries())
      .map(([label, v]) => ({ label, ...v }))
      .sort((a, b) => b.rev - a.rev);
  }, [movements, wineById, useMonth, lastMonth.year, lastMonth.month, currentYear]);

  const base = useMonth ? totalMonth : totalYear;
  const topSum = rows.reduce((a, r) => a + r.rev, 0);
  const others = Math.max(base - topSum, 0);
  const slices = [
    ...rows.map((r, i) => ({
      label: r.label,
      value: r.rev,
      color: TYPE_COLORS[r.label] ?? SERIES_COLORS[i % SERIES_COLORS.length],
    })),
    { label: "Outros", value: others, color: "#2a2a2a" },
  ];

  return (
    <div className="rounded-lg border border-border bg-[color:var(--surface-2)]/40 p-4">
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          Faturamento por Tipo
        </div>
        <div className="flex overflow-hidden rounded-md border border-border text-[10px]">
          <button
            onClick={() => setMode("mes")}
            className={`px-2 py-1 ${mode === "mes" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary"}`}
          >
            Mês
          </button>
          <button
            onClick={() => setMode("ano")}
            className={`px-2 py-1 ${mode === "ano" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary"}`}
          >
            Ano
          </button>
        </div>
      </div>
      <div className="mb-4 text-[10px] text-muted-foreground">
        {useMonth ? `Referência: ${monthLabel(lastMonth.year, lastMonth.month)}` : `Acumulado ${currentYear}`}
      </div>

      <div className="flex flex-col items-center gap-4">
        <PieSvg slices={slices} />
        <div className="w-full space-y-1.5">
          {rows.length === 0 && (
            <div className="text-[11px] text-muted-foreground">Sem vendas no período.</div>
          )}
          {rows.length > 0 && (
            <div className="hidden items-center gap-3 px-2.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground md:flex">
              <span className="h-2.5 w-2.5 shrink-0" />
              <div className="min-w-0 flex-1">Tipo</div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="w-12 text-right">% fat.</span>
                <span className="w-14 text-right">Garrafas</span>
                <span className="w-14 text-right">CMV</span>
              </div>
            </div>
          )}
          {rows.map((r, i) => {
            const pct = base > 0 ? (r.rev / base) * 100 : 0;
            const cmv = r.rev > 0 ? (r.cost / r.rev) * 100 : 0;
            const color = TYPE_COLORS[r.label] ?? SERIES_COLORS[i % SERIES_COLORS.length];
            const cells = [
              { label: "% fat.", value: `${pct.toFixed(1)}%`, cls: "font-semibold text-primary", w: "md:w-12" },
              { label: "Garrafas", value: `${fmtBRL(r.qty)}`, cls: "text-muted-foreground", w: "md:w-14" },
              { label: "CMV", value: `${cmv.toFixed(1)}%`, cls: "text-muted-foreground", w: "md:w-14" },
            ];
            return (
              <div
                key={r.label}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border/60 bg-card px-2.5 py-2"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-medium">{r.label}</div>
                </div>
                <div className="grid w-full grid-cols-3 gap-1 text-[10px] md:flex md:w-auto md:shrink-0 md:items-center md:gap-3 md:text-[11px]">
                  {cells.map((c) => (
                    <div key={c.label} className={`min-w-0 text-right ${c.w}`}>
                      <div className="truncate text-[8px] uppercase tracking-wider text-muted-foreground md:hidden">
                        {c.label}
                      </div>
                      <div className={`truncate ${c.cls}`}>{c.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function PieSvg({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((a, s) => a + (s.value || 0), 0);
  const size = 180;
  const r = 78;
  const cx = size / 2;
  const cy = size / 2;
  let acc = 0;
  const paths = total > 0
    ? slices.filter((s) => s.value > 0).map((s) => {
        const frac = s.value / total;
        const startAngle = acc * 2 * Math.PI;
        const endAngle = (acc + frac) * 2 * Math.PI;
        acc += frac;
        const large = frac > 0.5 ? 1 : 0;
        const x1 = cx + r * Math.sin(startAngle);
        const y1 = cy - r * Math.cos(startAngle);
        const x2 = cx + r * Math.sin(endAngle);
        const y2 = cy - r * Math.cos(endAngle);
        const d =
          frac >= 0.9999
            ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
            : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
        return { d, color: s.color };
      })
    : [];

  if (total <= 0) {
    return (
      <div
        className="flex items-center justify-center rounded-full border border-dashed border-border text-[10px] text-muted-foreground"
        style={{ width: size, height: size }}
      >
        Sem dados
      </div>
    );
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.color} stroke="var(--card)" strokeWidth={1.5} />
      ))}
    </svg>
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
  guest,
}: {
  title: string;
  unit: string;
  byYearMonth: Record<number, number[]>;
  currentYear: number;
  previousYear: number;
  currentMonth: number;
  targets: TargetSet;
  guest?: boolean;
}) {
  const curr = byYearMonth[currentYear];
  const prev = byYearMonth[previousYear];
  const currTotal = curr.reduce((a, b) => a + b, 0);
  const prevTotal = prev.reduce((a, b) => a + b, 0);
  const currAcc = curr.slice(0, currentMonth + 1).reduce((a, b) => a + b, 0);
  const annualTarget = resolveAnnualTarget(targets);
  const accMonth = Math.max(currentMonth - 1, 0);
  const accCurr = curr.slice(0, accMonth + 1).reduce((a, b) => a + b, 0);
  const accPrev = prev.slice(0, accMonth + 1).reduce((a, b) => a + b, 0);
  const accDiff = accPrev > 0 ? ((accCurr - accPrev) / accPrev) * 100 : 0;

  return (
    <div>
      <SectionHeader
        icon={<TrendingUp size={14} />}
        title={title}
        subtitle="Comparativo mensal com o ano anterior."
      />
      {!guest && (
        <div className="mb-5 grid grid-cols-2 gap-3">
          <MiniStat label={`Acumulado ${currentYear}`} value={`${currTotal} ${unit}`} tone="primary" />
          <MiniStat label={`${previousYear} completo`} value={`${prevTotal} ${unit}`} />
        </div>
      )}
      <div className={annualTarget !== null ? "grid gap-4 lg:grid-cols-[1fr_minmax(200px,240px)]" : "grid gap-4"}>
        <div>
          <BarChart
            curr={curr}
            prev={prev}
            currentYear={currentYear}
            previousYear={previousYear}
            valueSuffix={` ${unit}`}
            toggleLabel="Und"
            height={240}
            targets={targets.monthly.length === 12 ? targets.monthly : undefined}
          />
          <div className="mt-8 flex flex-col items-center gap-1 text-[11px]">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>
                {monthLabel(currentYear, 0)} - {monthLabel(currentYear, accMonth)}:
              </span>
              <span className="text-foreground">
                {accCurr} {unit}
              </span>
              <span className={accDiff >= 0 ? "text-primary" : "text-destructive"}>
                {accDiff >= 0 ? "+" : ""}
                {accDiff.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>
                {monthLabel(previousYear, 0)} - {monthLabel(previousYear, accMonth)}:
              </span>
              <span className="text-foreground">
                {accPrev} {unit}
              </span>
            </div>
          </div>
        </div>
        {annualTarget !== null && (
          <TargetSummary
            label={`Meta anual ${currentYear}`}
            achieved={currAcc}
            target={annualTarget}
            valueSuffix={` ${unit}`}
          />
        )}
      </div>
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

export function BarChart({
  curr,
  prev,
  currentYear,
  previousYear,
  valuePrefix = "",
  valueSuffix = "",
  toggleLabel,
  height = 260,
  targets,
}: {
  curr: number[];
  prev: number[];
  currentYear: number;
  previousYear: number;
  valuePrefix?: string;
  valueSuffix?: string;
  toggleLabel?: string;
  height?: number;
  targets?: number[];
}) {
  const hasTargets = !!targets && targets.some((t) => t > 0);
  const targetsForMax = hasTargets ? targets!.filter((t) => t > 0) : [];
  const rawMax = Math.max(1, ...curr, ...prev, ...targetsForMax);
  const maxVal = niceMax(rawMax);
  // Interruptor deslizante: desligado mostra apenas as barras; ligado mostra os valores.
  const [showValues, setShowValues] = useState(false);
  const toggleText = toggleLabel ?? (valueSuffix ? "" : "R$");

  const axisWidth = 0;
  const fmtFull = (n: number) =>
    n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

  return (
    <div>
      <div className="relative w-full" style={{ height }}>
        {/* Squared grid background (same look as wine sales chart) */}
        <div className="absolute inset-0" style={{ paddingLeft: axisWidth, paddingBottom: 22 }}>
          <div
            className="relative h-full w-full rounded-md"
            style={{
              backgroundImage: `linear-gradient(to right, color-mix(in oklab, var(--gold) 16%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--gold) 16%, transparent) 1px, transparent 1px)`,
              backgroundSize: "22px 22px",
              border: "1px solid color-mix(in oklab, var(--gold) 22%, transparent)",
            }}
          >
            {/* Interruptor de valores — canto superior direito, por dentro do gráfico */}
            <button
              type="button"
              onClick={() => setShowValues((v) => !v)}
              title={showValues ? "Ocultar valores das vendas" : "Mostrar valores das vendas"}
              aria-pressed={showValues}
              aria-label={showValues ? "Ocultar valores das vendas" : "Mostrar valores das vendas"}
              className="absolute right-1.5 top-1.5 z-20 flex items-center gap-1.5 rounded-full border px-1.5 py-1 transition-colors"
              style={{
                borderColor: showValues
                  ? "color-mix(in oklab, var(--gold) 45%, transparent)"
                  : "color-mix(in oklab, var(--gray-border) 80%, transparent)",
                background: "color-mix(in oklab, var(--bg-raw) 70%, transparent)",
                backdropFilter: "blur(4px)",
              }}
            >
              <span
                className="relative block h-3.5 w-7 rounded-full transition-colors duration-200"
                style={{
                  background: showValues
                    ? "linear-gradient(90deg, var(--wine), var(--gold))"
                    : "#2a2a2a",
                }}
              >
                <span
                  className="absolute top-0.5 h-2.5 w-2.5 rounded-full transition-all duration-200"
                  style={{
                    left: showValues ? "16px" : "3px",
                    background: showValues ? "var(--gold)" : "#777",
                    boxShadow: showValues ? "0 0 6px color-mix(in oklab, var(--gold) 60%, transparent)" : "none",
                  }}
                />
              </span>
              {toggleText && (
                <span
                  className="pr-0.5 text-[8px] font-bold uppercase tracking-wider transition-colors"
                  style={{ color: showValues ? "var(--gold)" : "var(--text-kpi)" }}
                >
                  {toggleText}
                </span>
              )}
            </button>

            {/* Target step-line: painted BEHIND the bars */}
            {hasTargets && (
              <div className="pointer-events-none absolute inset-0 flex pt-6" style={{ zIndex: 0 }}>
                {MONTHS.map((mo, i) => {
                  const tVal = targets?.[i] ?? 0;
                  const tPct = tVal > 0 ? (tVal / maxVal) * 100 : 0;
                  return (
                    <div key={mo} className="relative h-full flex-1">
                      {tVal > 0 && (
                        <div
                          className="absolute left-0 right-0"
                          style={{ bottom: `${tPct}%`, borderTop: "1px solid #e5484d" }}
                          title={`Meta ${mo}: ${valuePrefix}${fmtBRL(tVal)}${valueSuffix}`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bars */}
            <div className="absolute inset-0 flex items-end justify-between gap-2 px-1.5 pt-6" style={{ zIndex: 2 }}>
              {MONTHS.map((mo, i) => {
                const cPct = (curr[i] / maxVal) * 100;
                const pPct = (prev[i] / maxVal) * 100;
                const tVal = targets?.[i] ?? 0;
                return (
                  <div key={mo} className="relative flex h-full min-w-0 flex-1 items-end justify-center gap-0.5">
                    <div
                      className="relative flex w-2/5 justify-center rounded-t transition-all"
                      style={{
                        height: prev[i] > 0 ? `max(2px, ${pPct}%)` : "0%",
                        background: "linear-gradient(180deg, #dcdcdc, #7a7a7a)",
                      }}
                      title={`${previousYear}: ${valuePrefix}${fmtBRL(prev[i])}${valueSuffix}`}
                    >
                      {showValues && prev[i] > 0 && (
                        <span className="absolute bottom-full z-10 mb-1 whitespace-nowrap rounded bg-[color:var(--card)] px-1 text-[9px] font-semibold leading-none tabular-nums text-muted-foreground">
                          {fmtFull(prev[i])}
                        </span>
                      )}
                    </div>

                    <div
                      className="relative flex w-2/5 justify-center rounded-t transition-all"
                      style={{
                        height: `${cPct}%`,
                        background: "linear-gradient(180deg, var(--gold), var(--wine))",
                      }}
                      title={`${currentYear}: ${valuePrefix}${fmtBRL(curr[i])}${valueSuffix}${
                        tVal > 0 ? ` • Meta: ${valuePrefix}${fmtBRL(tVal)}${valueSuffix}` : ""
                      }`}
                    >
                      {showValues && curr[i] > 0 && (
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
            style={{ background: "linear-gradient(180deg, #dcdcdc, #7a7a7a)" }}
          />
          <span className="text-muted-foreground">{previousYear}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ background: "linear-gradient(180deg, var(--gold), var(--wine))" }}
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
  lastStockDate,
  guest,
}: {
  wines: WineRow[];
  stockMap: Record<string, number>;
  totalBottles: number;
  totalValue: number;
  targets: TargetSet;
  lastStockDate?: string | null;
  guest?: boolean;
}) {
  const byType: Record<string, { bottles: number; value: number }> = {};
  let totalCost = 0;
  for (const w of wines) {
    if (isGlassVol(w.volume)) continue;
    const q = stockMap[w.id] ?? 0;
    const t = w.wine_type || "Outros";
    if (!byType[t]) byType[t] = { bottles: 0, value: 0 };
    byType[t].bottles += q;
    byType[t].value += q * (Number(w.cost_price) || 0);
    totalCost += q * (Number(w.cost_price) || 0);
  }
  const rows = Object.entries(byType).sort((a, b) => b[1].value - a[1].value);
  const annualTarget = resolveAnnualTarget(targets);
  const dateLabel = lastStockDate ? formatDateBR(lastStockDate) : null;
  const subtitle = dateLabel
    ? `Consolidação da última contagem fechada em ${dateLabel}.`
    : "Consolidação da última contagem fechada.";

  return (
    <div>
      <SectionHeader icon={<Package size={14} />} title="Estoque em adega" subtitle={subtitle} />
      {!guest && (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3">
          <MiniStat label="Garrafas em estoque" value={`${totalBottles}`} tone="primary" />
          <MiniStat label="Valor de venda" value={`R$ ${fmtBRL(totalValue)}`} />
          <MiniStat label="Valor de custo" value={`R$ ${fmtBRL(totalCost)}`} />
        </div>
      )}
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
            <th className="py-2 text-right">Valor de custo (R$)</th>
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
      {guest && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-md border border-border bg-[color:var(--surface-2)] p-2 text-center">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Garrafas</div>
            <div className="mt-0.5 text-sm font-bold text-primary">{totalBottles}</div>
          </div>
          <div className="rounded-md border border-border bg-[color:var(--surface-2)] p-2 text-center">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Vl. venda</div>
            <div className="mt-0.5 text-sm font-bold text-primary">R$ {fmtBRL(totalValue)}</div>
          </div>
          <div className="rounded-md border border-border bg-[color:var(--surface-2)] p-2 text-center">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Vl. custo</div>
            <div className="mt-0.5 text-sm font-bold text-primary">R$ {fmtBRL(totalCost)}</div>
          </div>
        </div>
      )}
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
  guest,
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
  guest?: boolean;
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
      {!guest && (
        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <MiniStat label={`Geral — ${ml}`} value={`R$ ${fmtBRL(avgAll)}`} tone="primary" />
          <MiniStat label={`Garrafa — ${ml}`} value={`R$ ${fmtBRL(avgBottle)}`} />
          <MiniStat label={`Taça — ${ml}`} value={`R$ ${fmtBRL(avgGlass)}`} />
          <MiniStat label="Geral (ano)" value={`R$ ${fmtBRL(avgAllYear)}`} />
          <MiniStat label="Garrafa (ano)" value={`R$ ${fmtBRL(avgBottleYear)}`} />
          <MiniStat label="Taça (ano)" value={`R$ ${fmtBRL(avgGlassYear)}`} />
        </div>
      )}

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
  guest,
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
  guest?: boolean;
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
      const unitCost = effUnitCost(m.unit_cost, w?.cost_price);
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
        prev.costFallback = prev.costFallback || !hasMovCost(m.unit_cost);
      } else {
        map.set(key, {
          name: w?.name ?? "Rótulo removido",
          qty: q,
          unitCost,
          unitPrice: price,
          cost: c,
          revenue: r,
          costFallback: !hasMovCost(m.unit_cost),
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
      {!guest && (
        <div className="mb-3 rounded-lg border border-dashed border-border bg-[color:var(--surface-2)] p-3 text-[11px] text-muted-foreground">
          <span className="font-semibold text-primary">Como o CMV é calculado:</span> soma do
          (custo unitário × quantidade vendida) ÷ soma do (preço de venda × quantidade vendida), somente
          vendas de vinho do mês. A taxa de rolha fica fora (não tem custo de mercadoria). O custo usado é o
          <em> custo histórico registrado na venda</em>; quando a venda não tem custo gravado, cai para o
          custo atual do cadastro do rótulo — se o rótulo estiver com custo zerado, o CMV cai
          artificialmente.
        </div>
      )}
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
      <div className={`mb-4 rounded-lg border border-border bg-[color:var(--surface-2)] p-3 ${guest ? "hidden" : ""}`}>
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
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="min-w-0">
          <div className="section-title">CMV mês a mês — {currentYear} vs {previousYear}</div>
          <BarChart
            curr={cmvByMonth}
            prev={cmvByMonthPrev}
            currentYear={currentYear}
            previousYear={previousYear}
            valueSuffix="%"
            toggleLabel="%"
            height={260}
            targets={targets.monthly.length === 12 ? targets.monthly : undefined}
          />
        </div>
        <div className="min-w-0">
          <CmvByTypeChart
            movements={movements}
            wineById={wineById}
            lastMonth={lastMonth}
            currentYear={currentYear}
          />
        </div>
      </div>
    </div>
  );
}

const CMV_TYPE_GROUPS: { key: string; label: string; color: string }[] = [
  { key: "espumante", label: "Espumante", color: "#eeeeee" },
  { key: "rose", label: "Rosé", color: "#ff8da1" },
  { key: "tinto", label: "Tinto", color: "var(--wine)" },
  { key: "branco", label: "Branco", color: "#f1e788" },
  { key: "laranja", label: "Laranja", color: "#d97706" },
  { key: "licoroso", label: "Licoroso", color: "#7c2d12" },
  { key: "fortificado", label: "Fortificado", color: "#92400e" },
  { key: "sidra", label: "Sidra", color: "#a3e635" },
  { key: "glass", label: "Taças", color: "var(--gold)" },
  { key: "outros", label: "Outros", color: "#666666" },
];

/** Normaliza o tipo do vinho (que vem em PT-BR livre) para uma chave canônica. */
function normalizeWineType(wt: string | null | undefined): string {
  if (!wt) return "outros";
  const s = wt.toLowerCase().trim();
  if (!s || s === "qualquer") return "outros";
  if (s.includes("tinto") || s === "red") return "tinto";
  if (s.includes("branco") || s === "white") return "branco";
  if (s.includes("espumante") || s.includes("sparkling")) return "espumante";
  if (s.includes("ros")) return "rose";
  if (s.includes("laranja") || s.includes("orange")) return "laranja";
  if (s.includes("licor") || s.includes("liqueur") || s.includes("dessert") || s.includes("sobremesa")) return "licoroso";
  if (s.includes("fortif")) return "fortificado";
  if (s.includes("sidra") || s.includes("cider")) return "sidra";
  return "outros";
}

function CmvByTypeChart({
  movements,
  wineById,
  lastMonth,
  currentYear,
}: {
  movements: Movement[];
  wineById: Record<string, WineRow>;
  lastMonth: { year: number; month: number };
  currentYear: number;
}) {
  const [mode, setMode] = useState<"mes" | "ano">("mes");
  const useMonth = mode === "mes" && lastMonth.month >= 0;

  const data = useMemo(() => {
    const acc: Record<string, { cost: number; rev: number }> = {};
    for (const g of CMV_TYPE_GROUPS) acc[g.key] = { cost: 0, rev: 0 };
    for (const m of movements) {
      const d = new Date(m.occurred_at);
      if (useMonth) {
        if (d.getFullYear() !== lastMonth.year || d.getMonth() !== lastMonth.month) continue;
      } else if (d.getFullYear() !== currentYear) continue;
      const w = wineById[m.wine_id];
      if (!w) continue;
      const key = isGlassVol(w.volume) ? "glass" : normalizeWineType(w.wine_type);
      if (!acc[key]) acc[key] = { cost: 0, rev: 0 };
      const q = m.quantity ?? 0;
      acc[key].cost += effUnitCost(m.unit_cost, w.cost_price) * q;
      acc[key].rev += Number(m.unit_price ?? w.sale_price ?? 0) * q;
    }
    const mapped = CMV_TYPE_GROUPS.map((g) => ({
      ...g,
      cmv: acc[g.key].rev > 0 ? (acc[g.key].cost / acc[g.key].rev) * 100 : 0,
      rev: acc[g.key].rev,
    }))
      .filter((d) => d.rev > 0)
      .sort((a, b) => b.cmv - a.cmv); // maior à esquerda, menor à direita
    return mapped;
  }, [movements, wineById, useMonth, lastMonth.year, lastMonth.month, currentYear]);

  const max = niceMax(Math.max(...data.map((d) => d.cmv), 10));
  const height = 260;
  const plot = height - 46;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="section-title mb-0 border-0 pb-0">CMV por tipo</div>
        <div className="flex overflow-hidden rounded-md border border-border text-[10px]">
          <button
            onClick={() => setMode("mes")}
            className={`px-2 py-1 ${mode === "mes" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary"}`}
          >
            Mês
          </button>
          <button
            onClick={() => setMode("ano")}
            className={`px-2 py-1 ${mode === "ano" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary"}`}
          >
            Ano
          </button>
        </div>
      </div>
      <div className="mb-3 text-[10px] text-muted-foreground">
        {useMonth ? `Referência: ${monthLabel(lastMonth.year, lastMonth.month)}` : `Acumulado ${currentYear}`}
      </div>
      {data.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-[color:var(--surface-2)]/40 text-[11px] text-muted-foreground" style={{ height }}>
          Sem vendas no período
        </div>
      ) : (
        <div
          className="flex items-end justify-around gap-2 rounded-lg border border-border bg-[color:var(--surface-2)]/40 p-3"
          style={{ height }}
        >
          {data.map((d) => {
            const h = max > 0 ? Math.max((d.cmv / max) * plot, d.cmv > 0 ? 3 : 0) : 0;
            return (
              <div key={d.key} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] font-semibold text-foreground">
                  {d.cmv > 0 ? `${d.cmv.toFixed(1)}%` : "—"}
                </span>
                <div
                  className="w-full max-w-[38px] rounded-t-sm"
                  style={{ height: h, background: d.color }}
                  title={`${d.label}: CMV ${d.cmv.toFixed(1)}% · receita R$ ${fmtBRL(d.rev)}`}
                />
                <span className="truncate text-[9px] uppercase tracking-wide text-muted-foreground">
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
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
  guest,
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
  guest?: boolean;
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
      {!guest && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <MiniStat label={`Valor — ${ml}`} value={`R$ ${fmtBRL(amtLast)}`} tone="primary" />
          <MiniStat label={`Qtd — ${ml}`} value={`${qtyLast}`} />
          <MiniStat label={`Valor ${currentYear}`} value={`R$ ${fmtBRL(amtYear)}`} />
          <MiniStat label={`${previousYear} completo`} value={`R$ ${fmtBRL(prevYearTotal)}`} />
        </div>
      )}
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

const TYPE_COLORS: Record<string, string> = {
  Espumante: "#eeeeee",
  Branco: "#f1e788",
  "Rosé": "#ff8da1",
  Tinto: "#800020",
  Fortificado: "#4a0404",
  Outros: "#7a7a7a",
};

const SERIES_COLORS = [
  "#D4AF37", "#800020", "#f1e788", "#a8763e", "#4a0404",
  "#e0c26a", "#5c5c5c", "#ff8da1", "#8a6d1f", "#c9c9c9",
];

function is750 (v: string | null | undefined) {
  if (!v) return false;
  const n = Number(String(v).replace(/[^0-9]/g, ""));
  return n === 750;
}

function labelTypeBucket(w: WineRow) {
  if (isGlassVol(w.volume) || !is750(w.volume)) return "Outros";
  const t = (w.wine_type || "").trim().toLowerCase();
  if (t.startsWith("espum")) return "Espumante";
  if (t.startsWith("branc")) return "Branco";
  if (t.startsWith("ros")) return "Rosé";
  if (t.startsWith("tint")) return "Tinto";
  if (t.startsWith("forti")) return "Fortificado";
  return "Outros";
}

function countBy(wines: WineRow[], keyOf: (w: WineRow) => string) {
  const map = new Map<string, number>();
  for (const w of wines) {
    const k = keyOf(w) || "Não informado";
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

function CompositionCard({
  title,
  entries,
  total,
  colorOf,
  limit,
}: {
  title: string;
  entries: Array<[string, number]>;
  total: number;
  colorOf: (label: string, i: number) => string;
  limit?: number;
}) {
  let rows = entries;
  if (limit && entries.length > limit) {
    const head = entries.slice(0, limit);
    const rest = entries.slice(limit).reduce((a, b) => a + b[1], 0);
    rows = [...head, ["Outros", rest] as [string, number]];
  }
  const slices = rows.map(([label, value], i) => ({ label, value, color: colorOf(label, i) }));
  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card p-4">
      <div className="section-title mb-3">{title}</div>
      <div className="flex flex-1 flex-col items-center gap-3">
        <PieSvg slices={slices} />
        <div className="w-full space-y-1.5">
          {slices.map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-2 text-[11px]">
              <div className="flex min-w-0 items-center gap-2">
                <span className="inline-block h-3 w-3 shrink-0 rounded" style={{ background: s.color }} />
                <span className="truncate text-muted-foreground">{s.label}</span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-semibold text-foreground">{s.value}</span>
                <span className="w-12 text-right font-semibold text-primary">
                  {total > 0 ? ((s.value / total) * 100).toFixed(1) : "0.0"}%
                </span>
              </div>
            </div>
          ))}
          {slices.length === 0 && (
            <div className="py-4 text-center text-[11px] text-muted-foreground">Sem rótulos ativos.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function RotulosPanel({ wines }: { wines: WineRow[] }) {
  const active = wines.filter((w) => w.active_on_menu !== false);
  const total = active.length;

  const typeOrder = ["Espumante", "Branco", "Rosé", "Tinto", "Fortificado", "Outros"];
  const typeCounts = countBy(active, labelTypeBucket);
  const typeEntries = typeOrder
    .map((t) => [t, typeCounts.find(([k]) => k === t)?.[1] ?? 0] as [string, number])
    .filter(([, v]) => v > 0);

  const countryEntries = countBy(active, (w) => (w.country || "").trim());
  const producerEntries = countBy(active, (w) => (w.producer || "").trim());

  return (
    <div>
      <SectionHeader
        icon={<Tag size={14} />}
        title="Rótulos ativos na carta"
        subtitle={`${total} rótulo${total !== 1 ? "s" : ""} ativo${total !== 1 ? "s" : ""}. Taças e garrafas com volume diferente de 750 ml entram em "Outros".`}
      />
      <div className="flex flex-wrap items-stretch justify-center gap-3 md:gap-4">
        {[
          <CompositionCard
            key="tipo"
            title="Composição da carta"
            entries={typeEntries}
            total={total}
            colorOf={(label, i) => TYPE_COLORS[label] ?? SERIES_COLORS[i % SERIES_COLORS.length]}
          />,
          <CompositionCard
            key="pais"
            title="Composição por país"
            entries={countryEntries}
            total={total}
            limit={8}
            colorOf={(_l, i) => SERIES_COLORS[i % SERIES_COLORS.length]}
          />,
          <CompositionCard
            key="vinicola"
            title="Composição por vinícola"
            entries={producerEntries}
            total={total}
            limit={9}
            colorOf={(_l, i) => SERIES_COLORS[i % SERIES_COLORS.length]}
          />,
        ].map((card) => (
          <div key={(card as any).key} className="w-full max-w-[300px] min-w-[240px] flex-1">
            {card}
          </div>
        ))}
      </div>
    </div>
  );
}
