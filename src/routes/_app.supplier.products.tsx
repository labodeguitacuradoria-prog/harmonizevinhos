import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Check as CheckIcon, Store } from "lucide-react";
import { WineOverview, type OverviewWine } from "@/components/WineOverview";
import { useSupplierScope } from "@/lib/supplier-scope";

export const Route = createFileRoute("/_app/supplier/products")({
  component: SupplierProductsPage,
});

const LEGACY_TYPE_MAP: Record<string, string> = {
  red: "Tinto",
  white: "Branco",
  rose: "Rosé",
  sparkling: "Espumante",
  dessert: "Fortificado",
  fortified: "Fortificado",
};

const isGlassVol = (v: string | null | undefined) => !!v && /taça|taca|glass/i.test(v);

function wineTypeLabel(t: string | null) {
  if (!t) return "-";
  return LEGACY_TYPE_MAP[t] ?? t;
}

type SupplierWine = OverviewWine & {
  restaurant_id: string;
  volume: string | null;
  restaurants?: { name?: string | null } | null;
};

function SupplierProductsPage() {
  const { role, supplierId, loading } = useAuth();
  const navigate = useNavigate();
  const { restaurantId, setRestaurantId } = useSupplierScope();
  const [viewWine, setViewWine] = useState<SupplierWine | null>(null);
  const [metric, setMetric] = useState<"qty" | "revenue">("qty");
  const [fName, setFName] = useState("");
  const [fType, setFType] = useState("");
  const [fVolume, setFVolume] = useState("");

  useEffect(() => {
    if (!loading && role !== "supplier") navigate({ to: "/app" });
  }, [role, loading, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["supplier-products", supplierId],
    enabled: !!supplierId,
    queryFn: async () => {
      const { data: wines } = await supabase
        .from("wines")
        .select("*, restaurants(name)")
        .eq("supplier_id", supplierId!)
        .order("name");
      const ids = (wines ?? []).map((w) => w.id);
      const { data: movs } = ids.length
        ? await supabase
            .from("inventory_movements")
            .select("wine_id, movement_type, quantity, occurred_at")
            .in("wine_id", ids)
        : { data: [] };
      return { wines: (wines ?? []) as unknown as SupplierWine[], movs: movs ?? [] };
    },
  });

  const allWines = data?.wines ?? [];
  const movs = data?.movs ?? [];

  const restaurants = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of allWines) m.set(w.restaurant_id, w.restaurants?.name ?? "Restaurante");
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [allWines]);

  useEffect(() => {
    if (!restaurantId && restaurants.length) setRestaurantId(restaurants[0].id);
  }, [restaurantId, restaurants, setRestaurantId]);

  const wines = useMemo(
    () => allWines.filter((w) => !restaurantId || w.restaurant_id === restaurantId),
    [allWines, restaurantId],
  );

  const { stockMap, monthlyMap, avg4mMap } = useMemo(() => {
    const ids = new Set(wines.map((w) => w.id));
    const stock: Record<string, number> = {};
    const soldTotal: Record<string, number> = {};
    const months = new Set<string>();
    const sold4m: Record<string, number> = {};
    const start4m = new Date();
    start4m.setMonth(start4m.getMonth() - 3, 1);
    for (const m of movs as Array<{ wine_id: string; movement_type: string; quantity: number; occurred_at: string }>) {
      if (!ids.has(m.wine_id)) continue;
      const sign = m.movement_type === "sale" ? -1 : 1;
      stock[m.wine_id] = (stock[m.wine_id] ?? 0) + sign * (m.quantity ?? 0);
      if (m.movement_type !== "sale") continue;
      const d = new Date(m.occurred_at);
      months.add(`${d.getFullYear()}-${d.getMonth()}`);
      soldTotal[m.wine_id] = (soldTotal[m.wine_id] ?? 0) + (m.quantity ?? 0);
      if (d >= start4m) sold4m[m.wine_id] = (sold4m[m.wine_id] ?? 0) + (m.quantity ?? 0);
    }
    const divisor = months.size || 1;
    const monthly: Record<string, number> = {};
    for (const id of Object.keys(soldTotal)) {
      monthly[id] = Math.round((soldTotal[id] / divisor) * 10) / 10;
    }
    const avg4m: Record<string, number> = {};
    for (const id of Object.keys(sold4m)) avg4m[id] = sold4m[id] / 4;
    return { stockMap: stock, monthlyMap: monthly, avg4mMap: avg4m };
  }, [movs, wines]);

  const typeOptions = Array.from(
    new Set(wines.map((w) => wineTypeLabel(w.wine_type)).filter((v) => v && v !== "-")),
  ).sort();
  const volumeOptions = Array.from(new Set(wines.map((w) => w.volume ?? "").filter(Boolean))).sort();

  const filtered = wines.filter((w) => {
    const term = fName.trim().toLowerCase();
    const okName =
      !term ||
      w.name.toLowerCase().includes(term) ||
      (w.producer ?? "").toLowerCase().includes(term) ||
      (w.internal_code ?? "").toLowerCase().includes(term);
    return (
      okName &&
      (fType === "" || fType === wineTypeLabel(w.wine_type)) &&
      (fVolume === "" || fVolume === (w.volume ?? ""))
    );
  });

  if (loading || isLoading) return <div className="p-10 text-muted-foreground">Carregando...</div>;

  return (
    <div className="p-3 md:p-10">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="page-title">Produtos</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Seus rótulos no restaurante selecionado — visualização somente leitura.
          </p>
        </div>
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
      </header>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={fName}
          onChange={(e) => setFName(e.target.value)}
          placeholder="Filtrar rótulo, produtor ou código"
          className="w-full max-w-xs rounded border border-input bg-background px-2 py-1.5 text-xs"
        />
        <select
          value={fType}
          onChange={(e) => setFType(e.target.value)}
          className="rounded border border-input bg-background px-2 py-1.5 text-xs"
        >
          <option value="">Todos os tipos</option>
          {typeOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={fVolume}
          onChange={(e) => setFVolume(e.target.value)}
          className="rounded border border-input bg-background px-2 py-1.5 text-xs"
        >
          <option value="">Todos os volumes</option>
          {volumeOptions.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {/* Mobile */}
      <div className="mt-4 space-y-2 sm:hidden">
        {filtered.length === 0 && (
          <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum rótulo encontrado.
          </div>
        )}
        {filtered.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => setViewWine(w)}
            className="block w-full rounded-lg border border-border bg-card px-3 py-2.5 text-left"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{w.name}</div>
                <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {[w.internal_code, w.producer, w.vintage].filter(Boolean).join(" · ") || "-"}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                  <span>{wineTypeLabel(w.wine_type)}</span>
                  {w.volume && <span>{w.volume}</span>}
                  <span>R$ {Number(w.sale_price).toFixed(2)}</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Estoque</div>
                <div className="text-base font-semibold leading-none">
                  {isGlassVol(w.volume) ? "—" : Math.max(stockMap[w.id] ?? 0, 0)}
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Mês:{" "}
                  <span className="font-medium text-foreground">
                    {(monthlyMap[w.id] ?? 0).toLocaleString("pt-BR", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}
                  </span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Desktop */}
      <div className="no-scrollbar mt-4 hidden max-h-[calc(100vh-260px)] overflow-auto rounded-lg border border-border bg-card sm:block">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b border-border bg-card text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Rótulo</th>
              <th className="px-4 py-3">Safra</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Volume</th>
              <th className="px-4 py-3">Custo</th>
              <th className="px-4 py-3">Venda</th>
              <th className="px-4 py-3">Markup</th>
              <th className="px-4 py-3">Estoque</th>
              <th className="px-4 py-3">Venda mensal</th>
              <th className="px-4 py-3">Alerta de compra</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum rótulo encontrado.
                </td>
              </tr>
            )}
            {filtered.map((w) => {
              const markup =
                Number(w.cost_price) > 0
                  ? ((Number(w.sale_price) / Number(w.cost_price) - 1) * 100).toFixed(0)
                  : "-";
              const stock = isGlassVol(w.volume) ? null : Math.max(stockMap[w.id] ?? 0, 0);
              const min = Math.max(1, Math.ceil(avg4mMap[w.id] ?? 0));
              return (
                <tr key={w.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {w.internal_code ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => setViewWine(w)} className="text-left hover:text-primary">
                      <div className="font-medium underline-offset-2 hover:underline">{w.name}</div>
                      <div className="text-xs text-muted-foreground">{w.producer ?? ""}</div>
                    </button>
                  </td>
                  <td className="px-4 py-3">{w.vintage ?? "-"}</td>
                  <td className="px-4 py-3">{wineTypeLabel(w.wine_type)}</td>
                  <td className="px-4 py-3">{w.volume ?? "-"}</td>
                  <td className="px-4 py-3">R$ {Number(w.cost_price).toFixed(2)}</td>
                  <td className="px-4 py-3">R$ {Number(w.sale_price).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    {markup}
                    {markup !== "-" && "%"}
                  </td>
                  <td className="px-4 py-3">{stock == null ? "—" : stock}</td>
                  <td className="px-4 py-3">
                    {(monthlyMap[w.id] ?? 0).toLocaleString("pt-BR", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {stock == null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : stock <= min ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-500">
                        <AlertTriangle className="h-3 w-3" /> Comprar
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-500">
                        <CheckIcon className="h-3 w-3" /> Ok
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {viewWine && (
        <WineOverview
          wine={viewWine}
          restaurantId={viewWine.restaurant_id}
          onClose={() => setViewWine(null)}
          metric={metric}
          onMetricChange={setMetric}
        />
      )}
    </div>
  );
}
