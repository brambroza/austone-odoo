import Link from 'next/link';
import { Building2, Clock, Mail, MessageCircle, Phone } from 'lucide-react';
import { SITE } from '@/lib/seo';
import { BrandWordmark } from '@/components/landing/brand-logo';

/** Footer with company identity, full contact channels and secondary links. */
export function LandingFooter() {
  const lineHref = `https://line.me/R/ti/p/${encodeURIComponent(SITE.lineId)}`;
  const telHref = `tel:${SITE.phone.replace(/-/g, '')}`;
  return (
    <footer id="contact" className="scroll-mt-28 border-t border-[var(--lp-line)] bg-white/60 px-4 py-12">
      <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-[1.3fr_1fr_0.7fr]">
        <div>
          <p className="flex items-center gap-3 text-lg font-extrabold"><BrandWordmark height={44} /> <span className="sr-only">{SITE.name}</span></p>
          <p className="mt-3 text-sm text-[var(--lp-muted)]">ระบบสั่งซื้อยาง AUSTONE สำหรับดีลเลอร์ ตัวแทนจำหน่ายทั่วประเทศไทย เชื่อมต่อกับระบบบัญชีและสต็อกของบริษัทโดยตรง</p>
          <address className="mt-5 flex items-start gap-2.5 text-sm not-italic text-[var(--lp-muted)]">
            <Building2 className="mt-0.5 size-4 shrink-0 text-[var(--lp-accent-ink)]" aria-hidden="true" />
            <span>
              <span className="block font-semibold text-[var(--lp-fg)]">{SITE.legalName}</span>
              <span className="block font-semibold text-[var(--lp-fg)]">{SITE.legalNameEn}</span>
              {SITE.address && <span className="block">{SITE.address}</span>}
            </span>
          </address>
        </div>

        <div>
          <p className="text-sm font-semibold">ติดต่อเรา</p>
          <ul className="mt-3 space-y-2.5 text-sm">
            <li>
              <a href={telHref} className="inline-flex items-center gap-2.5 hover:text-[var(--lp-accent-ink)]">
                <Phone className="size-4 shrink-0 text-[var(--lp-accent-ink)]" aria-hidden="true" /> {SITE.phone}
              </a>
            </li>
            <li>
              <a href={lineHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2.5 hover:text-[var(--lp-accent-ink)]">
                <MessageCircle className="size-4 shrink-0 text-[#06C755]" aria-hidden="true" /> LINE {SITE.lineId}
              </a>
            </li>
            {SITE.emails.map((email) => (
              <li key={email}>
                <a href={`mailto:${email}`} className="inline-flex items-center gap-2.5 break-all hover:text-[var(--lp-accent-ink)]">
                  <Mail className="size-4 shrink-0 text-[var(--lp-accent-ink)]" aria-hidden="true" /> {email}
                </a>
              </li>
            ))}
            <li>
              <a href={SITE.facebook} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2.5 hover:text-[var(--lp-accent-ink)]">
                <FacebookIcon /> Austone Thailand
              </a>
            </li>
            <li className="inline-flex items-center gap-2.5 text-[var(--lp-muted)]">
              <Clock className="size-4 shrink-0 text-[var(--lp-accent-ink)]" aria-hidden="true" /> {SITE.businessHours}
            </li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold">ลิงก์</p>
          <ul className="mt-3 space-y-2 text-sm text-[var(--lp-muted)]">
            <li><Link href="/tires" className="hover:text-[var(--lp-fg)]">แคตตาล็อกสินค้า</Link></li>
            <li><Link href="/login" className="hover:text-[var(--lp-fg)]">เข้าสู่ระบบดีลเลอร์</Link></li>
            <li><Link href="/#register" className="hover:text-[var(--lp-fg)]">สมัครเป็นดีลเลอร์</Link></li>
            <li><Link href="/#features" className="hover:text-[var(--lp-fg)]">ฟีเจอร์</Link></li>
            <li><Link href="/privacy" className="hover:text-[var(--lp-fg)]">นโยบายความเป็นส่วนตัว</Link></li>
            <li><Link href="/terms" className="hover:text-[var(--lp-fg)]">เงื่อนไขการใช้งาน</Link></li>
          </ul>
        </div>
      </div>
      <p className="mx-auto mt-10 max-w-5xl border-t border-[var(--lp-line)] pt-6 text-xs text-[var(--lp-muted)]">© {new Date().getFullYear()} {SITE.legalNameEn} · {SITE.legalName} สงวนลิขสิทธิ์</p>
    </footer>
  );
}

/** Facebook "f" glyph (lucide no longer ships brand icons). */
function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0 fill-[#1877F2]" aria-hidden="true">
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z" />
    </svg>
  );
}
