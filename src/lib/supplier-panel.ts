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