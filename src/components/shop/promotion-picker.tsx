import { Check, Gift, Sparkles } from 'lucide-react';
import { baht } from '@/lib/shop/catalog';
import type { CartPromotions } from '@/lib/shop/cart-coupon';
import { cn } from '@/lib/utils';

/**
 * Odoo automatic promotions the cart qualifies for; the dealer picks one (or none).
 * Each choice is its own form posting `rewardId` (0 = no promotion) to `action`.
 * Hints show promotions the cart has products for but has not reached yet.
 * Renders nothing when there is nothing to offer or hint.
 */
export function PromotionPicker({ promotions, action, amountNote }: {
  promotions: CartPromotions | undefined;
  action: (formData: FormData) => Promise<void>;
  /** Shown after the amounts, e.g. that the discount follows the payment method. */
  amountNote?: string | null;
}) {
  if (!promotions) return null;
  const { options, hints, selected, auto, notice, error } = promotions;
  if (!options.length && !hints.length && !error) return null;
  return (
    <section className="space-y-2 rounded-xl border border-border bg-card p-4" aria-labelledby="promo-heading">
      <div className="flex items-center justify-between gap-2">
        <h2 id="promo-heading" className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="size-4 text-primary" /> โปรโมชัน</h2>
        {options.length > 1 && <span className="text-[11px] text-muted-foreground">เลือกได้ 1 โปร</span>}
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-800 dark:text-amber-300">{notice}</p>}
      {options.length > 0 && (
        <ul className="space-y-1.5">
          {options.map((o) => {
            const active = selected?.rewardId === o.rewardId;
            return (
              <li key={o.rewardId}>
                <form action={action}>
                  <input type="hidden" name="rewardId" value={o.rewardId} />
                  <button type="submit" aria-pressed={active} disabled={active}
                    className={cn('flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left text-sm transition-colors', active ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/60')}>
                    <span className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border', active ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40')}>
                      {active && <Check className="size-3" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{o.programName}</span>
                      <span className="block text-xs text-muted-foreground">{o.label}{active && auto ? ' · เลือกให้อัตโนมัติ (คุ้มที่สุด)' : ''}</span>
                    </span>
                    <span className="shrink-0 text-right text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      {o.freeProduct ? <span className="flex items-center gap-1"><Gift className="size-3.5" /> แถม {o.freeProduct.qty}</span> : `−${baht(o.discount)}`}
                    </span>
                  </button>
                </form>
              </li>
            );
          })}
          <li>
            <form action={action}>
              <input type="hidden" name="rewardId" value={0} />
              <button type="submit" aria-pressed={!selected} disabled={!selected}
                className={cn('flex w-full items-center gap-2.5 rounded-lg border p-2.5 text-left text-xs text-muted-foreground transition-colors', !selected ? 'border-primary bg-primary/5' : 'border-dashed border-border hover:bg-muted/60')}>
                <span className={cn('flex size-4 shrink-0 items-center justify-center rounded-full border', !selected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40')}>
                  {!selected && <Check className="size-3" />}
                </span>
                ไม่ใช้โปรโมชัน
              </button>
            </form>
          </li>
        </ul>
      )}
      {amountNote && options.some((o) => o.discount > 0) && <p className="text-[11px] text-muted-foreground">{amountNote}</p>}
      {hints.length > 0 && (
        <ul className="space-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
          {hints.map((h) => (
            <li key={h.programId}>
              <span className="font-medium text-foreground">{h.programName}</span>
              {' · ซื้อสินค้าที่ร่วมรายการเพิ่มอีก '}
              {[h.missingQty > 0 ? `${h.missingQty.toLocaleString('th-TH')} ${h.unitName}` : '', h.missingAmount > 0 ? baht(h.missingAmount) : ''].filter(Boolean).join(' และ ')}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
