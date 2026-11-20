import { describe, expect, it } from 'vitest';
import {
  addDaysIso, addMonthsIso, clampIso, daysInMonth, formatThaiDate, formatThaiDateLong, isWithinBounds,
  monthGrid, parseIsoDate, shiftMonth, toIsoDate, todayIso,
} from '@/lib/date-picker';

describe('parseIsoDate / toIsoDate', () => {
  it('round-trips a valid date', () => {
    expect(parseIsoDate('2026-11-20')).toEqual({ year: 2026, month: 10, day: 20 });
    expect(toIsoDate({ year: 2026, month: 10, day: 20 })).toBe('2026-11-20');
  });

  it('rejects blanks, junk and impossible days', () => {
    for (const bad of [null, undefined, '', '2026-1-5', '20/11/2026', '2026-13-01', '2026-00-10', '2026-02-29', '2026-04-31']) {
      expect(parseIsoDate(bad)).toBeNull();
    }
  });

  it('accepts leap day only in leap years', () => {
    expect(parseIsoDate('2028-02-29')).not.toBeNull();
    expect(daysInMonth(2028, 1)).toBe(29);
    expect(daysInMonth(2026, 1)).toBe(28);
  });
});

describe('date shifting', () => {
  it('adds days across month and year ends', () => {
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('caps the day when adding months', () => {
    expect(addMonthsIso('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsIso('2026-01-15', -2)).toBe('2025-11-15');
    expect(addMonthsIso('2026-12-10', 1)).toBe('2027-01-10');
  });

  it('leaves invalid input untouched', () => {
    expect(addDaysIso('nope', 3)).toBe('nope');
    expect(addMonthsIso('nope', 3)).toBe('nope');
  });

  it('shifts month views across years', () => {
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 5, -18)).toEqual({ year: 2024, month: 11 });
  });
});

describe('monthGrid', () => {
  it('always has 42 cells starting on a Sunday', () => {
    const grid = monthGrid(2026, 10); // Nov 2026 starts on a Sunday
    expect(grid).toHaveLength(42);
    expect(grid[0].iso).toBe('2026-11-01');
    expect(grid.filter((d) => d.inMonth)).toHaveLength(30);
  });

  it('pads with the previous month', () => {
    const grid = monthGrid(2026, 0); // Jan 2026 starts on a Thursday
    expect(grid[0].iso).toBe('2025-12-28');
    expect(grid[0].inMonth).toBe(false);
    expect(grid[4].iso).toBe('2026-01-01');
    expect(grid[4].inMonth).toBe(true);
  });
});

describe('bounds', () => {
  it('treats bounds as inclusive and blank as open', () => {
    expect(isWithinBounds('2026-11-20', '2026-11-20', '2026-11-20')).toBe(true);
    expect(isWithinBounds('2026-11-19', '2026-11-20')).toBe(false);
    expect(isWithinBounds('2026-11-21', undefined, '2026-11-20')).toBe(false);
    expect(isWithinBounds('2026-11-21', '', null)).toBe(true);
  });

  it('clamps into bounds', () => {
    expect(clampIso('2026-01-01', '2026-02-01', '2026-03-01')).toBe('2026-02-01');
    expect(clampIso('2026-05-01', '2026-02-01', '2026-03-01')).toBe('2026-03-01');
    expect(clampIso('2026-02-15', '2026-02-01', '2026-03-01')).toBe('2026-02-15');
  });
});

describe('Thai labels', () => {
  it('formats with Buddhist-era year', () => {
    expect(formatThaiDate('2026-11-20')).toBe('20 พ.ย. 2569');
    expect(formatThaiDateLong('2026-11-20')).toBe('วันศุกร์ที่ 20 พฤศจิกายน 2569');
  });

  it('returns blank for invalid input', () => {
    expect(formatThaiDate('')).toBe('');
    expect(formatThaiDateLong(undefined)).toBe('');
  });
});

describe('todayIso', () => {
  it('uses the Bangkok day, not UTC', () => {
    expect(todayIso(new Date('2026-11-19T18:30:00Z'))).toBe('2026-11-20');
    expect(todayIso(new Date('2026-11-19T16:30:00Z'))).toBe('2026-11-19');
  });
});
