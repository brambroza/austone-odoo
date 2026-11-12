import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { SITE } from '@/lib/seo';
import { BRAND_COLORS } from '@/lib/brand/mark';

export const alt = `${SITE.name} — ยาง AUSTONE สำหรับดีลเลอร์`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Social share card rendered at build time: the official AUSTONE logo on ink with a yellow headline. */
export default async function OpenGraphImage() {
  // Satori cannot decode WebP, so the share card embeds a PNG copy of the logo.
  const logo = await readFile(path.join(process.cwd(), 'public/brand/austone-logo.png'));
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`;
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: BRAND_COLORS.ink, color: '#ffffff', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <img src={logoSrc} width={369} height={100} alt="" />
          <div style={{ display: 'flex', fontSize: 36, fontWeight: 500, color: '#B5ADB2' }}>Dealer</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 80, fontWeight: 900, lineHeight: 1.1 }}>ยางคุณภาพ</div>
          <div style={{ fontSize: 80, fontWeight: 900, lineHeight: 1.1, color: BRAND_COLORS.yellow }}>ที่สัมผัสได้</div>
          <div style={{ fontSize: 30, color: '#B5ADB2', marginTop: 12 }}>เคลมทันที ไม่มีเงื่อนไข* · รับประกันยางรถยนต์ 120 วัน · ยางรถบรรทุก 100 วัน</div>
        </div>
        <div style={{ display: 'flex', gap: 28, fontSize: 26, color: BRAND_COLORS.sand }}>
          <span>ยางรถยนต์</span><span>ยางรถบรรทุก</span><span>กระทะล้อ</span><span>โทร {SITE.phone}</span>
        </div>
      </div>
    ),
    size,
  );
}
