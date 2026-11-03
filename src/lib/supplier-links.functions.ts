import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { supplierLinkAllowed, monthlyAverages, yearlyBottles, type SupplierPanelWine, type SupplierSale } from './supplier-panel';

const Scope = z.object({ restaurant_id: z.string().uuid(), supplier_id: z.string().uuid() });
async function authorize(context: { supabase: any; userId: string }, restaurantId: string) {
  const { data, error } = await context.supabase.rpc('can_manage_restaurant', { _user_id: context.userId, _restaurant_id: restaurantId });
  if (error || !data) throw new Error('Sem permissão para gerenciar este restaurante.');
}
export const setSupplierSharing = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Scope.extend({ enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await authorize(context, data.restaurant_id);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { error } = await supabaseAdmin.from('restaurant_supplier_access').upsert(data, { onConflict: 'restaurant_id,supplier_id' });
    if (error) throw new Error('Não foi possível alterar o compartilhamento.');
    return { ok: true };
  });

export const createSupplierLink = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Scope.extend({ days: z.union([z.literal(30), z.literal(90)]) }).parse(d))
  .handler(async ({ data, context }) => {
    await authorize(context, data.restaurant_id);
    const { data: wines, error: wineError } = await context.supabase.from('wines').select('id').eq('restaurant_id', data.restaurant_id).eq('supplier_id', data.supplier_id).limit(1);
    if (wineError || !wines?.length) throw new Error('Este fornecedor não possui rótulos vinculados ao restaurante.');
    const helpers = await import('@/lib/access-links.server');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const token = helpers.generateToken();
    const expires_at = new Date(Date.now() + data.days * 86400000).toISOString();
    const { data: link, error } = await supabaseAdmin.from('supplier_access_links').insert({
      restaurant_id: data.restaurant_id, supplier_id: data.supplier_id,
      token_hash: helpers.hashToken(token), token, created_by: context.userId, expires_at,
    }).select('id').single();
    if (error) throw new Error('Não foi possível gerar o link.');
    const { error: sharingError } = await supabaseAdmin.from('restaurant_supplier_access').upsert({ restaurant_id: data.restaurant_id, supplier_id: data.supplier_id, enabled: true }, { onConflict: 'restaurant_id,supplier_id' });
    if (sharingError) {
      await supabaseAdmin.from('supplier_access_links').delete().eq('id', link.id);
      throw new Error('Não foi possível autorizar o compartilhamento.');
    }
    return { token, id: link.id, expires_at };
  });

export const revokeSupplierLink = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: link, error } = await context.supabase.from('supplier_access_links').select('restaurant_id').eq('id', data.id).maybeSingle();
    if (error || !link) throw new Error('Link não encontrado ou sem permissão.');
    await authorize(context, link.restaurant_id);
    const { error: updateError } = await context.supabase.from('supplier_access_links').update({ revoked_at: new Date().toISOString() }).eq('id', data.id);
    if (updateError) throw new Error('Não foi possível revogar o link.');
    return { ok: true };
  });

export const getSupplierLinkToken = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from('supplier_access_links').select('restaurant_id').eq('id', data.id).maybeSingle();
    if (error || !row) throw new Error('Link não encontrado ou sem permissão.');
    await authorize(context, row.restaurant_id);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: link } = await supabaseAdmin.from('supplier_access_links').select('token,expires_at,revoked_at').eq('id', data.id).single();
    if (!link?.token) throw new Error('Este link foi criado antes da atualização e não pode ser reaberto. Gere um novo link.');
    if (link.revoked_at || new Date(link.expires_at).getTime() <= Date.now()) throw new Error('Link inativo.');
    return { token: link.token as string, expires_at: link.expires_at as string };
  });

export const deleteSupplierLink = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from('supplier_access_links').select('restaurant_id,revoked_at,expires_at').eq('id', data.id).maybeSingle();
    if (error || !row) throw new Error('Link não encontrado ou sem permissão.');
    await authorize(context, row.restaurant_id);
    if (!row.revoked_at && new Date(row.expires_at).getTime() > Date.now()) throw new Error('Revogue o link antes de excluí-lo.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { error: delError } = await supabaseAdmin.from('supplier_access_links').delete().eq('id', data.id);
    if (delError) throw new Error('Não foi possível excluir o link.');
    return { ok: true };
  });


export const getSupplierPanel = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).parse(d))
  .handler(async ({ data }) => {
    const { setResponseHeader } = await import('@tanstack/react-start/server');
    setResponseHeader('Cache-Control', 'no-store');
    const helpers = await import('@/lib/access-links.server');
    const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
    const { data: link, error: linkError } = await db.from('supplier_access_links').select('id,restaurant_id,supplier_id,expires_at,revoked_at').eq('token_hash', helpers.hashToken(data.token)).maybeSingle();
    if (linkError || !link) return { ok: false as const, message: 'Link inválido ou indisponível. Peça um novo link ao restaurante.' };
    const [sharing, restaurant, supplier] = await Promise.all([
      db.from('restaurant_supplier_access').select('enabled').eq('restaurant_id', link.restaurant_id).eq('supplier_id', link.supplier_id).maybeSingle(),
      db.from('restaurants').select('name,deleted_at').eq('id', link.restaurant_id).maybeSingle(),
      db.from('suppliers').select('name').eq('id', link.supplier_id).maybeSingle(),
    ]);
    const now = new Date();
    if (!supplierLinkAllowed(link, sharing.data?.enabled === true, !restaurant.data || !!restaurant.data.deleted_at, now) || !supplier.data) {
      return { ok: false as const, message: 'Este acesso foi desativado ou expirou. Peça um novo link ao restaurante.' };
    }
    const wines: SupplierPanelWine[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data: rows, error } = await db.from('wines').select('id,name,producer,vintage,volume,internal_code,image_url,cost_price,sale_price,grape').eq('restaurant_id', link.restaurant_id).eq('supplier_id', link.supplier_id).order('id').range(offset, offset + 999);
      if (error) throw new Error('Não foi possível carregar os rótulos. Tente novamente.');
      wines.push(...(rows ?? []));
      if (!rows || rows.length < 1000) break;
    }
    const currentMonth = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(now);
    const [year, month] = currentMonth.split('-').map(Number);
    const months = Array.from({ length: 4 }, (_, i) => {
      const date = new Date(Date.UTC(year, month - 4 + i, 1));
      return date.toISOString().slice(0, 7);
    });
    const allSales: SupplierSale[] = [];
    const stock: Record<string, number | null> = {};
    // Mesma regra do Cadastro de Produtos: última contagem fechada pela data de fechamento.
    const { data: session, error: sessionError } = await db.from('stock_count_sessions').select('id,reference_date,closed_at').eq('restaurant_id', link.restaurant_id).eq('status', 'closed').order('closed_at', { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
    if (sessionError) throw new Error('Não foi possível carregar a contagem.');
    for (let batch = 0; batch < wines.length; batch += 50) {
      const ids = wines.slice(batch, batch + 50).map(w => w.id);
      for (let offset = 0; ; offset += 1000) {
        const { data: rows, error } = await db.from('inventory_movements').select('wine_id,quantity,unit_price,occurred_at').eq('restaurant_id', link.restaurant_id).eq('movement_type', 'sale').in('wine_id', ids).order('id').range(offset, offset + 999);
        if (error) throw new Error('Não foi possível carregar as vendas.');
        allSales.push(...(rows ?? []));
        if (!rows || rows.length < 1000) break;
      }
      if (session) {
        const { data: items, error } = await db.from('stock_count_items').select('wine_id,counted_qty').eq('session_id', session.id).in('wine_id', ids);
        if (error) throw new Error('Não foi possível carregar o estoque.');
        for (const item of items ?? []) stock[item.wine_id] = item.counted_qty;
      }
    }
    const fromIso = new Date(`${months[0]}-01T03:00:00Z`).getTime();
    const sales = allSales.filter(s => new Date(s.occurred_at).getTime() >= fromIso);
    // Restaurant-wide totals stay server-side; only per-wine averages and a coarse share leave.
    let restaurantTotal = 0;
    let restaurantRevenue = 0;
    let firstRevMs = 0;
    const revFromMs = Date.UTC(year, month - 24, 1, 3);
    const launched = new Set<string>();
    for (let offset = 0; ; offset += 1000) {
      const { data: rows, error } = await db.from('inventory_movements').select('quantity,unit_price,occurred_at').eq('restaurant_id', link.restaurant_id).eq('movement_type', 'sale').order('id').range(offset, offset + 999);
      if (error) throw new Error('Não foi possível carregar as vendas.');
      for (const r of rows ?? []) {
        const d = new Date(r.occurred_at as string);
        launched.add(`${d.getFullYear()}-${d.getMonth()}`);
        if (d.getTime() >= fromIso) restaurantTotal += Number(r.quantity) || 0;
        if (d.getTime() >= revFromMs) {
          restaurantRevenue += (Number(r.quantity) || 0) * (Number(r.unit_price) || 0);
          if (!firstRevMs || d.getTime() < firstRevMs) firstRevMs = d.getTime();
        }
      }
      if (!rows || rows.length < 1000) break;
    }
    const monthly = monthlyAverages(allSales, launched.size);
    const perWine: Record<string, number> = {};
    for (const s of sales) perWine[s.wine_id] = (perWine[s.wine_id] ?? 0) + s.quantity;
    const shares: Record<string, number> = {};
    for (const w of wines) shares[w.id] = restaurantTotal > 0 ? Math.round(((perWine[w.id] ?? 0) / restaurantTotal) * 50) / 50 : 0;
    // Revenue share over up to 24 months (requested by the owner to be shown as a percentage).
    const revenueShares: Record<string, number> = {};
    for (const s of allSales) {
      if (new Date(s.occurred_at).getTime() < revFromMs) continue;
      revenueShares[s.wine_id] = (revenueShares[s.wine_id] ?? 0) + (Number(s.quantity) || 0) * (Number(s.unit_price) || 0);
    }
    for (const id of Object.keys(revenueShares)) revenueShares[id] = restaurantRevenue > 0 ? (revenueShares[id] / restaurantRevenue) * 100 : 0;
    const revenueMonths = firstRevMs ? Math.min(24, (year * 12 + month) - (new Date(firstRevMs).getUTCFullYear() * 12 + new Date(firstRevMs).getUTCMonth() + 1) + 1) : 0;
    const wineYears: Record<string, { curr: number[]; prev: number[] }> = {};
    for (const w of wines) wineYears[w.id] = { curr: yearlyBottles([w], allSales, year), prev: yearlyBottles([w], allSales, year - 1) };
    const yearCurr = yearlyBottles(wines, allSales, year);
    const yearPrev = yearlyBottles(wines, allSales, year - 1);
    await db.from('supplier_access_links').update({ last_access_at: now.toISOString() }).eq('id', link.id);
    return { ok: true as const, restaurantName: restaurant.data?.name ?? '', supplierName: supplier.data.name, wines, sales, stock, monthly, shares, revenueShares, revenueMonths, wineYears, yearCurr, yearPrev, currentYear: year, stockDate: session ? (session.closed_at ?? session.reference_date) : null, months, updatedAt: now.toISOString() };
  });