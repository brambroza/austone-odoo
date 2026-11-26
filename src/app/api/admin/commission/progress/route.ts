import { NextResponse, type NextRequest } from 'next/server';
import { can } from '@/lib/auth/permissions';
import type { Role } from '@/lib/auth/roles';
import { getCurrentUser } from '@/lib/auth/session';
import { isPeriod } from '@/lib/commission/period';
import { progressPercent, progressToken } from '@/lib/commission/progress';
import { getProgress } from '@/lib/commission/repo';

export const dynamic = 'force-dynamic';

/**
 * Progress of the sync / calculation the caller started (polled by `PendingSubmit`):
 * `?source=&period=&token=` → `{ progress: { step, total, label, percent } | null }`.
 * Only progress stored with the same token is returned, so a user sees their own click's progress.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!can(user.role as Role, 'commission.run')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const sp = request.nextUrl.searchParams;
  const source = sp.get('source') ?? '';
  const period = sp.get('period') ?? '';
  const token = progressToken(sp.get('token'));
  if (!source || source.length > 64 || !isPeriod(period) || !token) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  const stored = await getProgress(source, period);
  const progress = stored && stored.token === token
    ? { step: stored.step, total: stored.total, label: stored.label, percent: progressPercent(stored) }
    : null;
  return NextResponse.json({ progress }, { headers: { 'Cache-Control': 'no-store' } });
}
