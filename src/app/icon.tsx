import { ImageResponse } from 'next/og';
import { BRAND_COLORS, mascotDataUri } from '@/lib/brand/mark';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

/** App icon: the AUSTONE mascot on brand ink. */
export default async function Icon() {
  const src = await mascotDataUri();
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: BRAND_COLORS.ink }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders to PNG */}
        <img src={src} width={512} height={512} alt="" />
      </div>
    ),
    size,
  );
}
