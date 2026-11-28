/**
 * Evaluates Odoo Loyalty automatic promotions (`promotion` / `buy_x_get_y` programs) against a
 * web cart, so the dealer sees which promotions the cart qualifies for and picks one.
 * Odoo stays the owner: the chosen reward is applied again on the sale order through Odoo's
 * reward wizard (see `odoo/loyalty.ts`) and the totals are compared afterwards.
 *
 * Points follow Odoo: every rule the cart meets adds points (per order, per unit or per baht),
 * a reward can be claimed once the points reach its `requiredPoints`. A free-product reward gives
 * `qty × floor(points / requiredPoints)` units; a discount is taken once.
 */
import { discountBase, inScope, round2, type CouponContext, type CouponLine, type CouponReward, type CouponRule } from './coupon';

export type PromotionRule = CouponRule & {
  /** How the rule earns points: once per order, per unit bought, or per baht spent. */
  pointMode: 'order' | 'unit' | 'money';
  pointAmount: number;
};

export type PromotionReward = CouponReward & {
  id: number;
  /** Free-product rewards: the product Odoo adds at 100% discount and how many per claim. */
  freeProduct: { id: number; name: string; qty: number } | null;
  /** The dealer would have to choose the free product (several products / a tag): not supported on the web. */
  multiProduct: boolean;
};

export type PromotionDefinition = {
  programId: number;
  programName: string;
  programType: string;
  active: boolean;
  dateFrom: string | null;
  dateTo: string | null;
  /** Empty = every pricelist. */
  pricelistIds: number[];
  limitUsage: boolean;
  maxUsage: number;
  usedCount: number;
  rules: PromotionRule[];
  rewards: PromotionReward[];
};

/** One cart line as a promotion sees it; `unitName` (e.g. เส้น) is only used in hints. */
export type PromotionLine = CouponLine & { unitName?: string };

/** A reward the cart can claim. `discount` is baht off the bill (0 for a free product). */
export type PromotionOption = {
  rewardId: number;
  programId: number;
  programName: string;
  label: string;
  discount: number;
  freeProduct: { id: number; name: string; qty: number } | null;
};

/** A promotion the cart has started on but not reached yet, e.g. "buy 4 more". */
export type PromotionHint = { programId: number; programName: string; missingQty: number; missingAmount: number; unitName: string };

export type PromotionEvaluation = { options: PromotionOption[]; hints: PromotionHint[] };

const HAS_THAI = /[฀-๿]/;
const MAX_HINTS = 3;

/** Whether a program can run at all for this dealer and day, independent of the cart. */
function programUsable(def: PromotionDefinition, ctx: CouponContext): boolean {
  if (!def.active) return false;
  if (def.dateFrom && ctx.today < def.dateFrom.slice(0, 10)) return false;
  if (def.dateTo && ctx.today > def.dateTo.slice(0, 10)) return false;
  if (def.pricelistIds.length && !def.pricelistIds.includes(ctx.pricelistId)) return false;
  if (def.limitUsage && def.maxUsage > 0 && def.usedCount >= def.maxUsage) return false;
  return !def.rules.some((r) => r.unsupported);
}

/** Lines a rule looks at, with their total quantity and amount. */
function ruleMatch(rule: PromotionRule, lines: PromotionLine[]) {
  const matching = rule.anyProduct ? lines : lines.filter((l) => inScope(l, rule.productIds, rule.categoryId));
  return {
    matching,
    qty: matching.reduce((sum, l) => sum + l.qty, 0),
    amount: matching.reduce((sum, l) => sum + l.amount, 0),
  };
}

/** Points the cart earns on a program; 0 when no rule is met. Odoo also requires a matching line. */
export function programPoints(rules: PromotionRule[], lines: PromotionLine[]): number {
  let points = 0;
  for (const rule of rules) {
    const { matching, qty, amount } = ruleMatch(rule, lines);
    if (!matching.length || qty < rule.minimumQty || amount < rule.minimumAmount) continue;
    points += rule.pointMode === 'unit' ? rule.pointAmount * qty : rule.pointMode === 'money' ? rule.pointAmount * amount : rule.pointAmount;
  }
  return round2(points);
}

/**
 * Readable Thai summary of a reward. Free products always show the product and count; for discounts
 * a Thai description written in Odoo wins over the generated one (Odoo's default ones are English).
 */
export function promotionLabel(reward: PromotionReward, freeQty = reward.freeProduct?.qty ?? 0): string {
  if (reward.type === 'product' && reward.freeProduct) return `แถม ${reward.freeProduct.name} × ${freeQty.toLocaleString('th-TH')}`;
  if (reward.description && HAS_THAI.test(reward.description)) return reward.description;
  const target = reward.applicability === 'specific' ? ' สินค้าที่ร่วมรายการ' : reward.applicability === 'cheapest' ? ' ชิ้นที่ถูกที่สุด' : ' ทั้งบิล';
  if (reward.mode === 'percent') return `ลด ${Number(reward.discount.toFixed(2))}%${target}`;
  return `ลด ฿${reward.discount.toLocaleString('th-TH')}${reward.mode === 'per_point' ? ' ต่อแต้ม' : ''}${target}`;
}

/** The claimable option for one reward, or null when the web cannot give it (shipping, product choice, unchecked scope, nothing to discount). */
function rewardOption(def: PromotionDefinition, reward: PromotionReward, points: number, lines: PromotionLine[]): PromotionOption | null {
  if (reward.unsupported || reward.multiProduct) return null;
  const claims = reward.requiredPoints > 0 ? Math.floor(points / reward.requiredPoints) : 1;
  if (claims < 1) return null;
  const base = { rewardId: reward.id, programId: def.programId, programName: def.programName };
  if (reward.type === 'product') {
    if (!reward.freeProduct) return null;
    const qty = reward.freeProduct.qty * claims;
    if (qty <= 0) return null;
    return { ...base, label: promotionLabel(reward, qty), discount: 0, freeProduct: { ...reward.freeProduct, qty } };
  }
  if (reward.type !== 'discount') return null;
  const amount = discountBase(reward, lines);
  if (amount <= 0) return null;
  let discount = reward.mode === 'percent' ? amount * (reward.discount / 100) : reward.mode === 'per_point' ? reward.discount * points : reward.discount;
  if (reward.maxAmount > 0) discount = Math.min(discount, reward.maxAmount);
  discount = round2(Math.min(discount, amount));
  return discount > 0 ? { ...base, label: promotionLabel(reward), discount, freeProduct: null } : null;
}

/** What is still missing for the closest rule of a program the cart has products for. */
function programHint(def: PromotionDefinition, lines: PromotionLine[]): PromotionHint | null {
  let best: PromotionHint | null = null;
  for (const rule of def.rules) {
    const { matching, qty, amount } = ruleMatch(rule, lines);
    if (!matching.length || rule.anyProduct) continue;
    const missingQty = Math.max(rule.minimumQty - qty, 0);
    const missingAmount = round2(Math.max(rule.minimumAmount - amount, 0));
    if (!missingQty && !missingAmount) continue;
    if (!best || missingQty < best.missingQty || (missingQty === best.missingQty && missingAmount < best.missingAmount)) {
      best = { programId: def.programId, programName: def.programName, missingQty, missingAmount, unitName: matching[0].unitName ?? 'ชิ้น' };
    }
  }
  return best;
}

/**
 * Every reward the cart can claim (largest discount first, free products after) and hints for
 * promotions the cart has products for but has not reached yet.
 */
export function evaluatePromotions(defs: PromotionDefinition[], lines: PromotionLine[], ctx: CouponContext): PromotionEvaluation {
  const options: PromotionOption[] = [];
  const hints: PromotionHint[] = [];
  for (const def of defs) {
    if (!programUsable(def, ctx)) continue;
    const points = programPoints(def.rules, lines);
    const claimable = points > 0 ? def.rewards.map((r) => rewardOption(def, r, points, lines)).filter((o): o is PromotionOption => o !== null) : [];
    if (claimable.length) options.push(...claimable);
    else {
      const hint = programHint(def, lines);
      if (hint) hints.push(hint);
    }
  }
  options.sort((a, b) => b.discount - a.discount || Number(Boolean(b.freeProduct)) - Number(Boolean(a.freeProduct)));
  hints.sort((a, b) => a.missingQty - b.missingQty || a.missingAmount - b.missingAmount);
  return { options, hints: hints.slice(0, MAX_HINTS) };
}

/**
 * The option an order gets. `chosen`: null = not picked yet (the best one, i.e. the first),
 * 0 = the dealer picked no promotion, otherwise the reward id. A choice the cart no longer
 * qualifies for falls back to the best option and says so in `notice`.
 */
export function pickPromotion(options: PromotionOption[], chosen: number | null): { option: PromotionOption | null; auto: boolean; notice: string | null } {
  if (chosen === 0) return { option: null, auto: false, notice: null };
  if (chosen !== null) {
    const picked = options.find((o) => o.rewardId === chosen);
    if (picked) return { option: picked, auto: false, notice: null };
    return { option: options[0] ?? null, auto: true, notice: 'โปรโมชันที่เลือกไว้ใช้กับตะกร้านี้ไม่ได้แล้ว' + (options.length ? ' เลือกโปรที่ดีที่สุดให้แทน' : '') };
  }
  return { option: options[0] ?? null, auto: true, notice: null };
}
