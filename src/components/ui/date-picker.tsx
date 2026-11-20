'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  BE_OFFSET, THAI_MONTHS, THAI_MONTHS_SHORT, THAI_WEEKDAYS,
  addDaysIso, addMonthsIso, clampIso, formatThaiDate, formatThaiDateLong, isWithinBounds, monthGrid,
  parseIsoDate, shiftMonth, todayIso,
} from '@/lib/date-picker';

type View = 'days' | 'months' | 'years';

export type DatePickerProps = {
  /** Form field name; the picked date posts as `YYYY-MM-DD`, same as `<input type="date">`. */
  name?: string;
  /** Starting date for an uncontrolled field (form posts). */
  defaultValue?: string | null;
  /** Date for a controlled field; pair with `onValueChange`. */
  value?: string | null;
  /** Called with the picked date, or '' when cleared. */
  onValueChange?: (value: string) => void;
  /** Earliest pickable date (`YYYY-MM-DD`, inclusive). */
  min?: string;
  /** Latest pickable date (`YYYY-MM-DD`, inclusive). */
  max?: string;
  required?: boolean;
  disabled?: boolean;
  /** Text shown when empty. */
  placeholder?: string;
  /** Hides the clear (×) button even when the field is optional. */
  noClear?: boolean;
  /** Smaller trigger for dense toolbars and table rows. */
  size?: 'default' | 'sm';
  /** Classes for the outer wrapper (width, margin). */
  className?: string;
  id?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
};

const YEARS_PER_PAGE = 12;

/**
 * Thai calendar date field (พ.ศ. labels) that replaces the browser's native date input across the app.
 * The visible part is a button that opens a popover calendar with month/year jump views and full
 * keyboard support. A visually hidden input carries the `YYYY-MM-DD` value under `name`, so server
 * actions read exactly what the native field posted, `required` still blocks submit, and form resets work.
 */
export function DatePicker({
  name, defaultValue, value, onValueChange, min, max, required, disabled, placeholder = 'เลือกวันที่',
  noClear, size = 'default', className, id, 'aria-label': ariaLabel, 'aria-describedby': ariaDescribedBy,
}: DatePickerProps) {
  const controlled = value !== undefined;
  const [inner, setInner] = useState(() => (parseIsoDate(defaultValue) ? defaultValue! : ''));
  const current = controlled ? (parseIsoDate(value) ? value! : '') : inner;

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('days');
  const [focused, setFocused] = useState(() => current || clampIso(todayIso(), min, max));
  const [page, setPage] = useState(() => {
    const p = parseIsoDate(focused)!;
    return { year: p.year, month: p.month };
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const captionId = useId();
  const today = todayIso();

  // React 19 resets uncontrolled form fields after a successful action; follow it back to the default.
  useEffect(() => {
    const form = hiddenRef.current?.form;
    if (!form || controlled) return;
    const onReset = () => setInner(parseIsoDate(defaultValue) ? defaultValue! : '');
    form.addEventListener('reset', onReset);
    return () => form.removeEventListener('reset', onReset);
  }, [controlled, defaultValue]);

  // Keep keyboard focus on the active day while the grid is shown.
  useEffect(() => {
    if (!open || view !== 'days') return;
    const frame = requestAnimationFrame(() => {
      gridRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${focused}"]`)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, view, focused]);

  /** Opens the popover on the picked date (or today) in the day view. */
  const handleOpenChange = (next: boolean) => {
    if (next) {
      const start = current || clampIso(today, min, max);
      const p = parseIsoDate(start)!;
      setFocused(start);
      setPage({ year: p.year, month: p.month });
      setView('days');
    }
    setOpen(next);
  };

  /** Stores a new value and tells the caller. */
  const commit = (iso: string) => {
    if (!controlled) setInner(iso);
    onValueChange?.(iso);
  };

  /** Moves the keyboard cursor, paging the month view when it leaves the visible month. */
  const moveFocus = (iso: string) => {
    const next = clampIso(iso, min, max);
    const p = parseIsoDate(next)!;
    setFocused(next);
    if (p.year !== page.year || p.month !== page.month) setPage({ year: p.year, month: p.month });
  };

  const onGridKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const p = parseIsoDate(focused)!;
    const weekday = new Date(Date.UTC(p.year, p.month, p.day)).getUTCDay();
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDaysIso(focused, -1),
      ArrowRight: () => addDaysIso(focused, 1),
      ArrowUp: () => addDaysIso(focused, -7),
      ArrowDown: () => addDaysIso(focused, 7),
      Home: () => addDaysIso(focused, -weekday),
      End: () => addDaysIso(focused, 6 - weekday),
      PageUp: () => addMonthsIso(focused, e.shiftKey ? -12 : -1),
      PageDown: () => addMonthsIso(focused, e.shiftKey ? 12 : 1),
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    moveFocus(move());
  };

  const pick = (iso: string) => {
    if (!isWithinBounds(iso, min, max)) return;
    commit(iso);
    setOpen(false);
  };

  const pagePrev = () => {
    if (view === 'days') setPage(shiftMonth(page.year, page.month, -1));
    else if (view === 'months') setPage({ ...page, year: page.year - 1 });
    else setPage({ ...page, year: page.year - YEARS_PER_PAGE });
  };
  const pageNext = () => {
    if (view === 'days') setPage(shiftMonth(page.year, page.month, 1));
    else if (view === 'months') setPage({ ...page, year: page.year + 1 });
    else setPage({ ...page, year: page.year + YEARS_PER_PAGE });
  };

  const yearStart = page.year - (page.year % YEARS_PER_PAGE);
  const caption = view === 'days'
    ? `${THAI_MONTHS[page.month]} ${page.year + BE_OFFSET}`
    : view === 'months'
      ? `${page.year + BE_OFFSET}`
      : `${yearStart + BE_OFFSET} – ${yearStart + YEARS_PER_PAGE - 1 + BE_OFFSET}`;

  /** True when any day of the given month/year is pickable. */
  const monthAllowed = (year: number, month: number) => {
    const first = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const last = addDaysIso(addMonthsIso(first, 1), -1);
    return !(max && parseIsoDate(max) && first > max) && !(min && parseIsoDate(min) && last < min);
  };
  const yearAllowed = (year: number) => !(min && year < Number(min.slice(0, 4))) && !(max && year > Number(max.slice(0, 4)));

  const showClear = !noClear && !required && !disabled && !!current;
  const label = formatThaiDate(current);
  const sm = size === 'sm';

  return (
    <span data-slot="date-picker" className={cn('relative inline-flex w-full min-w-0', className)}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          render={
            <button
              ref={triggerRef}
              type="button"
              id={id}
              disabled={disabled}
              aria-label={ariaLabel ? `${ariaLabel}${label ? ` ${formatThaiDateLong(current)}` : ''}` : undefined}
              aria-describedby={ariaDescribedBy}
              aria-haspopup="dialog"
              className={cn(
                'group/date flex w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-background text-left font-normal transition-all outline-none',
                'hover:border-foreground/25 hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
                'data-[popup-open]:border-ring data-[popup-open]:ring-3 data-[popup-open]:ring-ring/30',
                'disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 dark:bg-input/30',
                sm ? 'h-8 px-2 text-xs' : 'h-9 px-2.5 text-sm',
                showClear && (sm ? 'pr-7' : 'pr-8'),
              )}
            >
              <CalendarDays className={cn('shrink-0 text-muted-foreground transition-colors group-hover/date:text-foreground group-data-[popup-open]/date:text-primary-ink', sm ? 'size-3.5' : 'size-4')} aria-hidden />
              <span className={cn('truncate tabular-nums', !label && 'text-muted-foreground')}>{label || placeholder}</span>
            </button>
          }
        />
        <PopoverContent align="start" className="w-[18.5rem] gap-0 p-0" aria-labelledby={captionId}>
          <div className="flex items-center justify-between gap-1 border-b border-border px-2 py-2">
            <NavButton label={view === 'days' ? 'เดือนก่อน' : view === 'months' ? 'ปีก่อน' : 'ช่วงปีก่อน'} onClick={pagePrev}><ChevronLeft className="size-4" /></NavButton>
            <button
              type="button"
              id={captionId}
              aria-live="polite"
              onClick={() => setView(view === 'days' ? 'months' : view === 'months' ? 'years' : 'days')}
              className="rounded-md px-2.5 py-1 text-sm font-semibold transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              title={view === 'years' ? 'กลับไปเลือกวัน' : 'เลือกเดือน/ปี'}
            >
              {caption}
            </button>
            <NavButton label={view === 'days' ? 'เดือนถัดไป' : view === 'months' ? 'ปีถัดไป' : 'ช่วงปีถัดไป'} onClick={pageNext}><ChevronRight className="size-4" /></NavButton>
          </div>

          {view === 'days' && (
            <div className="px-2.5 pt-2 pb-1">
              <div className="grid grid-cols-7 pb-1" aria-hidden>
                {THAI_WEEKDAYS.map((w, i) => (
                  <span key={w} className={cn('grid h-7 place-items-center text-[11px] font-medium text-muted-foreground', (i === 0 || i === 6) && 'text-destructive/70')}>{w}</span>
                ))}
              </div>
              <div ref={gridRef} role="grid" aria-labelledby={captionId} onKeyDown={onGridKeyDown} className="grid grid-cols-7 gap-y-0.5">
                {monthGrid(page.year, page.month).map((d) => {
                  const selected = d.iso === current;
                  const isToday = d.iso === today;
                  const allowed = isWithinBounds(d.iso, min, max);
                  return (
                    <button
                      key={d.iso}
                      type="button"
                      role="gridcell"
                      data-iso={d.iso}
                      tabIndex={d.iso === focused ? 0 : -1}
                      disabled={!allowed}
                      aria-selected={selected}
                      aria-current={isToday ? 'date' : undefined}
                      aria-label={formatThaiDateLong(d.iso)}
                      onClick={() => pick(d.iso)}
                      onFocus={() => setFocused(d.iso)}
                      className={cn(
                        'relative mx-auto grid size-9 place-items-center rounded-lg text-sm tabular-nums transition-all outline-none',
                        'hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
                        !d.inMonth && 'text-muted-foreground/45',
                        isToday && !selected && 'font-semibold text-primary-ink ring-1 ring-primary-ink/35 ring-inset',
                        selected && 'bg-primary font-semibold text-primary-foreground shadow-sm shadow-primary/40 hover:bg-primary/90',
                        !allowed && 'cursor-not-allowed text-muted-foreground/30 line-through hover:bg-transparent',
                      )}
                    >
                      {d.day}
                      {isToday && <span aria-hidden className={cn('absolute bottom-1 size-1 rounded-full', selected ? 'bg-primary-foreground' : 'bg-primary-ink')} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {view === 'months' && (
            <div className="grid grid-cols-3 gap-1.5 p-3">
              {THAI_MONTHS_SHORT.map((m, i) => {
                const active = parseIsoDate(current)?.year === page.year && parseIsoDate(current)?.month === i;
                return (
                  <JumpButton key={m} active={active} disabled={!monthAllowed(page.year, i)} onClick={() => { setPage({ year: page.year, month: i }); setView('days'); }}>
                    {m}
                  </JumpButton>
                );
              })}
            </div>
          )}

          {view === 'years' && (
            <div className="grid grid-cols-3 gap-1.5 p-3">
              {Array.from({ length: YEARS_PER_PAGE }, (_, i) => yearStart + i).map((y) => (
                <JumpButton key={y} active={parseIsoDate(current)?.year === y} disabled={!yearAllowed(y)} onClick={() => { setPage({ ...page, year: y }); setView('months'); }}>
                  {y + BE_OFFSET}
                </JumpButton>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-border px-2.5 py-2">
            <button
              type="button"
              disabled={!isWithinBounds(today, min, max)}
              onClick={() => pick(today)}
              className="rounded-md px-2 py-1 text-xs font-medium text-primary-ink transition-colors hover:bg-primary/15 disabled:opacity-40"
            >
              วันนี้ · {formatThaiDate(today)}
            </button>
            {!required && current && (
              <button type="button" onClick={() => { commit(''); setOpen(false); }} className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                ล้าง
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {showClear && (
        <button
          type="button"
          aria-label="ล้างวันที่"
          onClick={() => { commit(''); triggerRef.current?.focus(); }}
          className={cn('absolute top-1/2 grid -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', sm ? 'right-1 size-6' : 'right-1.5 size-6')}
        >
          <X className="size-3.5" />
        </button>
      )}

      {/* Carries the value for the form and native `required` validation; focus goes back to the button. */}
      <input
        ref={hiddenRef}
        tabIndex={-1}
        aria-hidden
        name={name}
        value={current}
        required={required}
        disabled={disabled}
        onChange={() => {}}
        onFocus={() => triggerRef.current?.focus()}
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px w-full opacity-0"
      />
    </span>
  );
}

/** Round chevron button in the calendar header. */
function NavButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
      {children}
    </button>
  );
}

/** Month or year tile in the jump views. */
function JumpButton({ active, disabled, onClick, children }: { active: boolean; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'h-10 rounded-lg text-sm tabular-nums transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-30',
        active && 'bg-primary font-semibold text-primary-foreground hover:bg-primary/90',
      )}
    >
      {children}
    </button>
  );
}
