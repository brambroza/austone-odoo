import { ImageResponse } from 'next/og';
import { BRAND_COLORS, mascotDataUri } from '@/lib/brand/mark';

export const dynamic = 'force-static';

/** Maskable launcher icon: the mascot full-bleed on brand ink; head and chest star sit inside the 80% safe zone. */
export async function GET() {
  const src = await mascotDataUri();
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BRAND_COLORS.ink }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders to PNG */}
        <img src={src} width={512} height={512} alt="" />
      </div>
    ),
    { width: 512, height: 512 },
  );
}
