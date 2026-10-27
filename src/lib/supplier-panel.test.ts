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
    expect(monthlyAverages([{ wine_id: 'a', quantity: 6 }, { wine_id: 'a', quantity: 4 }], 4)).toEqual({ a: 2.5 });
  });
  it('soma garrafas por mês do ano, ignorando taças', () => {
    const wines = [{ id: 'a', volume: '750 ml' }, { id: 't', volume: 'Taça' }] as any;
    const sales = [{ wine_id: 'a', quantity: 3, unit_price: null, occurred_at: '2026-03-10T15:00:00Z' }, { wine_id: 't', quantity: 9, unit_price: null, occurred_at: '2026-03-10T15:00:00Z' }, { wine_id: 'a', quantity: 2, unit_price: null, occurred_at: '2025-03-10T15:00:00Z' }];
    expect(yearlyBottles(wines, sales, 2026)[2]).toBe(3);
    expect(yearlyBottles(wines, sales, 2025)[2]).toBe(2);
  });
});
