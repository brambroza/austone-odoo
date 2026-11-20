/**
 * Calendar math for the shared `DatePicker`. Dates are plain `YYYY-MM-DD` strings (what `<input type="date">`
 * posted), handled as year/month/day numbers so no time zone can move a day. Labels are Thai with the
 * Buddhist-era year (พ.ศ.), the way staff read dates everywhere else in the backoffice.
 */

/** A calendar day as numbers; `month` is 0–11 like `Date`. */
export type DayParts = { year: number; month: number; day: number };

/** One cell of a month grid. */
export type GridDay = DayParts & { iso: string; inMonth: boolean };

/** Thai short month names, January first. */
export const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'] as const;

/** Thai full month names, January first. */
export const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'] as const;

/** Thai weekday initials, Sunday first. */
export const THAI_WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] as const;

/** Years added to the Gregorian year to get the Buddhist-era year. */
export const BE_OFFSET = 543;

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** Number of days in a month (`month` 0–11). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** Parses `YYYY-MM-DD`; returns null for blanks, malformed text or impossible days like 2026-02-30. */
export function parseIsoDate(value: string | null | undefined): DayParts | null {
  const match = ISO_RE.exec(value?.trim() ?? '');
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (month < 0 || month > 11 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/** Formats day parts back to `YYYY-MM-DD`. */
export function toIsoDate({ year, month, day }: DayParts): string {
  return `${pad(year, 4)}-${pad(month + 1)}-${pad(day)}`;
}

/** Today's date in Bangkok as `YYYY-MM-DD`, so the "today" mark matches the shop's business day. */
export function todayIso(now: Date = new Date()): string {
  const bangkok = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return toIsoDate({ year: bangkok.getUTCFullYear(), month: bangkok.getUTCMonth(), day: bangkok.getUTCDate() });
}

/** Shifts a date by whole days. */
export function addDaysIso(iso: string, days: number): string {
  const parts = parseIsoDate(iso);
  if (!parts) return iso;
  const shifted = new Date(Date.UTC(parts.year, parts.month, parts.day + days));
  return toIsoDate({ year: shifted.getUTCFullYear(), month: shifted.getUTCMonth(), day: shifted.getUTCDate() });
}

/** Shifts a date by whole months, keeping the day but capping it at the target month's last day (31 Jan + 1 = 28/29 Feb). */
export function addMonthsIso(iso: string, months: number): string {
  const parts = parseIsoDate(iso);
  if (!parts) return iso;
  const index = parts.year * 12 + parts.month + months;
  const year = Math.floor(index / 12);
  const month = index - year * 12;
  return toIsoDate({ year, month, day: Math.min(parts.day, daysInMonth(year, month)) });
}

/** Moves a month view (`month` 0–11) by whole months. */
export function shiftMonth(year: number, month: number, by: number): { year: number; month: number } {
  const index = year * 12 + month + by;
  const y = Math.floor(index / 12);
  return { year: y, month: index - y * 12 };
}

/**
 * The 6×7 grid shown for a month, Sunday first, padded with the neighbouring months' days so the grid
 * height never jumps while paging.
 */
export function monthGrid(year: number, month: number): GridDay[] {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const cells: GridDay[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(Date.UTC(year, month, 1 - firstWeekday + i));
    const parts = { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate() };
    cells.push({ ...parts, iso: toIsoDate(parts), inMonth: parts.month === month && parts.year === year });
  }
  return cells;
}

/** True when `iso` falls inside the optional inclusive `min`/`max` bounds (blank bounds are open). */
export function isWithinBounds(iso: string, min?: string | null, max?: string | null): boolean {
  if (min && parseIsoDate(min) && iso < min) return false;
  if (max && parseIsoDate(max) && iso > max) return false;
  return true;
}

/** Pulls a date into the optional bounds. */
export function clampIso(iso: string, min?: string | null, max?: string | null): string {
  if (min && parseIsoDate(min) && iso < min) return min;
  if (max && parseIsoDate(max) && iso > max) return max;
  return iso;
}

/** Short Thai label, e.g. "20 พ.ย. 2569"; blank for an invalid date. */
export function formatThaiDate(iso: string | null | undefined): string {
  const parts = parseIsoDate(iso);
  if (!parts) return '';
  return `${parts.day} ${THAI_MONTHS_SHORT[parts.month]} ${parts.year + BE_OFFSET}`;
}

/** Full Thai label for screen readers, e.g. "วันศุกร์ที่ 20 พฤศจิกายน 2569". */
export function formatThaiDateLong(iso: string | null | undefined): string {
  const parts = parseIsoDate(iso);
  if (!parts) return '';
  const weekday = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'][new Date(Date.UTC(parts.year, parts.month, parts.day)).getUTCDay()];
  return `วัน${weekday}ที่ ${parts.day} ${THAI_MONTHS[parts.month]} ${parts.year + BE_OFFSET}`;
}
