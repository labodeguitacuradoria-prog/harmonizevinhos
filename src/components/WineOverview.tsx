import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X, Pencil, FileText, Wine as WineIcon, Package, TrendingUp, PieChart as PieIcon } from "lucide-react";


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
  onEdit?: () => void;

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


  const participation = series && series.restaurantTotal > 0 ? (series.wineTotal / series.restaurantTotal) * 100 : 0;

  const [notesOpen, setNotesOpen] = useState(false);
  const grapes = (wine.grape || "")
    .split(/[,;/•]|\se\s/gi)
    .map((g) => g.trim())
    .filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
      <div className="flex h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-b border-border px-6 py-2.5">
          <button
            type="button"
            onClick={() => setNotesOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:border-primary/40 hover:text-primary"
          >
            <FileText className="h-3.5 w-3.5" /> Características
          </button>

          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary hover:bg-primary/20"
            >
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>


        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Cover row: image + info */}
        <div className="grid gap-5 border-b border-border px-6 py-4 md:grid-cols-[210px_1fr_220px]">
          <div className="flex min-h-[220px] items-center justify-center overflow-hidden rounded-xl border border-border bg-white p-2">
            {wine.image_url ? (
              <img src={wine.image_url} alt={wine.name} className="max-h-[220px] w-auto max-w-full object-contain" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                Sem imagem
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-3 text-sm">

            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Rótulo
                </div>
                <h2 className="truncate text-2xl font-semibold tracking-tight">{wine.name}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2 self-end pb-1">
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
            </div>

            <div className="grid grid-cols-[1.4fr_1fr] gap-x-6 text-[12px]">
              <div className="space-y-1.5">
                <div className="grid grid-cols-[1fr_auto] gap-x-4">
                  <InfoRow label="Produtor" value={wine.producer} />
                  <InfoRow label="Safra" value={wine.vintage ? String(wine.vintage) : null} />
                </div>
                <InfoRow label="Região" value={wine.region} />
                <InfoRow label="AOP / Denominação" value={wine.appellation} />
                <div className="grid grid-cols-[1fr_auto] gap-x-4">
                  <InfoRow label="Estilo" value={wine.style} />
                  <InfoRow label="País" value={wine.country} />
                </div>
              </div>
              <div className="flex min-w-[130px] min-h-0 flex-col gap-1.5">
                <InfoRow
                  label="Álcool"
                  value={wine.alcohol_pct != null ? `${wine.alcohol_pct}%` : null}
                />
                <div className="flex min-h-0 flex-col">
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Uvas
                  </span>
                  {grapes.length ? (
                    <ul className="mt-0.5 space-y-0.5 pr-1 text-foreground/90">
                      {grapes.map((g) => (
                        <li key={g} className="truncate">{g}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-foreground/90">—</div>
                  )}
                </div>
              </div>
            </div>
          </div>


          {/* KPI column */}
          <div className="flex flex-col justify-center gap-3">
            <Kpi label="Preço de venda" value={`R$ ${fmtBRL(Number(wine.sale_price), 2)}`} tone="primary" />
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
        <div className="grid gap-5 p-5 md:grid-cols-[1fr_300px]">
          {/* Sales bar chart */}
          <div className="flex min-h-[360px] flex-col rounded-xl border border-border bg-background/40 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <div className="text-sm font-semibold">Vendas do Rótulo</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-3 w-3 rounded-sm"
                      style={{ background: "linear-gradient(180deg, #b8b8b8, #6a6a6a)" }}
                    />
                    <span className="text-muted-foreground">{previousYear}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-3 w-3 rounded-sm"
                      style={{ background: "linear-gradient(180deg, var(--gold), var(--wine))" }}
                    />
                    <span className="text-muted-foreground">{currentYear}</span>
                  </span>
                </div>
                <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
                  <button
                    type="button"
                    onClick={() => onMetricChange("qty")}
                    className={`px-3 py-1 text-[11px] font-semibold uppercase tracking-wide rounded-md transition ${
                      metric === "qty" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Quantidade
                  </button>
                  <button
                    type="button"
                    onClick={() => onMetricChange("revenue")}
                    className={`px-3 py-1 text-[11px] font-semibold uppercase tracking-wide rounded-md transition ${
                      metric === "revenue" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Faturamento
                  </button>
                </div>
              </div>
            </div>


            <div className="min-h-[300px] flex-1">
              <BarChart
                curr={curr}
                prev={prev}
                currentYear={currentYear}
                previousYear={previousYear}
                valuePrefix={metric === "revenue" ? "R$ " : ""}
                valueSuffix={metric === "qty" ? " un" : ""}
                fill
              />
            </div>
          </div>

          {/* Pie: participation */}
          <div className="flex flex-col rounded-xl border border-border bg-background/40 p-3">
            <div className="mb-2 flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-primary" />
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Participação no restaurante</div>
                <div className="text-sm font-semibold">Faturamento (24 meses)</div>
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

      {notesOpen && (
        <NotesModal
          wineName={wine.name}
          tasting={wine.tasting_notes}
          pairing={wine.pairing_notes}
          onClose={() => setNotesOpen(false)}
        />
      )}
    </div>
  );
}

function toParagraphs(text: string) {
  const byBreaks = text.split(/\n{1,}/).map((t) => t.trim()).filter(Boolean);
  if (byBreaks.length > 1) return byBreaks;
  const sentences = text.match(/[^.!?]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
  const out: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    out.push(sentences.slice(i, i + 2).join(" "));
  }
  return out;
}

function NotesModal({
  wineName,
  tasting,
  pairing,
  onClose,
}: {
  wineName: string;
  tasting: string | null;
  pairing: string | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Notas</div>
            <h3 className="truncate text-base font-semibold">{wineName}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground"
            aria-label="Fechar notas"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-6 overflow-y-auto px-6 py-5 text-[13px] leading-relaxed">
          {tasting && (
            <section>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Notas de degustação</div>
              <div className="space-y-3 text-foreground/90">
                {toParagraphs(tasting).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          )}
          {pairing && (
            <section>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Harmonização</div>
              <div className="space-y-3 text-foreground/90">
                {toParagraphs(pairing).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          )}
          {!tasting && !pairing && <div className="text-muted-foreground">Sem notas cadastradas.</div>}
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


function BarChart({
  curr,
  prev,
  currentYear,
  previousYear,
  valuePrefix = "",
  valueSuffix = "",
  height = 240,
  fill = false,
}: {
  curr: number[];
  prev: number[];
  currentYear: number;
  previousYear: number;
  valuePrefix?: string;
  valueSuffix?: string;
  height?: number;
  fill?: boolean;
}) {
  const rawMax = Math.max(1, ...curr, ...prev);
  const maxVal = niceMax(rawMax);
  const gridColor = "color-mix(in oklab, var(--gold) 16%, transparent)";

  return (
    <div className={fill ? "flex h-full flex-col" : undefined}>
      <div className={`relative w-full ${fill ? "min-h-0 flex-1" : ""}`} style={fill ? undefined : { height }}>
        <div className="absolute inset-0" style={{ paddingBottom: 20 }}>
          <div
            className="relative h-full w-full rounded-md"
            style={{
              backgroundImage: `linear-gradient(to right, ${gridColor} 1px, transparent 1px), linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)`,
              backgroundSize: "22px 22px",
              border: "1px solid color-mix(in oklab, var(--gold) 22%, transparent)",
            }}
          >
            <div className="absolute inset-0 flex items-end justify-between gap-1.5 px-1.5 pt-5">
              {MONTHS.map((mo, i) => {
                const cPct = (curr[i] / maxVal) * 100;
                const pPct = (prev[i] / maxVal) * 100;
                return (
                  <div key={mo} className="relative flex h-full flex-1 items-end justify-center gap-[3px]">
                    <div className="flex h-full w-2/5 flex-col justify-end">
                      <div className="text-center text-[10px] font-semibold leading-none text-foreground/80">
                        {prev[i] ? `${valuePrefix}${fmtBRL(prev[i])}` : ""}
                      </div>
                      <div
                        className="mt-1 w-full rounded-t transition-all"
                        style={{
                          height: `${pPct}%`,
                          background: "linear-gradient(180deg, #dcdcdc, #7a7a7a)",
                        }}
                        title={`${previousYear}: ${valuePrefix}${fmtBRL(prev[i])}${valueSuffix}`}
                      />
                    </div>
                    <div className="flex h-full w-2/5 flex-col justify-end">
                      <div className="text-center text-[10px] font-semibold leading-none text-primary">
                        {curr[i] ? `${valuePrefix}${fmtBRL(curr[i])}` : ""}
                      </div>
                      <div
                        className="mt-1 w-full rounded-t transition-all"
                        style={{ height: `${cPct}%`, background: "linear-gradient(180deg, var(--gold), var(--wine))" }}
                        title={`${currentYear}: ${valuePrefix}${fmtBRL(curr[i])}${valueSuffix}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 flex justify-between gap-1.5 px-1.5">
          {MONTHS.map((mo) => (
            <div key={mo} className="flex-1 text-center text-[10px] text-muted-foreground">{mo}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ParticipationPie({ share, wineValue, totalValue, wineName }: { share: number; wineValue: number; totalValue: number; wineName: string }) {
  const size = 200;
  const stroke = 26;
  const r = (size - stroke) / 2 - 6;
  const cx = size / 2;
  const cy = size / 2;
  const frac = Math.max(0, Math.min(1, totalValue > 0 ? wineValue / totalValue : 0));
  const circ = 2 * Math.PI * r;

  return (
    <div className="flex flex-col items-center gap-3">
      {totalValue > 0 ? (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <defs>
            <linearGradient id="pgrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--gold)" />
              <stop offset="100%" stopColor="var(--wine)" />
            </linearGradient>
          </defs>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#3a3a3a" strokeWidth={stroke} />
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="url(#pgrad)"
            strokeWidth={stroke}
            strokeLinecap="butt"
            strokeDasharray={`${circ * frac} ${circ}`}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
          <text x={cx} y={cy - 2} textAnchor="middle" className="fill-primary" style={{ fontSize: 30, fontWeight: 700 }}>
            {share.toFixed(1)}%
          </text>
          <text x={cx} y={cy + 20} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 11 }}>
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

