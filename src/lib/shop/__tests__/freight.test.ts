import { describe, expect, it } from 'vitest';
import { cleanFreightRates, formatFreightRates, freightCount, freightDiscountOf, freightRatesFor, freightUnitLabel, parseFreightRate } from '../freight';
import type { CatalogProduct } from '../types';

const tbr = { dealerType: 'TRUCK', units: [{ id: 1, name: 'เส้น', factor: 1 }] } as Pick<CatalogProduct, 'dealerType' | 'units'>;
const wheel = { dealerType: 'WHEEL', units: [{ id: 1, name: 'วง', factor: 1 }] } as Pick<CatalogProduct, 'dealerType' | 'units'>;
const packedPcr = { dealerType: 'CAR', units: [{ id: 1, name: 'เส้น', factor: 1 }, { id: 31, name: 'มัด 4 เส้น', factor: 4 }] } as Pick<CatalogProduct, 'dealerType' | 'units'>;
const companyTruck = { TRUCK: 150, CAR: 80, WHEEL: 100 };

describe('freightCount', () => {
  it('counts base units for tyres and wheels', () => {
    expect(freightCount(tbr, 6)).toBe(6);
    expect(freightCount(wheel, 4)).toBe(4);
  });
  it('counts base units even when the product has packs, and nothing for an empty line', () => {
    expect(freightCount(packedPcr, 8, 31)).toBe(8);
    expect(freightCount(tbr, 0)).toBe(0);
  });
});

describe('freightDiscountOf', () => {
  it('multiplies the count by the family rate', () => {
    expect(freightDiscountOf(companyTruck, tbr, 4, null, 20_000)).toBe(600);
    expect(freightDiscountOf(companyTruck, wheel, 4, null, 8_000)).toBe(400);
  });
  it('is 0 without a rate and never above the line amount', () => {
    expect(freightDiscountOf({ CAR: 80 }, tbr, 4, null, 20_000)).toBe(0);
    expect(freightDiscountOf(null, tbr, 4, null, 20_000)).toBe(0);
    expect(freightDiscountOf(companyTruck, tbr, 4, null, 500)).toBe(500);
    expect(freightDiscountOf(companyTruck, tbr, 4, null, -5)).toBe(0);
  });
});

describe('rates storage and form', () => {
  it('finds the rates of a delivery method by id', () => {
    expect(freightRatesFor({ '7': { CAR: 80 } }, 7)).toEqual({ CAR: 80 });
    expect(freightRatesFor({ '7': {} }, 7)).toBeNull();
    expect(freightRatesFor({ '7': { CAR: 80 } }, null)).toBeNull();
  });
  it('parses form values', () => {
    expect(parseFreightRate('')).toBeNull();
    expect(parseFreightRate('0')).toBeNull();
    expect(parseFreightRate('1,500.555')).toBe(1500.56);
    expect(parseFreightRate('-1')).toEqual({ error: expect.any(String) });
    expect(parseFreightRate('abc')).toEqual({ error: expect.any(String) });
    expect(parseFreightRate('100001')).toEqual({ error: expect.any(String) });
  });
  it('drops invalid stored values and unknown families', () => {
    expect(cleanFreightRates({ CAR: 80, TRUCK: -1, WHEEL: 'x', BOAT: 5 } as Record<string, unknown>)).toEqual({ CAR: 80 });
  });
  it('labels units and summarises rates', () => {
    expect(freightUnitLabel('TRUCK')).toBe('เส้น');
    expect(freightUnitLabel('WHEEL')).toBe('วง');
    expect(formatFreightRates({ CAR: 80, TRUCK: 150 })).toBe('ยางรถบรรทุก ฿150 /เส้น · ยางรถยนต์ ฿80 /เส้น');
    expect(formatFreightRates(null)).toBe('');
  });
});
