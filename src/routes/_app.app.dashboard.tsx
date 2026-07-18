import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  DollarSign,
  TrendingUp,
  Activity,
  AlertTriangle,
  Plus,
  Minus,
  Calculator,
  Percent,
  Sparkles,
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
  count_in_stock: boolean | null;
};

const isGlassVol = (v: string | null | undefined) =>
  !!v && /taça|taca|glass/i.test(v);

function fmtBRL(n: number, digits = 2) {
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function DashboardPage() {
  const { restaurantId } = useAuth();

  const { data: wines = [] } = useQuery({
    queryKey: ["dash-wines", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("wines")
        .select(
          "id,name,wine_type,volume,cost_price,sale_price,active_on_menu,count_in_stock",
        )
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
        .select("id, reference_date")
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

  const { data: monthlySalesMap = {} } = useQuery<Record<string, number>>({
    queryKey: ["dash-monthly-avg", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const now = new Date();
      const start = new Date(
        now.getFullYear(),
        now.getMonth() - 11,
        1,
      ).toISOString();
      const { data } = await supabase
        .from("inventory_movements")
        .select("wine_id, quantity, occurred_at")
        .eq("restaurant_id", restaurantId!)
        .eq("movement_type", "sale")
        .gte("occurred_at", start);
      const byWine: Record<string, Record<string, number>> = {};
      for (const m of data ?? []) {
        const d = new Date(m.occurred_at as string);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (!byWine[m.wine_id]) byWine[m.wine_id] = {};
        byWine[m.wine_id][key] =
          (byWine[m.wine_id][key] ?? 0) + (m.quantity ?? 0);
      }
      const map: Record<string, number> = {};
      for (const wid of Object.keys(byWine)) {
        const months = Object.values(byWine[wid]);
        const total = months.reduce((a, b) => a + b, 0);
        map[wid] = months.length ? Math.round(total / months.length) : 0;
      }
      return map;
    },
  });

  // Derived
  const derived = useMemo(() => {
    let totalStock = 0;
    let totalStockValue = 0;
    let totalStockCost = 0;
    let cmvSum = 0;
    let validCmv = 0;
    let critical = 0;
    let highCmv = 0;

    for (const w of wines) {
      const cost = Number(w.cost_price) || 0;
      const sale = Number(w.sale_price) || 0;
      const stock = isGlassVol(w.volume) ? 0 : stockMap[w.id] ?? 0;
      totalStock += stock;
      totalStockValue += sale * stock;
      totalStockCost += cost * stock;
      if (sale > 0) {
        const cmv = (cost / sale) * 100;
        cmvSum += cmv;
        validCmv++;
        if (cmv > 35) highCmv++;
      }
      if (!isGlassVol(w.volume) && stock <= 3 && (w.active_on_menu ?? true))
        critical++;
    }
    const avgCmv = validCmv ? +(cmvSum / validCmv).toFixed(1) : 0;
    return {
      totalStock,
      totalStockValue,
      totalStockCost,
      avgCmv,
      critical,
      highCmv,
      profitPotential: totalStockValue - totalStockCost,
    };
  }, [wines, stockMap]);

  const topConsumed = useMemo(() => {
    return [...wines]
      .map((w) => ({ ...w, sold: monthlySalesMap[w.id] ?? 0 }))
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 6);
  }, [wines, monthlySalesMap]);

  const maxSold = Math.max(1, ...topConsumed.map((w) => w.sold));

  const typeDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const w of wines) {
      const t = (w.wine_type || "Outros").trim() || "Outros";
      counts[t] = (counts[t] || 0) + 1;
    }
    const total = wines.length || 1;
    return Object.entries(counts).map(([type, count]) => ({
      type,
      count,
      percentage: Math.round((count / total) * 100),
    }));
  }, [wines]);

  const highCmvList = useMemo(
    () =>
      wines
        .filter((w) => {
          const cost = Number(w.cost_price) || 0;
          const sale = Number(w.sale_price) || 0;
          return sale > 0 && (cost / sale) * 100 > 33;
        })
        .map((w) => {
          const cost = Number(w.cost_price) || 0;
          const sale = Number(w.sale_price) || 0;
          const cmv = +((cost / sale) * 100).toFixed(1);
          const optimal = Math.round(cost / 0.3);
          return { ...w, cmv, optimal, delta: optimal - sale };
        })
        .sort((a, b) => b.cmv - a.cmv)
        .slice(0, 8),
    [wines],
  );

  // Simulator
  const [simId, setSimId] = useState<string>("");
  const [simCost, setSimCost] = useState<number>(0);
  const [simPrice, setSimPrice] = useState<number>(0);

  useEffect(() => {
    if (!simId && wines[0]) {
      setSimId(wines[0].id);
      setSimCost(Number(wines[0].cost_price) || 0);
      setSimPrice(Number(wines[0].sale_price) || 0);
    }
  }, [wines, simId]);

  useEffect(() => {
    const w = wines.find((x) => x.id === simId);
    if (w) {
      setSimCost(Number(w.cost_price) || 0);
      setSimPrice(Number(w.sale_price) || 0);
    }
  }, [simId, wines]);

  const simCmv =
    simPrice > 0 ? +((simCost / simPrice) * 100).toFixed(1) : 100;

  return (
    <div className="p-6 md:p-10 space-y-6">
      <header className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="page-title">Painel de Controle</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Indicadores da adega em tempo real — CMV, giro e potencial de faturamento.
          </p>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Potencial de Faturamento"
          value={`R$ ${fmtBRL(derived.totalStockValue)}`}
          icon={<DollarSign size={15} />}
          footer={
            <span className="text-muted-foreground">
              Margem esperada:{" "}
              <span className="font-semibold text-primary">
                R$ {fmtBRL(derived.profitPotential, 0)}
              </span>
            </span>
          }
        />
        <KpiCard
          label="CMV Médio Geral"
          value={`${derived.avgCmv}%`}
          icon={<Percent size={15} />}
          footer={
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                derived.avgCmv <= 33
                  ? "bg-primary/15 text-primary"
                  : "bg-[color:var(--wine)]/25 text-[#f4a5b0]"
              }`}
            >
              {derived.avgCmv <= 33 ? "Meta saudável" : "Revisão recomendada"}
            </span>
          }
        />
        <KpiCard
          label="Rótulos Críticos"
          value={derived.critical}
          icon={<AlertTriangle size={15} className="text-[#f4a5b0]" />}
          iconTone="danger"
          footer={
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--wine)]"></span>
              3 ou menos garrafas em estoque
            </span>
          }
        />
        <KpiCard
          label="Alertas de CMV Elevado"
          value={derived.highCmv}
          icon={<Activity size={15} />}
          footer={<span className="text-muted-foreground">Rótulos acima de 35% CMV</span>}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-8">
          <div className="section-title flex items-center gap-2">
            <TrendingUp size={14} />
            <span>Consumo mensal — Top 6 rótulos</span>
          </div>
          <p className="mb-5 -mt-2 text-[11px] text-muted-foreground">
            Média mensal (últimos 12 meses) — garrafas vendidas.
          </p>
          {topConsumed.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Sem vendas registradas ainda. Lance a venda mensal em <em>Venda mensal</em>.
            </p>
          )}
          <div className="space-y-4">
            {topConsumed.map((w) => {
              const pct = Math.max(6, (w.sold / maxSold) * 100);
              return (
                <div key={w.id} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="max-w-[65%] truncate font-medium">{w.name}</span>
                    <span className="text-muted-foreground">
                      {w.sold} gfa{w.sold === 1 ? "" : "s"}/mês
                    </span>
                  </div>
                  <div className="flex h-6 w-full items-center overflow-hidden rounded-lg bg-[color:var(--surface-2)]">
                    <div
                      className="flex h-full items-center justify-end rounded-lg pr-2 transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        background:
                          "linear-gradient(90deg, var(--wine), var(--gold))",
                      }}
                    >
                      <span className="text-[10px] font-bold text-primary-foreground">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-4">
          <div className="section-title">Divisão por categoria</div>
          <p className="mb-5 -mt-2 text-[11px] text-muted-foreground">
            Composição atual da carta.
          </p>
          <div className="space-y-3">
            {typeDistribution.map((it) => (
              <div key={it.type} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium">{it.type}</span>
                  <span className="text-muted-foreground">
                    {it.count} ({it.percentage}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--surface-2)]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${it.percentage}%`,
                      background: typeColor(it.type),
                    }}
                  />
                </div>
              </div>
            ))}
            {typeDistribution.length === 0 && (
              <p className="text-xs text-muted-foreground">Sem rótulos cadastrados.</p>
            )}
          </div>
        </div>
      </div>

      {/* Optimizer + Simulator */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        <div className="rounded-xl border border-border bg-card p-5 md:col-span-7">
          <div className="section-title">Otimizador de margens (CMV alto)</div>
          <p className="mb-4 -mt-2 text-[11px] text-muted-foreground">
            Rótulos que requerem reajuste para atingir CMV alvo de 30%.
          </p>
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2">Vinho</th>
                  <th className="py-2 text-center">CMV</th>
                  <th className="py-2 text-right">Preço sugerido</th>
                  <th className="py-2 text-right">Δ margem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {highCmvList.map((w) => (
                  <tr key={w.id}>
                    <td className="py-2.5 font-medium">{w.name}</td>
                    <td className="py-2.5 text-center">
                      <span className="rounded bg-[color:var(--wine)]/25 px-1.5 py-0.5 font-bold text-[#f4a5b0]">
                        {w.cmv}%
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-bold text-primary">
                      R$ {w.optimal}
                    </td>
                    <td className="py-2.5 text-right font-medium text-primary">
                      +R$ {w.delta}
                    </td>
                  </tr>
                ))}
                {highCmvList.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-muted-foreground">
                      Nenhum rótulo com CMV acima de 33%. Excelente!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 md:col-span-5">
          <div className="section-title flex items-center gap-2">
            <Calculator size={14} />
            <span>Simulador de CMV</span>
          </div>
          <p className="mb-4 -mt-2 text-[11px] text-muted-foreground">
            Ajuste custo/venda para prever a margem ideal.
          </p>

          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Selecionar rótulo
          </label>
          <select
            value={simId}
            onChange={(e) => setSimId(e.target.value)}
            className="mb-4 w-full rounded-lg border border-border bg-background p-2 text-xs"
          >
            <option value="">-- Novo rótulo --</option>
            {wines.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-3">
            <StepperField
              label="Custo (R$)"
              value={simCost}
              step={5}
              onChange={setSimCost}
            />
            <StepperField
              label="Venda (R$)"
              value={simPrice}
              step={10}
              onChange={setSimPrice}
            />
          </div>

          <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-[color:var(--surface-2)] p-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Lucro / garrafa
              </div>
              <div className="mt-0.5 text-lg font-bold text-primary">
                R$ {fmtBRL(simPrice - simCost)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                CMV simulado
              </div>
              <div
                className={`mt-0.5 text-lg font-extrabold ${
                  simCmv <= 30
                    ? "text-primary"
                    : simCmv <= 35
                      ? "text-amber-400"
                      : "text-[#f4a5b0]"
                }`}
              >
                {simCmv}%
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-start gap-2 text-[11px] text-muted-foreground">
            <Sparkles size={13} className="mt-0.5 text-primary" />
            <span>
              {simCmv <= 30
                ? "Excelente CMV — maximiza os lucros da casa."
                : simCmv <= 35
                  ? "CMV aceitável, margem um pouco reduzida."
                  : "Atenção: CMV alto. Lucro líquido comprimido."}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  iconTone,
  footer,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  iconTone?: "danger";
  footer: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 transition hover:border-primary">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <div
          className={`rounded p-1 ${
            iconTone === "danger"
              ? "bg-[color:var(--wine)]/25 text-[#f4a5b0]"
              : "bg-[color:var(--surface-2)] text-primary"
          }`}
        >
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-primary">{value}</div>
      <div className="mt-2 text-[11px]">{footer}</div>
    </div>
  );
}

function StepperField({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - step))}
          className="rounded border border-border bg-[color:var(--surface-2)] p-1 hover:border-primary"
        >
          <Minus size={12} />
        </button>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="no-spin w-full rounded border border-border bg-background p-1 text-center text-xs font-bold"
        />
        <button
          type="button"
          onClick={() => onChange(value + step)}
          className="rounded border border-border bg-[color:var(--surface-2)] p-1 hover:border-primary"
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
}

function typeColor(t: string) {
  const s = t.toLowerCase();
  if (s.includes("tinto")) return "var(--wine)";
  if (s.includes("branco")) return "#f1e788";
  if (s.includes("rosé") || s.includes("rose")) return "#ff8da1";
  if (s.includes("espumante")) return "#eeeeee";
  if (s.includes("fortificado")) return "#4a0404";
  return "var(--gold)";
}
