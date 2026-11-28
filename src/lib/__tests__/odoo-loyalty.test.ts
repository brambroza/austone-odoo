import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/odoo/rpc', () => ({ odooSearchRead: vi.fn(), odooRead: vi.fn(), odooWrite: vi.fn() }));
const { applyCouponToOrder, applyPromotionToOrder, buildProgramValues, generateCoupons, listPromotions, toDefinition, toPromotion } = await import('@/lib/odoo/loyalty');
const rpc = await import('@/lib/odoo/rpc');

const program = {
  id: 9, name: 'ลด 500', program_type: 'promo_code', trigger: 'with_code' as const, active: true,
  date_from: false as const, date_to: '2026-12-31' as string | false, pricelist_ids: [9], limit_usage: false, max_usage: 0, total_order_count: 3,
};
const rule = (patch: object = {}) => ({
  id: 1, mode: 'with_code' as const, code: 'TIRE500', minimum_amount: 5000, minimum_qty: 0, any_product: false,
  valid_product_ids: [] as number[], product_ids: [] as number[], product_category_id: false as const, product_tag_id: false as [number, string] | false, product_domain: '[]', ...patch,
});
const reward = {
  id: 2, reward_type: 'discount' as const, description: 'ลด 500 บาท', discount: 500, discount_mode: 'per_order' as const, discount_applicability: 'order' as const,
  discount_max_amount: 0, required_points: 1, all_discount_product_ids: [], discount_product_ids: [], discount_product_category_id: false as const, discount_product_tag_id: false as const, discount_product_domain: '[]',
};

describe('toDefinition', () => {
  it('keeps only the code rule that matched plus automatic rules', () => {
    const def = toDefinition('TIRE500', program, [rule(), rule({ id: 3, code: 'OTHER' }), rule({ id: 4, mode: 'auto', code: false })], [reward], null, 1);
    expect(def.rules).toHaveLength(2);
    expect(def).toMatchObject({ source: 'rule', programId: 9, dateTo: '2026-12-31', dateFrom: null, pricelistIds: [9], usedCount: 3 });
    expect(def.rewards[0]).toMatchObject({ mode: 'per_order', discount: 500, unsupported: false });
  });

  it('merges Odoo computed products with explicit ones and keeps the category', () => {
    const def = toDefinition('X', program, [rule({ valid_product_ids: [5], product_ids: [5, 6], product_category_id: [11, 'YK-PCR'] })], [reward], null, 1);
    expect(def.rules[0]).toMatchObject({ productIds: [5, 6], categoryId: 11, unsupported: false });
  });

  it('marks a tag or custom domain filter as unsupported when Odoo gives no computed products', () => {
    expect(toDefinition('X', program, [rule({ product_tag_id: [1, 'Promo'] })], [reward], null, 1).rules[0].unsupported).toBe(true);
    expect(toDefinition('X', program, [rule({ product_domain: "[('list_price', '>', 100)]" })], [reward], null, 1).rules[0].unsupported).toBe(true);
    expect(toDefinition('X', program, [rule({ product_domain: "[('list_price', '>', 100)]", valid_product_ids: [5] })], [reward], null, 1).rules[0].unsupported).toBe(false);
  });

  it('reads Odoo 19 rules (no any_product): no product filter means any product', () => {
    const odoo19 = (patch: object) => { const { any_product: _a, valid_product_ids: _v, ...r } = rule(patch); return r; };
    expect(toDefinition('X', program, [odoo19({})], [reward], null, 1).rules[0]).toMatchObject({ anyProduct: true, productIds: [] });
    expect(toDefinition('X', program, [odoo19({ product_category_id: [4, 'AT-PCR'] })], [reward], null, 1).rules[0]).toMatchObject({ anyProduct: false, categoryId: 4 });
    expect(toDefinition('X', program, [odoo19({ product_tag_id: [1, 'Promo'] })], [reward], null, 1).rules[0]).toMatchObject({ anyProduct: false, unsupported: true });
  });

  it('describes a coupon card', () => {
    const card = { id: 7, program_id: [9, 'x'] as [number, string], code: '044f', points: 1, expiration_date: false as const, partner_id: [900, 'ร้าน'] as [number, string], active: true };
    expect(toDefinition('044f', program, [], [reward], card, null)).toMatchObject({ source: 'card', card: { points: 1, partnerId: 900, expirationDate: null } });
  });
});

describe('buildProgramValues', () => {
  const base = {
    name: 'ลด 5%', kind: 'promo_code' as const, code: 'YEAREND5', discount: 5, mode: 'percent' as const, applicability: 'order' as const,
    categoryId: null, maxAmount: 1000, minimumAmount: 5000, minimumQty: 4, dateFrom: null, dateTo: '2026-12-31', maxUsage: 0,
  };

  it('builds a promo-code program with one code rule and one discount reward, replacing Odoo defaults', () => {
    const values = buildProgramValues(base);
    expect(values).toMatchObject({ program_type: 'promo_code', trigger: 'with_code', applies_on: 'current', date_from: false, date_to: '2026-12-31', limit_usage: false });
    expect(values.rule_ids).toEqual([[5, 0, 0], [0, 0, expect.objectContaining({ mode: 'with_code', code: 'YEAREND5', minimum_amount: 5000, minimum_qty: 4 })]]);
    expect(values.reward_ids).toEqual([[5, 0, 0], [0, 0, expect.objectContaining({ reward_type: 'discount', discount: 5, discount_mode: 'percent', discount_applicability: 'order', discount_max_amount: 1000, required_points: 1 })]]);
  });

  it('builds a coupon program without rules and limits usage when asked', () => {
    const values = buildProgramValues({ ...base, kind: 'coupons', code: null, maxUsage: 50 });
    expect(values).toMatchObject({ program_type: 'coupons', limit_usage: true, max_usage: 50, rule_ids: [[5, 0, 0]] });
  });

  it('sets the category only for a specific discount and drops the cap for a baht discount', () => {
    const reward = (patch: object) => (buildProgramValues({ ...base, ...patch }).reward_ids as unknown[][])[1][2];
    expect(reward({ applicability: 'specific', categoryId: 11 })).toMatchObject({ discount_product_category_id: 11 });
    expect(reward({ categoryId: 11 })).not.toHaveProperty('discount_product_category_id');
    expect(reward({ mode: 'per_order', discount: 500 })).toMatchObject({ discount_mode: 'per_order', discount_max_amount: 0 });
  });
});

describe('generateCoupons', () => {
  it('creates one 1-point card per coupon for the partner and returns the codes Odoo generated', async () => {
    vi.mocked(rpc.odooWrite).mockResolvedValueOnce([31, 32]);
    vi.mocked(rpc.odooSearchRead).mockResolvedValueOnce([{ code: 'a1' }, { code: 'b2' }]);
    await expect(generateCoupons(9, { count: 2, partnerId: 900, expirationDate: '2026-12-31' })).resolves.toEqual(['a1', 'b2']);
    expect(rpc.odooWrite).toHaveBeenCalledWith('loyalty.card', 'create', [[
      { program_id: 9, points: 1, partner_id: 900, expiration_date: '2026-12-31' },
      { program_id: 9, points: 1, partner_id: 900, expiration_date: '2026-12-31' },
    ]]);
  });
});

describe('toPromotion', () => {
  const promo = { ...program, id: 4, name: 'PCR กระเป๋า', program_type: 'promotion', trigger: 'auto' as const, date_to: false as const, pricelist_ids: [19, 27] };
  const autoRule = (patch: object = {}) => ({ id: 6, program_id: [4, 'x'] as [number, string], mode: 'auto' as const, code: false as const, minimum_amount: 0, minimum_qty: 4,
    product_ids: [] as number[], product_category_id: [4, 'AT-PCR'] as [number, string], product_tag_id: false as const, product_domain: '[]', reward_point_amount: 1, reward_point_mode: 'order' as const, ...patch });
  const bag = { ...reward, id: 6, program_id: [4, 'x'] as [number, string], reward_type: 'product' as const, description: 'Free Product - กระเป๋า', discount_applicability: 'order' as const,
    reward_product_id: [228, 'กระเป๋าเดินทาง Austone 20 นิ้ว'] as [number, string], reward_product_ids: [228], reward_product_qty: 1, multi_product: false, reward_product_tag_id: false as const };

  it('keeps the program own automatic rules with their points and the free product', () => {
    const def = toPromotion(promo, [autoRule(), autoRule({ id: 19, minimum_qty: 8, reward_point_mode: 'unit' }), autoRule({ id: 99, program_id: [5, 'other'] }), autoRule({ id: 7, mode: 'with_code', code: 'X' })], [bag]);
    expect(def).toMatchObject({ programId: 4, programName: 'PCR กระเป๋า', pricelistIds: [19, 27], dateTo: null });
    expect(def.rules).toEqual([
      expect.objectContaining({ minimumQty: 4, categoryId: 4, pointMode: 'order', pointAmount: 1 }),
      expect.objectContaining({ minimumQty: 8, pointMode: 'unit' }),
    ]);
    expect(def.rewards[0]).toMatchObject({ id: 6, type: 'product', freeProduct: { id: 228, name: 'กระเป๋าเดินทาง Austone 20 นิ้ว', qty: 1 }, multiProduct: false });
  });

  it('lists active automatic promotions from Odoo and caches them', async () => {
    vi.mocked(rpc.odooSearchRead).mockReset()
      .mockResolvedValueOnce([promo]).mockResolvedValueOnce([autoRule()]).mockResolvedValueOnce([bag]);
    const first = await listPromotions();
    expect(first.map((p) => [p.programId, p.rules.length, p.rewards.length])).toEqual([[4, 1, 1]]);
    expect(rpc.odooSearchRead).toHaveBeenNthCalledWith(1, 'loyalty.program', [['program_type', 'in', ['promotion', 'buy_x_get_y']], ['trigger', '=', 'auto'], ['active', '=', true]], expect.any(Array), { order: 'sequence, id' });
    await expect(listPromotions()).resolves.toBe(first);
    expect(rpc.odooSearchRead).toHaveBeenCalledTimes(3);
  });

  it('flags a free product the dealer would have to choose', () => {
    expect(toPromotion(promo, [], [{ ...bag, reward_product_ids: [228, 229] }]).rewards[0].multiProduct).toBe(true);
    expect(toPromotion(promo, [], [{ ...bag, reward_product_tag_id: [3, 'bags'] as [number, string] }]).rewards[0].multiProduct).toBe(true);
  });
});

describe('applying rewards to a sale order', () => {
  beforeEach(() => {
    vi.mocked(rpc.odooRead).mockReset();
    vi.mocked(rpc.odooWrite).mockReset();
  });

  it('applies the chosen promotion through the reward wizard when Odoo offers several', async () => {
    vi.mocked(rpc.odooRead).mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    vi.mocked(rpc.odooWrite).mockResolvedValueOnce({ res_model: 'sale.loyalty.reward.wizard' }).mockResolvedValueOnce(41).mockResolvedValueOnce(true);
    await applyPromotionToOrder(3300, 8);
    expect(rpc.odooWrite).toHaveBeenNthCalledWith(1, 'sale.order', 'action_open_reward_wizard', [[3300]]);
    expect(rpc.odooWrite).toHaveBeenNthCalledWith(2, 'sale.loyalty.reward.wizard', 'create', [[{ order_id: 3300, selected_reward_id: 8 }]]);
    expect(rpc.odooWrite).toHaveBeenNthCalledWith(3, 'sale.loyalty.reward.wizard', 'action_apply', [[41]]);
    expect(rpc.odooRead).toHaveBeenCalledWith('sale.order.line', 'search_count', [[['order_id', '=', 3300], ['reward_id', '=', 8]]]);
  });

  it('accepts Odoo applying the only claimable reward itself', async () => {
    vi.mocked(rpc.odooRead).mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    vi.mocked(rpc.odooWrite).mockResolvedValueOnce(true);
    await applyPromotionToOrder(3300, 6);
    expect(rpc.odooWrite).toHaveBeenCalledTimes(1);
  });

  it('skips a promotion already on the order and throws when Odoo did not give it', async () => {
    vi.mocked(rpc.odooRead).mockResolvedValueOnce(1);
    await applyPromotionToOrder(3300, 6);
    expect(rpc.odooWrite).not.toHaveBeenCalled();
    vi.mocked(rpc.odooRead).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    vi.mocked(rpc.odooWrite).mockResolvedValueOnce(true);
    await expect(applyPromotionToOrder(3300, 6)).rejects.toThrow('reward #6');
  });

  it('still applies a coupon when the order already has a promotion line of another program', async () => {
    vi.mocked(rpc.odooRead).mockResolvedValueOnce(0);
    vi.mocked(rpc.odooWrite).mockResolvedValueOnce(51).mockResolvedValueOnce(true);
    await applyCouponToOrder(3300, 'TIRE500', 9);
    expect(rpc.odooRead).toHaveBeenCalledWith('sale.order.line', 'search_count', [[['order_id', '=', 3300], ['reward_id.program_id', '=', 9]]]);
    expect(rpc.odooWrite).toHaveBeenCalledWith('sale.loyalty.coupon.wizard', 'create', [[{ order_id: 3300, coupon_code: 'TIRE500' }]]);
  });
});
