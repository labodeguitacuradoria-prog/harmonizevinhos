import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
const expect = (actual: unknown) => ({ toBe: (expected: unknown) => assert.equal(actual, expected) });
import { supplierLinkAllowed, supplierSales, type SupplierPanelWine } from './supplier-panel';
const now = new Date('2026-10-23T12:00:00Z');
const link = { revoked_at: null, expires_at: '2026-11-23T12:00:00Z' };
describe('supplier quick link access', () => {
  it('allows an active authorized link', () => expect(supplierLinkAllowed(link, true, false, now)).toBe(true));
  it('blocks revocation', () => expect(supplierLinkAllowed({ ...link, revoked_at: now.toISOString() }, true, false, now)).toBe(false));
  it('blocks expired links', () => expect(supplierLinkAllowed({ ...link, expires_at: now.toISOString() }, true, false, now)).toBe(false));
  it('blocks disabled sharing', () => expect(supplierLinkAllowed(link, false, false, now)).toBe(false));
  it('blocks deleted restaurants', () => expect(supplierLinkAllowed(link, true, true, now)).toBe(false));
});
describe('supplier sales scope', () => {
  const wine = { id: 'own', sale_price: 100, volume: '750ml' } as SupplierPanelWine;
  it('excludes competitor wines even when movements are supplied', () => {
    expect(supplierSales([wine], [{ wine_id: 'other', quantity: 12, unit_price: 100, occurred_at: now.toISOString() }], '2026-10').bottles).toBe(0);
  });
  it('counts bottles, not glasses', () => {
    expect(supplierSales([{ ...wine, volume: 'Taça' }], [{ wine_id: 'own', quantity: 12, unit_price: 20, occurred_at: now.toISOString() }], '2026-10').bottles).toBe(0);
  });
  it('uses Sao Paulo months and movement price', () => {
    const result = supplierSales([wine], [{ wine_id: 'own', quantity: 2, unit_price: 80, occurred_at: '2026-11-01T01:00:00Z' }], '2026-10');
    expect(result.bottles).toBe(2); expect(result.revenue).toBe(160);
  });
});
import { monthlyAverages, yearlyBottles } from './supplier-panel';
describe('venda mensal e comparativo anual', () => {
  it('divide o total do rótulo pelos meses lançados no restaurante', () => {
    expect(monthlyAverages([{ wine_id: 'a', quantity: 6 }, { wine_id: 'a', quantity: 4 }], 4).a).toBe(2.5);
  });
  it('soma garrafas por mês do ano, ignorando taças', () => {
    const wines = [{ id: 'a', volume: '750 ml' }, { id: 't', volume: 'Taça' }] as any;
    const sales = [{ wine_id: 'a', quantity: 3, unit_price: null, occurred_at: '2026-03-10T15:00:00Z' }, { wine_id: 't', quantity: 9, unit_price: null, occurred_at: '2026-03-10T15:00:00Z' }, { wine_id: 'a', quantity: 2, unit_price: null, occurred_at: '2025-03-10T15:00:00Z' }];
    expect(yearlyBottles(wines, sales, 2026)[2]).toBe(3);
    expect(yearlyBottles(wines, sales, 2025)[2]).toBe(2);
  });
});

import { isGlassVolume, accumulateBottles } from './supplier-panel';
describe('participação em garrafas', () => {
  const from = Date.UTC(2026, 9, 1, 3); // 01/10/2026
  it('reconhece taça como não-garrafa', () => {
    expect(isGlassVolume('Taça 150ml')).toBe(true);
    expect(isGlassVolume('750 ml')).toBe(false);
    expect(isGlassVolume(null)).toBe(false);
  });
  it('soma garrafas e deixa as taças fora do total da casa', () => {
    const rows = [
      { wine_id: 'a', quantity: 4, occurred_at: '2026-10-10T15:00:00Z' },
      { wine_id: 't', quantity: 30, occurred_at: '2026-10-10T15:00:00Z' },
      { wine_id: 'b', quantity: 6, occurred_at: '2026-10-12T15:00:00Z' },
    ];
    const s = accumulateBottles({ total: 0, firstMs: 0, byWine: {} }, rows, new Set(['t']), from);
    expect(s.total).toBe(10);
    expect(s.byWine.a).toBe(4);
    expect(s.byWine.t).toBe(undefined);
    expect(Math.round((s.byWine.a / s.total) * 1000) / 10).toBe(40);
  });
  it('descarta o que é anterior à janela e marca a primeira venda', () => {
    const rows = [
      { wine_id: 'a', quantity: 5, occurred_at: '2026-09-30T20:00:00Z' },
      { wine_id: 'a', quantity: 2, occurred_at: '2026-10-05T15:00:00Z' },
    ];
    const s = accumulateBottles({ total: 0, firstMs: 0, byWine: {} }, rows, new Set<string>(), from);
    expect(s.total).toBe(2);
    expect(s.firstMs).toBe(new Date('2026-10-05T15:00:00Z').getTime());
  });
});
