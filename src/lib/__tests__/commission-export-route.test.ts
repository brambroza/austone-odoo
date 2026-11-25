import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { LedgerLine } from '@/lib/commission/types';

const repo = vi.hoisted(() => ({ getSource: vi.fn(), getRun: vi.fn(), listLedger: vi.fn(), listPricelists: vi.fn(), listRates: vi.fn(), listSteps: vi.fn() }));
const exported = vi.hoisted(() => vi.fn());
vi.mock('@/lib/commission/repo', () => repo);
vi.mock('@/lib/commission/service', () => ({ clientFor: vi.fn(), periodCalendar: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ getCurrentUser: async () => ({ id: 'u1', role: 'ADMIN' }) }));
vi.mock('@/lib/auth/permissions', () => ({ can: () => true }));
vi.mock('@/lib/auth/audit', () => ({ audit: vi.fn() }));
vi.mock('@/lib/admin/export', () => ({ exportFile: exported }));
const { GET } = await import('@/app/api/admin/commission/export/route');

const line = (over: Partial<LedgerLine>): LedgerLine => ({
  kind: 'COLLECTION', originPeriod: '2026-10', lineKey: 'k', receiptName: 'P', cashDate: '2026-10-08', partnerName: 'ร้าน', invoiceId: 1, invoiceName: 'INV/1', invoiceDate: '2026-09-01',
  dueDate: '2026-10-01', overdueDays: 7, paymentKind: 'CREDIT', odooUserId: 8, repName: 'A', ownerFrom: 'tag', pricelistId: 1, pricelistName: 'PL', pricelistFrom: 'order',
  productId: 501, productName: 'ยาง', brand: 'AT', family: 'TBR', qty: 1, base: 100, gross: 107, issues: [], ...over,
});
const LEDGER = [
  line({ lineKey: 'a', invoiceId: 1, invoiceName: 'INV/1', cashDate: '2026-10-12' }),
  line({ lineKey: 'b', invoiceId: 2, invoiceName: 'INV/2', cashDate: '2026-10-02' }),
  line({ lineKey: 'c', invoiceId: 3, invoiceName: 'INV/3', productId: null }),
  line({ lineKey: 'd', invoiceId: 4, invoiceName: 'INV/4', odooUserId: 9, repName: 'B' }),
];
const call = (query: string) => GET(new NextRequest(`http://x/api/admin/commission/export?source=s1&period=2026-10&${query}`));

beforeEach(() => {
  vi.resetAllMocks();
  repo.getSource.mockResolvedValue({ id: 's1', name: 'AUSTONE', summaryLines: [] });
  repo.listLedger.mockResolvedValue(LEDGER);
  repo.getRun.mockResolvedValue({ results: { lines: ['a', 'b', 'd'].map((lineKey) => ({ lineKey, odooUserId: null, rateId: 'r', rateLabel: '0.6%', specialPercent: 100, stepPercent: 100, commission: 0.6 })) }, snapshot: { rates: [] } });
  for (const fn of [repo.listPricelists, repo.listRates, repo.listSteps]) fn.mockResolvedValue([]);
  exported.mockResolvedValue({ body: Buffer.from(''), contentType: 'text/csv', filename: 'f.csv' });
});

describe('commission export for one rep', () => {
  it('exports only that rep\'s invoices, oldest cash first', async () => {
    expect((await call('kind=run-invoices&rep=8')).status).toBe(200);
    const [rows, , name] = exported.mock.calls[0];
    expect(rows.map((r: { invoiceName: string }) => r.invoiceName)).toEqual(['INV/2', 'INV/3', 'INV/1']);
    expect(name).toContain('-rep8');
  });

  it('keeps the drawer filter and adds the formula to the lines', async () => {
    await call('kind=run-lines&rep=8&show=excluded');
    const [rows, columns] = exported.mock.calls[0];
    expect(rows.map((r: LedgerLine) => r.lineKey)).toEqual(['c']);
    expect(columns.map((c: { header: string }) => c.header)).toContain('สูตรคิดค่าคอม');
    exported.mockClear();
    await call('kind=run-lines&rep=8&show=counted');
    expect(exported.mock.calls[0][0].map((r: { formula?: string }) => typeof r.formula)).toEqual(['string', 'string']);
  });

  it('keeps the collections export without the run columns', async () => {
    await call('kind=collections');
    const headers = exported.mock.calls[0][1].map((c: { header: string }) => c.header);
    expect(headers).not.toContain('สูตรคิดค่าคอม');
    expect(headers).not.toContain('ค่าคอม');
    expect(headers.slice(-3)).toEqual(['อัตรา', '% ราคาพิเศษ', 'ตรวจสอบ']);
  });

  it('exports every rep without `rep`, and refuses a bad rep key', async () => {
    await call('kind=run-invoices');
    expect(exported.mock.calls[0][0]).toHaveLength(4);
    expect((await call('kind=run-lines&rep=abc')).status).toBe(400);
  });
});
