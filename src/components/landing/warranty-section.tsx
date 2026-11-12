import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { WARRANTIES, WARRANTY_NOTE } from '@/lib/landing-content';

/**
 * Austone warranty programmes (PCR 120 days, TBR 100 days) with the official posters.
 * The "no conditions" claim always ships with its footnote.
 */
export function WarrantySection() {
  return (
    <section id="warranty" className="scroll-mt-28 bg-[var(--lp-dark)] px-4 py-16 text-white" aria-labelledby="warranty-heading">
      <div className="mx-auto max-w-5xl">
        <div data-reveal className="max-w-2xl">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--lp-accent)]">
            <ShieldCheck className="size-4" aria-hidden="true" /> การรับประกัน
          </p>
          <h2 id="warranty-heading" className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
            เคลมทันที <span className="text-[var(--lp-accent)]">ไม่มีเงื่อนไข*</span>
          </h2>
          <p className="mt-2 text-white/70">ซื้อยาง AUSTONE แล้วลงทะเบียนการรับประกันออนไลน์ได้ทันที</p>
        </div>
        <ul className="mt-8 grid gap-5 sm:grid-cols-2">
          {WARRANTIES.map((w, i) => (
            <li key={w.title} data-reveal={i * 0.08} className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
              <div className="relative aspect-[7/10]">
                <Image src={w.image} alt={w.alt} fill sizes="(min-width: 640px) 480px, 100vw" className="object-cover" />
              </div>
              <div className="p-5">
                <span className="inline-flex rounded-full bg-[var(--lp-accent)] px-3 py-1 text-xs font-bold text-[var(--lp-accent-fg)]">{w.tag}</span>
                <h3 className="mt-3 text-lg font-bold">{w.title}</h3>
                <p className="mt-1 text-sm text-white/70">{w.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/60">{WARRANTY_NOTE}</p>
          <Link href="/#register" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--lp-accent)] hover:underline">
            สมัครเป็นดีลเลอร์ AUSTONE <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
