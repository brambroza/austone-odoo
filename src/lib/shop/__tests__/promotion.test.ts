import { describe, expect, it } from 'vitest';
import { evaluatePromotions, pickPromotion, programPoints, promotionLabel, type PromotionDefinition, type PromotionLine, type PromotionReward, type PromotionRule } from '../promotion';

const PCR = 4;
const TBR = 8;
const SK = 5;

const rule = (patch: Partial<PromotionRule> = {}): PromotionRule => ({
  minimumAmount: 0, minimumQty: 0, anyProduct: false, productIds: [], categoryId: PCR, unsupported: false, pointMode: 'order', pointAmount: 1, ...patch,
});
const reward = (patch: Partial<PromotionReward> = {}): PromotionReward => ({
  id: 1, type: 'discount', description: '', discount: 12, mode: 'percent', applicability: 'specific', maxAmount: 0,
  productIds: [], categoryId: PCR, unsupported: false, requiredPoints: 1, freeProduct: null, multiProduct: false, ...patch,
});
const program = (patch: Partial<PromotionDefinition> = {}): PromotionDefinition => ({
  programId: 9, programName: 'PCR 8-24 เส้น', programType: 'promotion', active: true, dateFrom: null, dateTo: null, pricelistIds: [],
  limitUsage: false, maxUsage: 0, usedCount: 0, rules: [rule({ minimumQty: 8 })], rewards: [reward()], ...patch,
});
const pcr = (qty: number, amount = qty * 2000): PromotionLine => ({ productId: 10, categoryIds: [PCR, 1], qty, amount, unitName: 'เส้น' });
const ctx = { pricelistId: 19, partnerId: 900, today: '2026-11-26' };

/** The tiered PCR promotions and the luggage giveaway as configured in Odoo. */
const tiers = [
  program({ programId: 9, programName: 'PCR 8-24 เส้น', rules: [rule({ minimumQty: 8 })], rewards: [reward({ id: 9, discount: 12 })] }),
  program({ programId: 10, programName: 'PCR 25-40 เส้น', rules: [rule({ minimumQty: 25 })], rewards: [reward({ id: 10, discount: 14 })] }),
  program({ programId: 8, programName: 'PCR 40 เส้นขึ้นไป', rules: [rule({ minimumQty: 40 })], rewards: [reward({ id: 8, discount: 16 })] }),
];
const luggage = program({
  programId: 4, programName: 'PCR กระเป๋า',
  rules: [4, 8, 12, 16].map((minimumQty) => rule({ minimumQty })),
  rewards: [reward({ id: 6, type: 'product', applicability: 'order', categoryId: null, description: 'Free Product - กระเป๋า', freeProduct: { id: 228, name: 'กระเป๋าเดินทาง Austone 20 นิ้ว', qty: 1 } })],
});

describe('programPoints', () => {
  it('adds points for every rule met, per order, per unit or per baht', () => {
    expect(programPoints(luggage.rules, [pcr(13)])).toBe(3);
    expect(programPoints([rule({ pointMode: 'unit', pointAmount: 1 })], [pcr(6)])).toBe(6);
    expect(programPoints([rule({ pointMode: 'money', pointAmount: 0.01 })], [pcr(2, 3000)])).toBe(30);
  });

  it('needs at least one matching line even when the rule has no minimum', () => {
    expect(programPoints([rule({ categoryId: TBR })], [pcr(10)])).toBe(0);
  });
});

describe('evaluatePromotions', () => {
  it('lists every qualifying tier, largest discount first', () => {
    const { options } = evaluatePromotions(tiers, [pcr(40)], ctx);
    expect(options.map((o) => [o.rewardId, o.discount])).toEqual([[8, 12_800], [10, 11_200], [9, 9_600]]);
    expect(options[0]).toMatchObject({ programName: 'PCR 40 เส้นขึ้นไป', label: 'ลด 16% สินค้าที่ร่วมรายการ', freeProduct: null });
  });

  it('discounts only the products in the reward scope', () => {
    const exchange = program({ programId: 20, rules: [rule({ categoryId: TBR, pointMode: 'unit' })], rewards: [reward({ id: 22, discount: 10, categoryId: SK })] });
    const lines = [{ productId: 1, categoryIds: [TBR], qty: 2, amount: 20_000 }, { productId: 2, categoryIds: [SK], qty: 2, amount: 5_000 }];
    expect(evaluatePromotions([exchange], lines, ctx).options[0]).toMatchObject({ rewardId: 22, discount: 500 });
    expect(evaluatePromotions([exchange], lines.slice(0, 1), ctx).options).toEqual([]);
  });

  it('gives one free product per point and puts it after discounts', () => {
    const { options } = evaluatePromotions([luggage, ...tiers], [pcr(13)], ctx);
    expect(options.map((o) => o.rewardId)).toEqual([9, 6]);
    expect(options[1]).toMatchObject({ discount: 0, freeProduct: { id: 228, qty: 3 }, label: 'แถม กระเป๋าเดินทาง Austone 20 นิ้ว × 3' });
  });

  it('skips programs for another pricelist, out of dates, used up or with filters the web cannot check', () => {
    const lines = [pcr(10)];
    expect(evaluatePromotions([program({ pricelistIds: [1, 26] })], lines, ctx).options).toEqual([]);
    expect(evaluatePromotions([program({ pricelistIds: [19, 27] })], lines, ctx).options).toHaveLength(1);
    expect(evaluatePromotions([program({ dateTo: '2026-11-25' })], lines, ctx).options).toEqual([]);
    expect(evaluatePromotions([program({ dateFrom: '2026-11-27' })], lines, ctx).options).toEqual([]);
    expect(evaluatePromotions([program({ limitUsage: true, maxUsage: 5, usedCount: 5 })], lines, ctx).options).toEqual([]);
    expect(evaluatePromotions([program({ rules: [rule({ minimumQty: 8, unsupported: true })] })], lines, ctx).options).toEqual([]);
    expect(evaluatePromotions([program({ rewards: [reward({ unsupported: true })] })], lines, ctx).options).toEqual([]);
    expect(evaluatePromotions([program({ rewards: [reward({ type: 'shipping' })] })], lines, ctx).options).toEqual([]);
    expect(evaluatePromotions([program({ rewards: [reward({ type: 'product', multiProduct: true, freeProduct: { id: 1, name: 'x', qty: 1 } })] })], lines, ctx).options).toEqual([]);
  });

  it('caps a percent discount and a fixed amount at what it applies to', () => {
    expect(evaluatePromotions([program({ rewards: [reward({ maxAmount: 500 })] })], [pcr(10)], ctx).options[0].discount).toBe(500);
    expect(evaluatePromotions([program({ rewards: [reward({ mode: 'per_order', discount: 99_999, applicability: 'order' })] })], [pcr(10)], ctx).options[0].discount).toBe(20_000);
  });

  it('hints how many more units reach a promotion the cart has products for', () => {
    const { options, hints } = evaluatePromotions(tiers, [pcr(5)], ctx);
    expect(options).toEqual([]);
    expect(hints).toEqual([
      { programId: 9, programName: 'PCR 8-24 เส้น', missingQty: 3, missingAmount: 0, unitName: 'เส้น' },
      { programId: 10, programName: 'PCR 25-40 เส้น', missingQty: 20, missingAmount: 0, unitName: 'เส้น' },
      { programId: 8, programName: 'PCR 40 เส้นขึ้นไป', missingQty: 35, missingAmount: 0, unitName: 'เส้น' },
    ]);
    expect(evaluatePromotions(tiers, [{ productId: 1, categoryIds: [TBR], qty: 5, amount: 1 }], ctx).hints).toEqual([]);
  });
});

describe('pickPromotion', () => {
  const { options } = evaluatePromotions(tiers, [pcr(40)], ctx);

  it('takes the best option until the dealer picks', () => {
    expect(pickPromotion(options, null)).toMatchObject({ option: { rewardId: 8 }, auto: true, notice: null });
  });

  it('keeps the dealer pick, or none', () => {
    expect(pickPromotion(options, 9)).toMatchObject({ option: { rewardId: 9 }, auto: false });
    expect(pickPromotion(options, 0)).toEqual({ option: null, auto: false, notice: null });
  });

  it('falls back to the best option with a notice when the pick no longer applies', () => {
    expect(pickPromotion(options, 999)).toMatchObject({ option: { rewardId: 8 }, auto: true, notice: expect.stringContaining('ใช้กับตะกร้านี้ไม่ได้แล้ว') });
    expect(pickPromotion([], 999)).toMatchObject({ option: null, notice: 'โปรโมชันที่เลือกไว้ใช้กับตะกร้านี้ไม่ได้แล้ว' });
  });
});

describe('promotionLabel', () => {
  it('prefers a Thai description from Odoo over the generated label', () => {
    expect(promotionLabel(reward({ description: 'ส่วนลดแลกซื้อ' }))).toBe('ส่วนลดแลกซื้อ');
    expect(promotionLabel(reward({ description: '12% on specific products' }))).toBe('ลด 12% สินค้าที่ร่วมรายการ');
    expect(promotionLabel(reward({ discount: 4.7619 }))).toBe('ลด 4.76% สินค้าที่ร่วมรายการ');
    expect(promotionLabel(reward({ type: 'product', description: 'Free Product - x', freeProduct: { id: 1, name: 'กระเป๋า', qty: 1 } }), 3)).toBe('แถม กระเป๋า × 3');
  });
});
