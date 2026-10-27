export type SupplierPanelWine = {
  id: string; name: string; producer: string | null; vintage: number | null;
  volume: string | null; internal_code: string | null; image_url: string | null;
  cost_price: number; sale_price: number; grape: string | null;
};
export type SupplierSale = { wine_id: string; quantity: number; unit_price: number | null; occurred_at: string };
export function supplierLinkAllowed(link: { revoked_at: string | null; expires_at: string }, enabled: boolean, deleted: boolean, now: Date) {
  return !link.revoked_at && new Date(link.expires_at).getTime() > now.getTime() && enabled && !deleted;
}
export function supplierSales(wines: SupplierPanelWine[], movements: SupplierSale[], month: string) {
  const allowed = new Map(wines.map(w => [w.id, w]));
  const byWine: Record<string, number> = {};
  let bottles = 0; let revenue = 0;
  for (const m of movements) {
    const w = allowed.get(m.wine_id);
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(new Date(m.occurred_at));
    if (!w || key !== month) continue;
    revenue += m.quantity * (m.unit_price ?? w.sale_price);
    if (/taça|taca|glass/i.test(w.volume ?? '')) continue;
    bottles += m.quantity;
    byWine[w.id] = (byWine[w.id] ?? 0) + m.quantity;
  }
  return { bottles, revenue, byWine };
}
const spMonth = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(new Date(iso));
/** Venda mensal igual ao Cadastro de Produtos: total vendido do rótulo ÷ meses com venda lançada no restaurante. */
export function monthlyAverages(movements: { wine_id: string; quantity: number }[], restaurantMonths: number) {
  const totals: Record<string, number> = {};
  for (const m of movements) totals[m.wine_id] = (totals[m.wine_id] ?? 0) + m.quantity;
  const out: Record<string, number> = {};
  for (const id of Object.keys(totals)) out[id] = restaurantMonths ? Math.round((totals[id] / restaurantMonths) * 10) / 10 : 0;
  return out;
}
/** Garrafas vendidas por mês (jan–dez) do ano informado, sem taças. */
export function yearlyBottles(wines: SupplierPanelWine[], movements: SupplierSale[], year: number) {
  const glass = new Set(wines.filter(w => /taça|taca|glass/i.test(w.volume ?? '')).map(w => w.id));
  const ids = new Set(wines.map(w => w.id));
  const out = Array(12).fill(0) as number[];
  for (const m of movements) {
    if (!ids.has(m.wine_id) || glass.has(m.wine_id)) continue;
    const [y, mo] = spMonth(m.occurred_at).split('-').map(Number);
    if (y === year) out[mo - 1] += m.quantity;
  }
  return out;
}
