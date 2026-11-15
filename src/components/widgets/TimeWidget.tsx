import React from 'react';
import { X } from 'lucide-react';
import { clockState, formatClock, formatHm, formatHms } from '../../utils/workday';
import { localTimeStr } from '../../utils/dates';
import { desktopBridge } from '../../utils/desktopBridge';
import type { WidgetSnapshot } from '../../utils/widgets';
import { useNow } from '../v2/useNow';

// Today's time and the time left in the workday, in the band colours of the current theme.
export const TimeWidget: React.FC<{ snap: WidgetSnapshot | null }> = ({ snap }) => {
  const now = useNow(1000);
  const rec = snap?.clockIn ? { clockIn: snap.clockIn, clockOut: snap.clockOut ?? undefined } : undefined;
  const c = clockState(rec, snap?.hours ?? 8, now);
  const label =
    c.phase === 'off' ? 'Office clock' : c.phase === 'out' ? 'Worked today' : c.phase === 'over' ? 'Over by' : 'Time left';
  const big =
    c.phase === 'off'
      ? '--:--:--'
      : c.phase === 'out'
        ? formatHm(c.workedSec)
        : c.phase === 'over'
          ? formatHms(c.overSec)
          : formatHms(c.leftSec);
  const sub =
    c.phase === 'off'
      ? snap
        ? 'Not clocked in'
        : 'Waiting for WorkPulse…'
      : c.phase === 'out'
        ? `In ${localTimeStr(new Date(c.clockInMs as number))} · out ${localTimeStr(new Date(Date.parse(snap?.clockOut as string)))}`
        : `Worked ${formatHm(c.workedSec)} · leave ${localTimeStr(new Date(c.leaveAtMs as number))}`;

  return (
    <div className="wg group relative flex h-screen flex-col justify-center gap-1 overflow-hidden rounded-[var(--radius-card)] border border-[var(--band-line)] bg-[var(--band-bg)] px-4 text-[var(--band-ink)]">
      <div className="flex items-baseline justify-between gap-3 text-[length:var(--fs-small)] text-[var(--band-muted)]">
        <span className="font-semibold uppercase tracking-[0.08em]">{label}</span>
        <span className="num">{formatClock(now)}</span>
      </div>
      <div
        className="num text-[34px] font-bold leading-none"
        style={{ color: c.phase === 'off' || c.phase === 'out' ? undefined : `var(--clock-${c.phase})` }}
      >
        {big}
      </div>
      <div className="text-[length:var(--fs-small)] text-[var(--band-muted)]">{sub}</div>
      <button
        type="button"
        aria-label="Hide this widget"
        title="Hide this widget"
        onClick={() => desktopBridge()?.command({ type: 'close', kind: 'time' })}
        className="wg-btn absolute right-1 top-1 hidden h-6 w-6 cursor-pointer items-center justify-center rounded-[var(--radius-btn)] text-[var(--band-muted)] hover:text-[var(--band-ink)] group-hover:flex"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
};
