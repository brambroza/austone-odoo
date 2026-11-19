import { describe, expect, it } from 'vitest';
import { PROVINCES, shortProvinceName } from '@/lib/provinces';

describe('shortProvinceName', () => {
  it('strips the จ. prefix and (TH) suffix used by the AUSTONE Odoo', () => {
    expect(shortProvinceName('จ.นครสวรรค์ (TH)')).toBe('นครสวรรค์');
    expect(shortProvinceName('จ. นครสวรรค์')).toBe('นครสวรรค์');
  });

  it('strips the จังหวัด prefix used by other Odoo databases', () => {
    expect(shortProvinceName('จังหวัดเชียงใหม่ (TH)')).toBe('เชียงใหม่');
    expect(shortProvinceName('จังหวัดสมุทรสาคร')).toBe('สมุทรสาคร');
  });

  it('keeps Bangkok and plain names as they are', () => {
    expect(shortProvinceName('กรุงเทพมหานคร (TH)')).toBe('กรุงเทพมหานคร');
    expect(shortProvinceName('เลย')).toBe('เลย');
  });

  it('gives a name in the 77-province list for every prefix style', () => {
    for (const p of PROVINCES) {
      expect(PROVINCES).toContain(shortProvinceName(`จ.${p} (TH)`));
      expect(PROVINCES).toContain(shortProvinceName(`จังหวัด${p}`));
    }
  });
});
