import { findCoupon, listPromotions } from '@/lib/odoo/loyalty';
import type { Catalog } from './catalog';
import { evaluateCoupon, type CouponLine, type CouponResult } from './coupon';
import { evaluatePromotions, pickPromotion, type PromotionHint, type PromotionLine, type PromotionOption } from './promotion';
import { categoryChain } from './price-engine';
import { orderPricelistId } from './pricing';
import type { CatalogProduct, DealerProfile, PaymentMethod } from './types';

export type PricedLine = { product: CatalogProduct; qty: number; unitPrice: number; cashDiscountPerUnit: number };

/** Today in Thailand as YYYY-MM-DD (coupon dates in Odoo are calendar dates). */
export function bangkokToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(now);
}

/** Cart lines as the coupon sees them; cash payment uses the price after the cash discount. */
export function couponLines(catalog: Catalog, lines: PricedLine[], method: PaymentMethod): (CouponLine & PromotionLine)[] {
  return lines.map((l) => ({
    unitName: l.product.baseUnit,
    productId: l.product.id,
    categoryIds: categoryChain(l.product.categoryId, catalog.priceCtx.categoryParents),
    qty: l.qty,
    amount: l.qty * (l.unitPrice - (method === 'CASH' ? l.cashDiscountPerUnit : 0)),
  }));
}

/**
 * Looks the code up in Odoo and evaluates it for each payment method the dealer may choose.
 * Odoo errors come back as a failed result so the cart still renders.
 */
export async function checkCartCoupon(code: string, catalog: Catalog, profile: DealerProfile, lines: PricedLine[], methods: PaymentMethod[]): Promise<Partial<Record<PaymentMethod, CouponResult>>> {
  const fail = (reason: string) => Object.fromEntries(methods.map((m) => [m, { ok: false, reason } as CouponResult]));
  let definition;
  try {
    definition = await findCoupon(code);
  } catch {
    return fail('ตรวจโค้ดกับ Odoo ไม่ได้ ลองใหม่อีกครั้ง');
  }
  if (!definition) return fail('ไม่พบโค้ดนี้');
  const ctx = { pricelistId: orderPricelistId(profile), partnerId: profile.odooPartnerId, today: bangkokToday() };
  return Object.fromEntries(methods.map((m) => [m, evaluateCoupon(definition, couponLines(catalog, lines, m), ctx)]));
}

/** Promotions of a cart for one payment method: what it can claim, what it is close to, and what the order gets. */
export type CartPromotions = {
  options: PromotionOption[];
  hints: PromotionHint[];
  selected: PromotionOption | null;
  /** True when the web picked the best option because the dealer has not chosen (or the choice no longer applies). */
  auto: boolean;
  notice: string | null;
  /** Odoo could not be read: no promotion is offered (the cart and checkout still work). */
  error: string | null;
};

/**
 * Evaluates Odoo's automatic promotions for each payment method. `chosen` is the cart's pick
 * (see `store.getCartPromotion`). The pick is resolved on the first method, so every method
 * gets the same reward when it qualifies.
 */
export async function checkCartPromotions(catalog: Catalog, profile: DealerProfile, lines: PricedLine[], methods: PaymentMethod[], chosen: number | null): Promise<Partial<Record<PaymentMethod, CartPromotions>>> {
  let definitions;
  try {
    definitions = await listPromotions();
  } catch {
    const failed: CartPromotions = { options: [], hints: [], selected: null, auto: false, notice: null, error: 'อ่านโปรโมชันจาก Odoo ไม่ได้ ลองใหม่อีกครั้ง' };
    return Object.fromEntries(methods.map((m) => [m, failed]));
  }
  const ctx = { pricelistId: orderPricelistId(profile), partnerId: profile.odooPartnerId, today: bangkokToday() };
  const result: Partial<Record<PaymentMethod, CartPromotions>> = {};
  let rewardId: number | null = chosen;
  for (const method of methods) {
    const { options, hints } = evaluatePromotions(definitions, couponLines(catalog, lines, method), ctx);
    const pick = pickPromotion(options, rewardId);
    // Later methods follow the first method's resolved pick (or "none").
    if (method === methods[0]) rewardId = pick.option?.rewardId ?? (chosen === 0 ? 0 : null);
    result[method] = { options, hints, selected: pick.option, auto: pick.auto, notice: method === methods[0] ? pick.notice : null, error: null };
  }
  return result;
}
