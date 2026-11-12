import Image from 'next/image';
import { MASCOT_PATH } from '@/lib/brand/constants';

/** Native size of `/brand/austone-logo.webp` (the logo served by the Austone Odoo website). */
const WORDMARK = { width: 553, height: 150 } as const;

/**
 * Square AUSTONE mascot badge (the mascot on brand ink), sized for avatars, app headers and auth pages.
 * Decorative: pair it with visible text or an aria-label on the surrounding link.
 */
export function BrandLogo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 overflow-hidden rounded-lg bg-[#1B1319] ${className}`} style={{ width: size, height: size }}>
      <Image src={MASCOT_PATH} alt="" width={size} height={size} priority className="size-full object-cover" />
    </span>
  );
}

/**
 * Full AUSTONE THAILAND logo (white wordmark and mascot on black), as published on the company website.
 * `height` is in px; width follows the artwork's aspect ratio.
 */
export function BrandWordmark({ height = 40, className = '', alt = 'AUSTONE Thailand' }: { height?: number; className?: string; alt?: string }) {
  const width = Math.round((height * WORDMARK.width) / WORDMARK.height);
  return <Image src="/brand/austone-logo.webp" alt={alt} width={width} height={height} priority className={`rounded-lg ${className}`} style={{ width, height }} />;
}
