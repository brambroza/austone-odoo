import { describe, expect, it, vi } from 'vitest';
import { CALCULATE_STEPS, progressPercent, progressReporter, progressToken, SYNC_STEPS } from '../progress';

describe('progressToken', () => {
  it('accepts uuids and rejects anything else', () => {
    expect(progressToken('3f1c2a9e-0b7d-4e2a-9c1f-8a6b5d4e3c2b')).toBe('3f1c2a9e-0b7d-4e2a-9c1f-8a6b5d4e3c2b');
    for (const bad of ['', 'short', 'a'.repeat(65), 'abc def ghi', "x'; drop--", null, 42]) expect(progressToken(bad)).toBeNull();
  });
});

describe('progressReporter', () => {
  const at = () => new Date('2026-11-26T03:00:00Z');

  it('stores the step named by its label with the token', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const report = progressReporter('token-123456', 'sync', SYNC_STEPS, save, at);
    await report(SYNC_STEPS[2]);
    expect(save).toHaveBeenCalledWith({ token: 'token-123456', op: 'sync', step: 3, total: SYNC_STEPS.length, label: SYNC_STEPS[2], at: '2026-11-26T03:00:00.000Z' });
  });

  it('ignores unknown labels, does nothing without a token, and never throws', async () => {
    const save = vi.fn().mockRejectedValue(new Error('db down'));
    await progressReporter('token-123456', 'calculate', CALCULATE_STEPS, save, at)('ไม่มีขั้นนี้');
    expect(save).not.toHaveBeenCalled();
    await expect(progressReporter('token-123456', 'calculate', CALCULATE_STEPS, save, at)(CALCULATE_STEPS[0])).resolves.toBeUndefined();
    const quiet = vi.fn();
    await progressReporter(null, 'sync', SYNC_STEPS, quiet)(SYNC_STEPS[0]);
    expect(quiet).not.toHaveBeenCalled();
  });
});

describe('progressPercent', () => {
  it('counts steps started, capped below 100 while running', () => {
    expect(progressPercent({ step: 1, total: 4 })).toBe(0);
    expect(progressPercent({ step: 3, total: 4 })).toBe(50);
    expect(progressPercent({ step: 4, total: 4 })).toBe(75);
    expect(progressPercent({ step: 9, total: 4 })).toBe(99);
    expect(progressPercent({ step: 1, total: 0 })).toBe(0);
  });
});
