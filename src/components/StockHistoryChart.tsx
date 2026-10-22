import { useId, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, LabelList } from "recharts";
import { Switch } from "@/components/ui/switch";
import type { StockHistoryPoint } from "@/lib/stock-history";

export default function StockHistoryChart({ points, loading, error, isGroup }: {
  points: StockHistoryPoint[];
  loading: boolean;
  error: boolean;
  isGroup: boolean;
}) {
  const [showValues, setShowValues] = useState(false);
  const gradientId = useId().replace(/:/g, "");
  const shortDate = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;
  return (
    <section className="min-w-0" aria-label="Histórico de estoque">
      <div className="mb-5">
        <div className="section-title">Estoque — últimas contagens</div>
        <p className="-mt-2 text-[11px] text-muted-foreground">Últimos 6 meses · contagens fechadas</p>
      </div>
      {loading || error || !points.length ? (
        <div className="flex h-[280px] items-center justify-center text-center text-xs text-muted-foreground" role="status">
          {loading ? "Carregando contagens…" : error ? "Não foi possível carregar as contagens." : "Sem contagens fechadas nos últimos 6 meses."}
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-end gap-2">
            <label htmlFor={`values-${gradientId}`} className="text-[10px] text-muted-foreground">Gfa</label>
            <Switch id={`values-${gradientId}`} checked={showValues} onCheckedChange={setShowValues} aria-label="Mostrar valores do estoque" />
          </div>
          <div className="overflow-x-auto pb-1">
            <div className="h-[280px] stock-history-plot" style={{ minWidth: Math.max(280, points.length * 55) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={points} margin={{ top: 24, right: 12, left: 0, bottom: 12 }} accessibilityLayer>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--gold)" />
                      <stop offset="100%" stopColor="var(--wine)" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--stock-chart-grid)" />
                  <XAxis dataKey="date" tickFormatter={shortDate} interval={0} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} stroke="var(--border)" label={{ value: "Data da contagem", position: "insideBottom", offset: -10, fill: "var(--muted-foreground)", fontSize: 10 }} />
                  <YAxis allowDecimals={false} width={55} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} stroke="var(--border)" label={{ value: "Gfa", position: "insideTopLeft", offset: -18, fill: "var(--muted-foreground)", fontSize: 10 }} />
                  <Tooltip cursor={{ fill: "var(--stock-chart-highlight)" }} content={({ active, payload }) => {
                    const point = payload?.[0]?.payload as StockHistoryPoint | undefined;
                    if (!active || !point) return null;
                    return <div className="rounded-md border border-border bg-popover p-3 text-xs text-popover-foreground">
                      <p>{shortDate(point.date)}/{point.date.slice(0, 4)}</p>
                      {isGroup && <p className="text-muted-foreground">{point.restaurant}</p>}
                      <p className="mt-1 font-semibold text-primary">{point.bottles.toLocaleString("pt-BR")} gfa</p>
                    </div>;
                  }} />
                  <Bar dataKey="bottles" name="Garrafas" fill={`url(#${gradientId})`} maxBarSize={38} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                    {showValues && <LabelList dataKey="bottles" position="top" fill="var(--primary)" fontSize={10} formatter={(value: number) => value.toLocaleString("pt-BR")} />}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">{points.length} {points.length === 1 ? "contagem" : "contagens"} · Garrafas</p>
        </>
      )}
    </section>
  );
}