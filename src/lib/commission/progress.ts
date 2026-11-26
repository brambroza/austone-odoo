/**
 * Live progress of a slow commission action (Odoo sync, calculation). The server writes the current
 * step to the run (`CommissionRun.progress`, one small JSON) as it goes; the button polls
 * `/api/admin/commission/progress` and shows a real percentage. Runs on Vercel, so progress cannot
 * live in memory: the poll may land on another instance. A token from the clicked form ties the
 * progress to that click, so an older run's progress is never shown.
 */

export type ProgressOp = 'sync' | 'calculate';

/** What is stored on the run while an action runs. */
export type RunProgress = { token: string; op: ProgressOp; step: number; total: number; label: string; at: string };

/** Steps of an Odoo sync, in order (inside `fetchCollections` first, then the rest of `syncPeriod`). */
export const SYNC_STEPS = [
  'อ่านรับชำระและรายการธนาคารจาก Odoo',
  'ตรวจวันเงินเข้า / เช็คขึ้นเงิน',
  'ติดตามใบแจ้งหนี้ที่ถูกตัดชำระ',
  'อ่านเอกสารอ้างอิงในใบเสร็จ',
  'อ่านใบแจ้งหนี้ สินค้า และลูกค้า',
  'ตรวจบิลที่จ่ายครบ',
  'ตรวจรอบก่อนหน้า (ปรับปรุงย้อนหลัง)',
  'ตรวจลูกหนี้ค้างและลูกค้าใหม่',
  'อ่านเอกสารขาย (incentive)',
  'บันทึกข้อมูล',
] as const;

/** Steps of a calculation, in order. */
export const CALCULATE_STEPS = ['อ่านข้อมูลรอบและกติกา', 'อ่านใบลดหนี้ (CN) จาก Odoo', 'คำนวณค่าคอมทุกคน', 'บันทึกผล'] as const;

/** Reports reaching a step by its label; never throws, so progress can never break the work. */
export type ProgressReporter = (label: string) => Promise<void>;

export const noProgress: ProgressReporter = async () => {};

/** Token sent by the form: letters, digits and dashes only, 8–64 long; anything else means no progress. */
export function progressToken(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(value) ? value : null;
}

/**
 * A reporter for one action: each call stores the step whose label it names (labels not in `steps`
 * are ignored) via `save`. Write errors are swallowed. `token` null gives a reporter that does nothing.
 */
export function progressReporter(token: string | null, op: ProgressOp, steps: readonly string[], save: (progress: RunProgress) => Promise<void>, now: () => Date = () => new Date()): ProgressReporter {
  if (!token) return noProgress;
  return async (label) => {
    const index = steps.indexOf(label);
    if (index < 0) return;
    try {
      await save({ token, op, step: index + 1, total: steps.length, label, at: now().toISOString() });
    } catch {
      // Progress is best effort.
    }
  };
}

/** Percent shown for a stored step: steps started, not finished, so the bar never sits at 100% while work goes on. */
export function progressPercent(progress: Pick<RunProgress, 'step' | 'total'>): number {
  if (progress.total <= 0) return 0;
  return Math.max(0, Math.min(99, Math.round(((progress.step - 1) / progress.total) * 100)));
}
