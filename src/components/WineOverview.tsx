import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X, Pencil, Wine as WineIcon, Package, TrendingUp, PieChart as PieIcon } from "lucide-react";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function fmtBRL(n: number, digits = 0) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function isGlassVol(v: string | null | undefined) {
  return !!v && /taça|taca|glass/i.test(v);
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

export type OverviewWine = {
  id: string;
  restaurant_id?: string | null;
  name: string;
  producer: string | null;
  vintage: number | null;
  region: string | null;
  appellation: string | null;
  country: string | null;
  grape: string | null;
  wine_type: string | null;
  style: string | null;
  volume: string | null;
  cost_price: number;
  sale_price: number;
  internal_code: string | null;
  alcohol_pct: number | null;
  sugar_level: string | null;
  body: string | null;
  tannin: string | null;
  acidity: string | null;
  aging: string | null;
  pairing_notes: string | null;
  tasting_notes: string | null;
  image_url: string | null;
  active_on_menu: boolean;
};

type Metric = "qty" | "revenue";

export function WineOverview({
  wine,
  restaurantId,
  onClose,
  onEdit,
  metric,
  onMetricChange,
}: {
  wine: OverviewWine;
  restaurantId: string;
  onClose: () => void;
  onEdit: () => void;
  metric: Metric;
  onMetricChange: (m: Metric) => void;
}) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const previousYear = currentYear - 1;

  // Sales for this wine + all wines (for participation) — last 2 years
  const { data: series } = useQuery({
    queryKey: ["wine-overview-series", wine.id, restaurantId, currentYear],
    enabled: !!restaurantId,
    queryFn: async () => {
      const start = new Date(previousYear, 0, 1).toISOString();
      const { data } = await supabase
        .from("inventory_movements")
        .select("wine_id, quantity, unit_price, occurred_at")
        .eq("restaurant_id", restaurantId)
        .eq("movement_type", "sale")
        .gte("occurred_at", start);
      const rows = data ?? [];
      const empty = () => Array(12).fill(0);
      const wQty: Record<number, number[]> = { [currentYear]: empty(), [previousYear]: empty() };
      const wRev: Record<number, number[]> = { [currentYear]: empty(), [previousYear]: empty() };
      let wineTotal = 0;
      let restaurantTotal = 0;
      for (const m of rows) {
        const dt = new Date(m.occurred_at as string);
        const y = dt.getFullYear();
        const mo = dt.getMonth();
        const qty = Number(m.quantity) || 0;
        const rev = qty * (Number(m.unit_price) || 0);
        restaurantTotal += rev;
        if (m.wine_id === wine.id) {
          wineTotal += rev;
          if (wQty[y]) {
            wQty[y][mo] += qty;
            wRev[y][mo] += rev;
          }
        }
      }
      return { wQty, wRev, wineTotal, restaurantTotal };
    },
  });

  const { data: stock } = useQuery({
    queryKey: ["wine-overview-stock", wine.id, restaurantId],
    enabled: !!restaurantId && !isGlassVol(wine.volume),
    queryFn: async () => {
      const { data: sess } = await supabase
        .from("stock_count_sessions")
        .select("id, reference_date")
        .eq("restaurant_id", restaurantId)
        .eq("status", "closed")
        .order("reference_date", { ascending: false })
        .limit(1);
      const s = sess?.[0];
      if (!s) return null;
      const { data: items } = await supabase
        .from("stock_count_items")
        .select("counted_qty")
        .eq("session_id", s.id)
        .eq("wine_id", wine.id)
        .limit(1);
      return { qty: items?.[0]?.counted_qty ?? null, date: s.reference_date as string };
    },
  });

  const curr = useMemo(() => (metric === "qty" ? series?.wQty[currentYear] : series?.wRev[currentYear]) ?? Array(12).fill(0), [series, metric, currentYear]);
  const prev = useMemo(() => (metric === "qty" ? series?.wQty[previousYear] : series?.wRev[previousYear]) ?? Array(12).fill(0), [series, metric, previousYear]);

  const currTotal = curr.reduce((a, b) => a + b, 0);
  const prevTotal = prev.reduce((a, b) => a + b, 0);

  const participation = series && series.restaurantTotal > 0 ? (series.wineTotal / series.restaurantTotal) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-6xl rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <WineIcon className="h-5 w-5 text-primary" />
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Rótulo</div>
              <h2 className="text-lg font-semibold tracking-tight">{wine.name}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary hover:bg-primary/20"
            >
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Cover row: image + info */}
        <div className="grid gap-6 border-b border-border p-6 md:grid-cols-[220px_1fr_260px]">
          <div className="flex items-center justify-center rounded-xl border border-border bg-background p-3">
            {wine.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={wine.image_url} alt={wine.name} className="max-h-64 w-auto object-contain" />
            ) : (
              <div className="flex h-64 w-full items-center justify-center text-xs text-muted-foreground">
                Sem imagem
              </div>
            )}
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              {wine.internal_code && (
                <span className="rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {wine.internal_code}
                </span>
              )}
              {wine.wine_type && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                  {wine.wine_type}
                </span>
              )}
              {wine.volume && (
                <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                  {wine.volume}
                </span>
              )}
              {!wine.active_on_menu && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-500">
                  Fora da carta
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px]">
              <InfoRow label="Produtor" value={wine.producer} />
              <InfoRow label="Safra" value={wine.vintage ? String(wine.vintage) : null} />
              <InfoRow label="País" value={wine.country} />
              <InfoRow label="Região" value={wine.region} />
              <InfoRow label="AOP / Denominação" value={wine.appellation} />
              <InfoRow label="Uvas" value={wine.grape} />
              <InfoRow label="Estilo" value={wine.style} />
              <InfoRow label="Álcool" value={wine.alcohol_pct != null ? `${wine.alcohol_pct}%` : null} />
              <InfoRow label="Açúcar" value={wine.sugar_level} />
              <InfoRow label="Corpo" value={wine.body} />
              <InfoRow label="Taninos" value={wine.tannin} />
              <InfoRow label="Acidez" value={wine.acidity} />
            </div>

            {(wine.pairing_notes || wine.tasting_notes) && (
              <div className="space-y-2 rounded-lg border border-dashed border-border bg-background/40 p-3 text-[12px]">
                {wine.tasting_notes && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Notas de degustação</div>
                    <div className="mt-0.5 text-foreground/90">{wine.tasting_notes}</div>
                  </div>
                )}
                {wine.pairing_notes && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Harmonização</div>
                    <div className="mt-0.5 text-foreground/90">{wine.pairing_notes}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* KPI column */}
          <div className="space-y-3">
            <Kpi label="Preço de venda" value={`R$ ${fmtBRL(Number(wine.sale_price), 2)}`} tone="primary" />
            <Kpi label="Custo" value={`R$ ${fmtBRL(Number(wine.cost_price), 2)}`} />
            <Kpi
              label="Markup"
              value={
                Number(wine.cost_price) > 0
                  ? `${(((Number(wine.sale_price) / Number(wine.cost_price)) - 1) * 100).toFixed(0)}%`
                  : "—"
              }
            />
            <Kpi
              label="Estoque atual"
              value={
                isGlassVol(wine.volume)
                  ? "—"
                  : stock?.qty != null
                    ? `${stock.qty} un`
                    : "sem contagem"
              }
              hint={stock?.date ? new Date(stock.date).toLocaleDateString("pt-BR") : undefined}
              icon={<Package className="h-3.5 w-3.5" />}
            />
          </div>
        </div>

        {/* Charts */}
        <div className="grid gap-6 p-6 md:grid-cols-[1fr_320px]">
          {/* Sales bar chart */}
          <div className="rounded-xl border border-border bg-background/40 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Vendas do rótulo</div>
                  <div className="text-sm font-semibold">{currentYear} vs {previousYear}</div>
                </div>
              </div>
              <div className="inline-flex rounded-md border border-border bg-card p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => onMetricChange("qty")}
                  className={`rounded px-3 py-1 font-semibold uppercase tracking-wide transition ${
                    metric === "qty" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Quantidade
                </button>
                <button
                  type="button"
                  onClick={() => onMetricChange("revenue")}
                  className={`rounded px-3 py-1 font-semibold uppercase tracking-wide transition ${
                    metric === "revenue" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Faturamento
                </button>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <MiniStat
                label={`Acumulado ${currentYear}`}
                value={metric === "revenue" ? `R$ ${fmtBRL(currTotal)}` : `${fmtBRL(currTotal)} un`}
                tone="primary"
              />
              <MiniStat
                label={`${previousYear} completo`}
                value={metric === "revenue" ? `R$ ${fmtBRL(prevTotal)}` : `${fmtBRL(prevTotal)} un`}
              />
            </div>

            <BarChart
              curr={curr}
              prev={prev}
              currentYear={currentYear}
              previousYear={previousYear}
              valuePrefix={metric === "revenue" ? "R$ " : ""}
              valueSuffix={metric === "qty" ? " un" : ""}
              height={240}
            />
          </div>

          {/* Pie: participation */}
          <div className="rounded-xl border border-border bg-background/40 p-4">
            <div className="mb-4 flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-primary" />
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Participação no restaurante</div>
                <div className="text-sm font-semibold">Faturamento (últimos 24 meses)</div>
              </div>
            </div>
            <ParticipationPie
              share={participation}
              wineValue={series?.wineTotal ?? 0}
              totalValue={series?.restaurantTotal ?? 0}
              wineName={wine.name}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="truncate text-foreground/90">{value || "—"}</span>
    </div>
  );
}

function Kpi({ label, value, hint, tone, icon }: { label: string; value: string; hint?: string; tone?: "primary"; icon?: React.ReactNode }) {
  return (
    <div className={`rounded-xl border ${tone === "primary" ? "border-primary/40 bg-primary/5" : "border-border bg-background/40"} px-4 py-3`}>
      <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`mt-1 text-lg font-semibold ${tone === "primary" ? "text-primary" : "text-foreground"}`}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground/80">{hint}</div>}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "primary" }) {
  return (
    <div className={`rounded-lg border ${tone === "primary" ? "border-primary/40 bg-primary/10" : "border-border bg-card"} px-3 py-2`}>
      <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${tone === "primary" ? "text-primary" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function BarChart({
  curr,
  prev,
  currentYear,
  previousYear,
  valuePrefix = "",
  valueSuffix = "",
  height = 240,
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
                  {valuePrefix}{fmtBRL(t)}{valueSuffix}
                </span>
                <div className="h-px w-full" style={{ background: "color-mix(in oklab, var(--muted-foreground) 45%, transparent)" }} />
              </div>
            ))}
            <div className="absolute inset-0 flex">
              {MONTHS.map((_, i) => (
                <div key={i} className="flex-1 border-l" style={{ borderColor: "color-mix(in oklab, var(--muted-foreground) 30%, transparent)" }} />
              ))}
              <div className="border-l" style={{ borderColor: "color-mix(in oklab, var(--muted-foreground) 45%, transparent)" }} />
            </div>
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
                        background: "linear-gradient(180deg, #b8b8b8, #6a6a6a)",
                        boxShadow: "0 0 0 1px rgba(255,255,255,0.06)",
                      }}
                      title={`${previousYear}: ${valuePrefix}${fmtBRL(prev[i])}${valueSuffix}`}
                    />
                    <div
                      className="w-2/5 rounded-t transition-all"
                      style={{ height: `${cPct}%`, background: "linear-gradient(180deg, var(--gold), var(--wine))" }}
                      title={`${currentYear}: ${valuePrefix}${fmtBRL(curr[i])}${valueSuffix}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 flex justify-between gap-2" style={{ paddingLeft: axisWidth }}>
          {MONTHS.map((mo) => (
            <div key={mo} className="flex-1 text-center text-[10px] text-muted-foreground">{mo}</div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-center gap-6 text-[11px]">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded" style={{ background: "linear-gradient(180deg, #b8b8b8, #6a6a6a)" }} />
          <span className="text-muted-foreground">{previousYear}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded" style={{ background: "linear-gradient(180deg, var(--gold), var(--wine))" }} />
          <span className="text-muted-foreground">{currentYear}</span>
        </div>
      </div>
    </div>
  );
}

function ParticipationPie({ share, wineValue, totalValue, wineName }: { share: number; wineValue: number; totalValue: number; wineName: string }) {
  const size = 200;
  const r = 82;
  const cx = size / 2;
  const cy = size / 2;
  const frac = Math.max(0, Math.min(1, totalValue > 0 ? wineValue / totalValue : 0));

  const angle = frac * 2 * Math.PI;
  const large = frac > 0.5 ? 1 : 0;
  const x = cx + r * Math.sin(angle);
  const y = cy - r * Math.cos(angle);
  const wineSlice = frac >= 0.9999
    ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
    : `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${large} 1 ${x} ${y} Z`;
  const restSlice = frac >= 0.9999
    ? ""
    : `M ${cx} ${cy} L ${x} ${y} A ${r} ${r} 0 ${large === 1 ? 0 : 1} 1 ${cx} ${cy - r} Z`;

  return (
    <div className="flex flex-col items-center gap-3">
      {totalValue > 0 ? (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {restSlice && <path d={restSlice} fill="#3a3a3a" stroke="var(--card)" strokeWidth={1.5} />}
          <path d={wineSlice} fill="url(#pgrad)" stroke="var(--card)" strokeWidth={1.5} />
          <defs>
            <linearGradient id="pgrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--gold)" />
              <stop offset="100%" stopColor="var(--wine)" />
            </linearGradient>
          </defs>
          <text x={cx} y={cy - 4} textAnchor="middle" className="fill-primary" style={{ fontSize: 22, fontWeight: 700 }}>
            {share.toFixed(1)}%
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 10 }}>
            do faturamento
          </text>
        </svg>
      ) : (
        <div className="flex items-center justify-center rounded-full border border-dashed border-border text-[10px] text-muted-foreground" style={{ width: size, height: size }}>
          Sem dados
        </div>
      )}
      <div className="w-full space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded" style={{ background: "linear-gradient(180deg, var(--gold), var(--wine))" }} />
            <span className="truncate text-muted-foreground" title={wineName}>{wineName}</span>
          </div>
          <span className="text-foreground">R$ {fmtBRL(wineValue)}</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded" style={{ background: "#3a3a3a" }} />
            <span className="text-muted-foreground">Demais rótulos</span>
          </div>
          <span className="text-foreground">R$ {fmtBRL(Math.max(0, totalValue - wineValue))}</span>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-1.5 text-[11px]">
          <span className="font-semibold text-muted-foreground">Total restaurante</span>
          <span className="font-semibold text-foreground">R$ {fmtBRL(totalValue)}</span>
        </div>
      </div>
    </div>
  );
}
