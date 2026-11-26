'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Step progress reported by `/api/admin/commission/progress`. */
type Progress = { step: number; total: number; label: string; percent: number };

/**
 * Submit button for slow server actions (Odoo sync, commission calculation). While its form runs it
 * disables itself, swaps the icon for a spinner, shows `pendingLabel` with the elapsed seconds, and pins
 * a progress bar plus a status card to the page so the user knows work is still going.
 * With `progress` (the run's company and period) it also sends a `progressToken` with the form and
 * polls the server for the step reached, showing a real percentage; otherwise the bar is indeterminate.
 * Put it inside a server-action form.
 */
export function PendingSubmit({ label, pendingLabel, hint, icon, variant = 'outline', size = 'sm', disabled, title, progress: target }: {
  label: ReactNode;
  pendingLabel: string;
  hint?: string;
  icon?: ReactNode;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'xs' | 'lg';
  disabled?: boolean;
  title?: string;
  progress?: { source: string; period: string };
}) {
  const { pending } = useFormStatus();
  const seconds = useElapsedSeconds(pending);
  // A fresh token per click, written into the form before it submits, so this click's progress is
  // never mixed up with an earlier run's.
  const tokenInput = useRef<HTMLInputElement>(null);
  const [token, setToken] = useState('');
  const progress = usePolledProgress(pending && target && token ? { ...target, token } : null);
  const onClick = () => {
    if (!target || !tokenInput.current) return;
    const next = newToken();
    tokenInput.current.value = next;
    setToken(next);
  };
  return (
    <>
      {target && <input ref={tokenInput} type="hidden" name="progressToken" defaultValue="" />}
      <Button type="submit" variant={variant} size={size} disabled={disabled || pending} aria-busy={pending} title={title} onClick={onClick}>
        {pending ? <Loader2 className="animate-spin" /> : icon}
        {pending ? `${pendingLabel} ${seconds}s` : label}
      </Button>
      {pending && <PendingOverlay message={pendingLabel} hint={hint} seconds={seconds} progress={progress} />}
    </>
  );
}

/** Counts whole seconds since `active` became true; resets to 0 when it turns false. */
function useElapsedSeconds(active: boolean): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => { window.clearInterval(timer); setSeconds(0); };
  }, [active]);
  return seconds;
}

function newToken(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Polls the progress of the run started with `query.token` every 1.5 s while `query` is set. */
function usePolledProgress(query: { source: string; period: string; token: string } | null): Progress | null {
  const [progress, setProgress] = useState<Progress | null>(null);
  const key = query ? new URLSearchParams(query).toString() : null;
  useEffect(() => {
    if (!key) return;
    let stopped = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/admin/commission/progress?${key}`, { cache: 'no-store' });
        const body = response.ok ? await response.json() as { progress: Progress | null } : null;
        if (!stopped && body?.progress) setProgress(body.progress);
      } catch {
        // Keep the last value; the bar falls back to indeterminate until something arrives.
      }
    };
    void poll();
    const timer = window.setInterval(poll, 1500);
    return () => { stopped = true; window.clearInterval(timer); setProgress(null); };
  }, [key]);
  return progress;
}

/** Determinate bar at `percent`, or the moving indeterminate bar when it is not known yet. */
function Bar({ percent, className }: { percent: number | null; className: string }) {
  return percent === null
    ? <div className={`pending-bar h-full w-1/3 rounded-full bg-primary ${className}`} />
    : <div className={`h-full rounded-full bg-primary transition-[width] duration-500 ease-out ${className}`} style={{ width: `${Math.max(3, percent)}%` }} />;
}

/** Top-of-page bar and a bottom-right status card, rendered into document.body. */
function PendingOverlay({ message, hint, seconds, progress }: { message: string; hint?: string; seconds: number; progress: Progress | null }) {
  const percent = progress?.percent ?? null;
  return createPortal(
    <>
      <div className="fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden bg-primary/15" role="progressbar" aria-label={message}
        {...(percent !== null ? { 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': percent } : {})}>
        <Bar percent={percent} className="" />
      </div>
      <div className="fixed right-4 bottom-4 z-[100] w-72 rounded-xl border border-border bg-card p-3 text-sm shadow-lg" role="status" aria-live="polite">
        <div className="flex items-center gap-2 font-medium">
          <Loader2 className="size-4 animate-spin text-primary-ink" /> {message}
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">{seconds} วินาที</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <Bar percent={percent} className="" />
        </div>
        {progress && (
          <p className="mt-1.5 flex items-baseline gap-2 text-xs">
            <span className="min-w-0 flex-1 truncate">ขั้น {progress.step}/{progress.total} · {progress.label}</span>
            <span className="font-semibold tabular-nums">{progress.percent}%</span>
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">{hint ?? 'กรุณาอย่าปิดหรือรีเฟรชหน้านี้จนกว่าจะเสร็จ'}</p>
      </div>
    </>,
    document.body,
  );
}
