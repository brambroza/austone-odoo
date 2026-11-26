import { describe, expect, it } from 'vitest';
import { byRepAndGroup, commissionByInvoice, groupByInvoice, totalsByRep, insertLinkedDocs, withLinkedDocs, type InvoiceRow } from '../report';
import type { LinkedDoc } from '../ledger';
import { parseTargetLines } from '../targets';
import type { CommissionPricelist, LedgerLine } from '../types';

const line = (over: Partial<LedgerLine>): LedgerLine => ({
  kind: 'COLLECTION', originPeriod: '2026-10', lineKey: 'P1:R1:L1', receiptName: 'PBNK/1', cashDate: '2026-10-08', partnerName: 'ร้าน', invoiceId: 1, invoiceName: 'INV/1',
  invoiceDate: '2026-09-01', dueDate: '2026-10-01', overdueDays: 7, paymentKind: 'CREDIT', odooUserId: 8, repName: 'สมชาย', ownerFrom: 'invoice', pricelistId: 1, pricelistName: 'ปลีก', pricelistFrom: 'order',
  productId: 501, productName: 'A', brand: 'AUSTONE', family: 'PCR', qty: 1, base: 100, gross: 107, issues: [], ...over,
});
const PL: CommissionPricelist[] = [
  { id: 'a', sourceId: 's', odooPricelistId: 1, name: 'ปลีก', priceGroup: 'RETAIL', isSpecial: false, specialPercent: 50 },
  { id: 'b', sourceId: 's', odooPricelistId: 2, name: 'โปร', priceGroup: 'RETAIL', isSpecial: true, specialPercent: 50 },
];

describe('groupByInvoice', () => {
  it('sums the lines of one receipt × invoice and keeps RETRO apart', () => {
    const rows = groupByInvoice([
      line({}), line({ lineKey: 'P1:R1:L2', family: 'TBR', pricelistName: 'โปร', issues: ['x'] }),
      line({ lineKey: 'P1:R2:L3', invoiceName: 'INV/2', cashDate: '2026-10-01' }), line({ kind: 'RETRO', base: -100 }),
    ]);
    expect(rows).toHaveLength(3);
    const first = rows.find((r) => r.key === 'COLLECTION:P1:R1')!;
    expect(first).toMatchObject({ base: 200, gross: 214, lines: 2, pricelists: ['ปลีก', 'โปร'], families: ['AUSTONE-PCR', 'AUSTONE-TBR'], issues: ['x'] });
    expect(rows[0].invoiceName).toBe('INV/2');
  });
});

describe('commissionByInvoice', () => {
  it('sums every receipt and line of one invoice, with counted base and commission', () => {
    const results = new Map([
      ['P1:R1:L1', { rateId: 'r', stepPercent: 100, commission: 10 }],
      ['P2:R5:L2', { rateId: 'r', stepPercent: 110, commission: 5.5 }],
      ['P1:R2:L3', { rateId: null, stepPercent: 0, commission: 0 }],
    ]);
    const rows = commissionByInvoice([
      line({}),
      line({ lineKey: 'P2:R5:L2', receiptName: 'PBNK/2', cashDate: '2026-10-12', overdueDays: 11, family: 'TBR', base: 50, gross: 53.5 }),
      line({ lineKey: 'P1:R2:L3', invoiceId: 2, invoiceName: 'INV/2', base: 300 }),
      line({ lineKey: 'P1:R9', invoiceId: null, invoiceName: null, productId: null, base: 20 }),
    ], results);
    // By cash date: INV/2 and the deposit on 8 Oct (deposit last), INV/1 on its last cash day 12 Oct.
    expect(rows.map((r) => r.invoiceName)).toEqual(['INV/2', null, 'INV/1']);
    expect(rows[2]).toMatchObject({ receipts: ['PBNK/1', 'PBNK/2'], cashDate: '2026-10-12', overdueDays: 11, families: ['AUSTONE-PCR', 'AUSTONE-TBR'], qty: 2, base: 150, gross: 160.5, counted: 150, commission: 15.5, lines: 2 });
    expect(rows[0]).toMatchObject({ base: 300, counted: 0, commission: 0 });
    expect(rows[1]).toMatchObject({ base: 20, counted: 0, qty: 0 });
  });
});

describe('byRepAndGroup', () => {
  it('totals per rep × price group × family and tracks special-price sales', () => {
    const rows = byRepAndGroup([line({}), line({ pricelistId: 2, base: 50 }), line({ pricelistId: 9 }), line({ odooUserId: null, repName: null }), line({ productId: null })], PL);
    expect(rows.find((r) => r.repName === 'สมชาย' && r.priceGroup === 'RETAIL')).toMatchObject({ base: 150, special: 50, qty: 2 });
    expect(rows.find((r) => r.priceGroup === 'UNMAPPED')).toBeTruthy();
    expect(rows.find((r) => r.repName === 'ไม่มีพนักงานขาย')).toBeTruthy();
    expect(totalsByRep(rows).get('สมชาย')?.base).toBe(250);
  });
});

describe('parseTargetLines', () => {
  const reps = [{ odooUserId: 8, name: 'สมชาย ใจดี' }, { odooUserId: 9, name: 'สมหญิง' }];
  it('reads Excel tab, comma and semicolon lines by name or Odoo id, skipping a header', () => {
    const r = parseTargetLines('ชื่อ\tเป้า\nสมชาย ใจดี\t500,000\n9, 350000\nสมหญิง;1.5', reps);
    expect(r.errors).toEqual([]);
    expect([...r.values]).toEqual([[8, 500_000], [9, 1.5]]);
  });
  it('reports unknown reps, bad and negative amounts', () => {
    const r = parseTargetLines('x\t1\nสมชาย ใจดี\tabc\nสมหญิง\t-5\nonlyname', reps);
    expect(r.errors).toHaveLength(4);
    expect(r.values.size).toBe(0);
  });
});

describe('withLinkedDocs', () => {
  const row = (receiptName: string, invoiceName: string): InvoiceRow => ({
    key: `${receiptName}:${invoiceName}`, kind: 'COLLECTION', cashDate: '2026-08-10', receiptName, partnerName: 'ร้าน', invoiceName, invoiceDate: null, dueDate: null,
    overdueDays: 0, repName: null, odooUserId: null, pricelists: [], families: [], base: 1, gross: 1, lines: 1, issues: [],
  });
  const doc = (receiptName: string, name: string, moveId: number): LinkedDoc => ({
    receiptKey: receiptName, receiptName, cashDate: '2026-08-10', partnerName: 'ร้าน', moveId, name, moveType: 'out_invoice', invoiceDate: null, amountTotal: 10, amountUntaxed: 9, settledBy: [],
  });

  it('puts each receipt\'s reference documents after its last row, only for receipts shown', () => {
    const rows = [row('PBNK1', 'IV1'), row('PBNK1', 'IV2'), row('PBNK2', 'IV3')];
    const out = withLinkedDocs(rows, [doc('PBNK1', 'IV9', 9), doc('PBNK3', 'IV8', 8)]);
    expect(out.map((r) => ('linked' in r ? `link:${r.doc.name}` : r.invoiceName))).toEqual(['IV1', 'IV2', 'link:IV9', 'IV3']);
  });

  it('tells which other receipt counted the invoice', () => {
    const all = [row('PBNK1', 'IV1'), row('PBNK2', 'IV9')];
    const out = withLinkedDocs([all[0]], [doc('PBNK1', 'IV9', 9)], all);
    expect(out[1]).toMatchObject({ linked: true, countedIn: ['PBNK2'] });
  });

  it('places them after the last invoice row naming the receipt, once, when a row has several receipts', () => {
    const rows = [{ id: 'A', receipts: ['PBNK1'] }, { id: 'B', receipts: ['PBNK2', 'PBNK1'] }, { id: 'C', receipts: ['PBNK2'] }];
    const out = insertLinkedDocs(rows, (r) => r.receipts, [doc('PBNK1', 'IV9', 9), doc('PBNK2', 'CN1', 10)], () => []);
    expect(out.map((r) => ('linked' in r ? `link:${r.doc.name}` : r.id))).toEqual(['A', 'B', 'link:IV9', 'C', 'link:CN1']);
  });
});
