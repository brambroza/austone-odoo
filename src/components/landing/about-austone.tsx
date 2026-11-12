import { BrandWordmark } from '@/components/landing/brand-logo';

type AboutProps = { heading: string; body: string; facts: readonly { value: string; label: string }[] };

/** "About us" block with the company story from the Austone Thailand website. */
export function AboutAustone({ heading, body, facts }: AboutProps) {
  return (
    <section id="about" className="mx-auto max-w-5xl scroll-mt-28 px-4 py-16" aria-labelledby="about-heading">
      <div data-reveal className="grid gap-8 rounded-3xl border border-[var(--lp-line)] bg-[var(--lp-bg-2)] p-6 sm:p-10 md:grid-cols-[1.2fr_0.8fr] md:items-center">
        <div>
          <p className="text-sm font-semibold text-[var(--lp-accent-ink)]">About us</p>
          <h2 id="about-heading" className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{heading}</h2>
          <p className="mt-4 leading-relaxed text-[var(--lp-muted)]">{body}</p>
        </div>
        <div className="flex flex-col gap-4">
          <BrandWordmark height={56} className="self-start" />
          <dl className="grid grid-cols-3 gap-2">
            {facts.map((f) => (
              <div key={f.label} className="rounded-xl border border-[var(--lp-line)] bg-white p-3">
                <dt className="text-[11px] leading-tight text-[var(--lp-muted)]">{f.label}</dt>
                <dd className="mt-1 text-xl font-extrabold">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
