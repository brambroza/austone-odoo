import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PromotionDefinition } from '../promotion';

vi.mock('@/lib/odoo/loyalty', () => ({ findCoupon: vi.fn(), listPromotions: vi.fn() }));
const loyalty = await import('@/lib/odoo/loyalty');
const { checkCartPromotions } = await import('../cart-coupon');

const PCR = 4;
const product = { id: 10, tmplId: 10, name: 'ยาง', code: 'AT', listPrice: 2000, categoryId: PCR, categoryName: 'AT-PCR', brand: 'AT', dealerType: 'CAR', size: null, qtyAvailable: 99, imageUrl: null, baseUnit: 'เส้น', units: [], vatRate: 7, vatIncluded: true };
const catalog = { products: [product], pricelists: [], priceCtx: { itemsByPricelist: new Map(), categoryParents: new Map() }, loadedAt: new Date() };
const profile = { pricelistId: 19, priceBook: null, odooPartnerId: 900 };
const tier = (programId: number, minimumQty: number, discount: number): PromotionDefinition => ({
  programId, programName: `PCR ${minimumQty}+`, programType: 'promotion', active: true, dateFrom: null, dateTo: null, pricelistIds: [], limitUsage: false, maxUsage: 0, usedCount: 0,
  rules: [{ minimumAmount: 0, minimumQty, anyProduct: false, productIds: [], categoryId: PCR, unsupported: false, pointMode: 'order', pointAmount: 1 }],
  rewards: [{ id: programId, type: 'discount', description: '', discount, mode: 'percent', applicability: 'order', maxAmount: 0, productIds: [], categoryId: null, unsupported: false, requiredPoints: 1, freeProduct: null, multiProduct: false }],
});
// Credit price 2000, cash 1900 after the cash discount.
const lines = [{ product, qty: 40, unitPrice: 2000, cashDiscountPerUnit: 100 }];
type Args = Parameters<typeof checkCartPromotions>;
const run = (chosen: number | null) => checkCartPromotions(catalog as unknown as Args[0], profile as unknown as Args[1], lines as unknown as Args[2], ['CREDIT', 'CASH'], chosen);

describe('checkCartPromotions', () => {
  beforeEach(() => vi.mocked(loyalty.listPromotions).mockResolvedValue([tier(1, 8, 12), tier(2, 40, 16)]));

  it('computes each payment method on its own amounts and picks the best one for both', async () => {
    const result = await run(null);
    expect(result.CREDIT).toMatchObject({ selected: { rewardId: 2, discount: 12_800 }, auto: true, error: null });
    expect(result.CASH).toMatchObject({ selected: { rewardId: 2, discount: 12_160 } });
  });

  it('gives every method the reward the dealer picked, or none', async () => {
    const picked = await run(1);
    expect([picked.CREDIT?.selected?.rewardId, picked.CASH?.selected?.rewardId]).toEqual([1, 1]);
    const none = await run(0);
    expect([none.CREDIT?.selected, none.CASH?.selected]).toEqual([null, null]);
  });

  it('offers nothing and says so when Odoo cannot be read', async () => {
    vi.mocked(loyalty.listPromotions).mockRejectedValueOnce(new Error('down'));
    const result = await run(null);
    expect(result.CASH).toMatchObject({ options: [], selected: null, error: expect.stringContaining('Odoo') });
  });
});
