import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type StockHistorySession = {
  id: string;
  restaurant_id: string;
  reference_date: string;
  status: string;
  restaurants?: { name: string } | null;
};
export type StockHistoryItem = { session_id: string; wine_id: string; counted_qty: number | null };
export type StockHistoryPoint = { id: string; date: string; bottles: number; restaurant: string };

// Four calendar months, including the current month; date-only keys avoid timezone shifts.
export function stockHistoryRange(now: Date) {
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: key(new Date(now.getFullYear(), now.getMonth() - 3, 1)), end: key(now) };
}

export function stockHistoryPoints(
  sessions: StockHistorySession[],
  items: StockHistoryItem[],
  wines: { id: string; volume: string | null }[],
  restaurantIds: string[],
  now: Date,
): StockHistoryPoint[] {
  const { start, end } = stockHistoryRange(now);
  const bottleIds = new Set(wines.filter((w) => !/taça|taca|glass/i.test(w.volume ?? "")).map((w) => w.id));
  const totals = new Map<string, number>();
  for (const item of items) {
    if (item.counted_qty === null || !bottleIds.has(item.wine_id)) continue;
    totals.set(item.session_id, (totals.get(item.session_id) ?? 0) + item.counted_qty);
  }
  return sessions
    .filter((s) => s.status === "closed" && restaurantIds.includes(s.restaurant_id) && s.reference_date >= start && s.reference_date <= end)
    .sort((a, b) => a.reference_date.localeCompare(b.reference_date) || a.id.localeCompare(b.id))
    .map((s) => ({ id: s.id, date: s.reference_date, bottles: totals.get(s.id) ?? 0, restaurant: s.restaurants?.name ?? "" }));
}

// The caller supplies its existing RLS client, or an already-authorized guest client.
export async function fetchStockHistory(client: SupabaseClient<Database>, restaurantIds: string[], now: Date): Promise<StockHistoryPoint[]> {
  if (!restaurantIds.length) return [];
  const { start, end } = stockHistoryRange(now);
  const sessions: StockHistorySession[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from("stock_count_sessions")
      .select("id,restaurant_id,reference_date,status,restaurants(name)")
      .in("restaurant_id", restaurantIds).eq("status", "closed")
      .gte("reference_date", start).lte("reference_date", end)
      .order("reference_date").order("id").range(offset, offset + 999);
    if (error) throw error;
    sessions.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const items: StockHistoryItem[] = [];
  // Small ID batches keep request URLs bounded; paginate so large counts remain complete.
  for (let batch = 0; batch < sessions.length; batch += 50) {
    const ids = sessions.slice(batch, batch + 50).map((s) => s.id);
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await client.from("stock_count_items")
        .select("session_id,wine_id,counted_qty").in("session_id", ids)
        .order("id").range(offset, offset + 999);
      if (error) throw error;
      items.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
  }
  const wines: { id: string; volume: string | null }[] = [];
  for (let offset = 0; sessions.length; offset += 1000) {
    const { data, error } = await client.from("wines").select("id,volume")
      .in("restaurant_id", restaurantIds).order("id").range(offset, offset + 999);
    if (error) throw error;
    wines.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return stockHistoryPoints(sessions, items, wines, restaurantIds, now);
}