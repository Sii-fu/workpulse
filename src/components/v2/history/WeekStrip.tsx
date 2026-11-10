import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Project, Workdays } from '../../../types';
import type { weekTotals } from '../../../utils/weekTotals';
import { localDateStr, parseLocalDate } from '../../../utils/dates';
import { formatHm as formatHmMin } from '../today/LogRow';
import { IconButton } from '../../ui/IconButton';

export interface WeekStripProps {
  days: ReturnType<typeof weekTotals>;
  projects: Project[];
  /** The day that filters the list, or null for the whole week. */
  selected: string | null;
  /** Clicking the selected day again passes null. */
  onSelectDay(date: string | null): void;
  onPrevWeek(): void;
  onNextWeek(): void;
  /** The week in words: "This week · 9 – 15 Nov". */
  label: string;
  /** Days with a workday record get a target line at `hours`. */
  workdays?: Workdays;
  hours?: number;
  /** The week holds today: there is nothing ahead to show. */
  nextDisabled?: boolean;
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "6 hours 12 minutes", "1 hour", "45 minutes", "nothing logged". */
export function spokenDuration(minutes: number): string {
  if (minutes <= 0) return 'nothing logged';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} ${h === 1 ? 'hour' : 'hours'}`);
  if (m) parts.push(`${m} ${m === 1 ? 'minute' : 'minutes'}`);
  return parts.join(' ');
}

const BAR_HEIGHT = 120;

// Seven day columns: a stacked bar of project colours (logged minutes), scaled to the week's
// busiest day or the day's target, whichever is larger. Each day is a button that filters the list.
export const WeekStrip: React.FC<WeekStripProps> = ({
  days,
  projects,
  selected,
  onSelectDay,
  onPrevWeek,
  onNextWeek,
  label,
  workdays = {},
  hours = 8,
  nextDisabled,
}) => {
  const today = localDateStr();
  const order = new Map(projects.map((p, i) => [p.id, i]));
  const byId = new Map(projects.map((p) => [p.id, p]));
  const targetMin = hours * 60;
  const hasTarget = days.some((d) => workdays[d.date]);
  const max = Math.max(1, ...days.map((d) => d.total), hasTarget ? targetMin : 0);
  const weekTotal = days.reduce((n, d) => n + d.total, 0);

  // The week's projects, biggest first, for the legend.
  const legend = new Map<string, number>();
  days.forEach((d) => d.byProject.forEach((p) => legend.set(p.projectId, (legend.get(p.projectId) ?? 0) + p.minutes)));
  const legendRows = [...legend].filter(([, m]) => m > 0).sort((a, b) => b[1] - a[1]);

  return (
    <div className="v2-panel">
      <div className="v2-inset flex items-center gap-2 py-2 border-b border-[var(--border-app)]">
        <IconButton label="Previous week" onClick={onPrevWeek}>
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        </IconButton>
        <p className="flex-1 min-w-0 text-center text-[length:var(--fs-small)] font-semibold text-[var(--text-main)] truncate">
          {label}
        </p>
        <IconButton label="Next week" onClick={onNextWeek} disabled={nextDisabled}>
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </IconButton>
      </div>

      <div role="group" aria-label={`Logged time per day, ${label}`} className="v2-inset grid grid-cols-7 gap-1 sm:gap-2 pt-3 pb-2">
        {days.map((d) => {
          const date = parseLocalDate(d.date);
          const dayName = WEEKDAY[date.getDay()];
          const spokenDay = `${dayName} ${date.getDate()} ${MONTH[date.getMonth()]}`;
          const isSelected = selected === d.date;
          const isToday = d.date === today;
          const target = workdays[d.date] ? targetMin : 0;
          const segs = [...d.byProject]
            .filter((p) => p.minutes > 0)
            .sort((a, b) => (order.get(a.projectId) ?? 1e9) - (order.get(b.projectId) ?? 1e9));
          return (
            <button
              key={d.date}
              type="button"
              aria-pressed={isSelected}
              aria-label={`${spokenDay}, ${spokenDuration(d.total)}${isToday ? ', today' : ''}`}
              onClick={() => onSelectDay(isSelected ? null : d.date)}
              className={`group flex flex-col items-center gap-1.5 min-w-0 pt-1.5 pb-1 rounded-[var(--radius-btn)] cursor-pointer transition-colors hover:bg-[var(--bg-subtle)] ${
                isSelected ? 'bg-[var(--bg-subtle)] ring-1 ring-[var(--border-control)]' : ''
              }`}
            >
              <span
                className={`num text-[length:var(--fs-small)] font-semibold ${d.total > 0 ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}
              >
                {d.total > 0 ? formatHmMin(d.total) : '–'}
              </span>
              <span className="relative w-full flex justify-center border-b border-[var(--border-control)]" style={{ height: BAR_HEIGHT }}>
                <span
                  className="flex flex-col-reverse gap-px w-[min(100%,36px)] overflow-hidden self-end"
                  style={{
                    height: `${(d.total / max) * 100}%`,
                    borderRadius: 'min(var(--radius-btn), 3px) min(var(--radius-btn), 3px) 0 0',
                  }}
                >
                  {segs.map((s) => (
                    <span
                      key={s.projectId}
                      className="block w-full shrink-0"
                      style={{ flexGrow: s.minutes, flexBasis: 0, backgroundColor: byId.get(s.projectId)?.color ?? 'var(--border-control)' }}
                    />
                  ))}
                </span>
                {target > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 border-t border-dashed border-[var(--text-muted)]"
                    style={{ bottom: `${(target / max) * 100}%` }}
                  />
                )}
              </span>
              <span className="flex flex-col items-center gap-1 leading-tight">
                <span
                  className={`text-[length:var(--fs-small)] ${
                    isSelected || isToday ? 'font-bold text-[var(--text-main)]' : 'text-[var(--text-muted)]'
                  } ${isToday ? 'underline underline-offset-2 decoration-2 decoration-[var(--accent)]' : ''}`}
                >
                  {dayName}
                </span>
                <span className="num text-[length:var(--fs-small)] text-[var(--text-muted)]">{date.getDate()}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="v2-inset flex flex-wrap items-center gap-x-4 gap-y-1 pb-3 text-[length:var(--fs-small)] text-[var(--text-muted)]">
        <span>
          <span className="num font-semibold text-[var(--text-main)]">{formatHmMin(weekTotal)}</span> logged this week
        </span>
        {legendRows.map(([id, m]) => (
          <span key={id} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="w-2.5 h-2.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: byId.get(id)?.color ?? 'var(--border-control)' }}
            />
            <span>{byId.get(id)?.name ?? 'Deleted project'}</span>
            <span className="num">{formatHmMin(m)}</span>
          </span>
        ))}
        {hasTarget && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="w-4 border-t border-dashed border-[var(--text-muted)]" />
            <span>{hours} h workday</span>
          </span>
        )}
      </div>
    </div>
  );
};
