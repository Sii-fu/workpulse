import React, { useId, useMemo, useState } from 'react';
import type { Project, WorkLog, Workdays } from '../../../types';
import { addDays, localDateStr, localTimeStr } from '../../../utils/dates';
import { filterLogs, NO_FILTERS } from '../../../utils/logFilter';
import { weekDays, weekTotals } from '../../../utils/weekTotals';
import { dayLabelLong } from '../../../utils/taskSections';
import { logsToCsv, logsToMarkdown } from '../../../utils/exportLogs';
import { LogRow, formatHm as formatHmMin } from '../today/LogRow';
import { RowMenu } from '../RowMenu';
import { WeekStrip } from './WeekStrip';

export interface HistoryScreenProps {
  logs: WorkLog[];
  projects: Project[];
  workdays: Workdays;
  /** Workday length in hours (the week strip's target line). */
  hours: number;
  onEditLog(log: WorkLog): void;
  onDeleteLog(id: string): void;
  onDuplicateLog(log: WorkLog): void;
  /** Copies text to the clipboard and says so (App owns the toast). */
  onCopy(text: string): void;
  selectedIds: string[];
  onToggleSelect(id: string): void;
  onSelectMany(ids: string[]): void;
  onClearSelection(): void;
  /** Open the standup dialog for the selected logs. */
  onStandup(): void;
  /** Open the timesheet for the selected logs. */
  onTimesheet(): void;
}

const LABEL = 'block mb-1 text-[length:var(--fs-small)] font-semibold text-[var(--text-muted)]';
const FIELD = 'v2-input w-full h-11 px-3 text-[length:var(--fs-body)]';
const TEXT_BTN =
  'min-h-8 pointer-coarse:min-h-11 px-1 text-[length:var(--fs-small)] font-semibold text-[var(--accent-text)] underline underline-offset-4 cursor-pointer';

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const plural = (n: number) => `${n} ${n === 1 ? 'log' : 'logs'}`;

/** "9 – 15 Nov", or "28 Oct – 3 Nov" across a month. */
function weekRange(days: string[]): string {
  const [, m1, d1] = days[0].split('-').map(Number);
  const [, m2, d2] = days[6].split('-').map(Number);
  return m1 === m2 ? `${d1} – ${d2} ${MONTH[m2 - 1]}` : `${d1} ${MONTH[m1 - 1]} – ${d2} ${MONTH[m2 - 1]}`;
}

function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const HistoryScreenView: React.FC<HistoryScreenProps> = ({
  logs,
  projects,
  workdays,
  hours,
  onEditLog,
  onDeleteLog,
  onDuplicateLog,
  onCopy,
  selectedIds,
  onToggleSelect,
  onSelectMany,
  onClearSelection,
  onStandup,
  onTimesheet,
}) => {
  const id = useId();
  const today = localDateStr();
  const [anchor, setAnchor] = useState(today);
  const [day, setDay] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [projectId, setProjectId] = useState('all');

  const days = useMemo(() => weekDays(anchor), [anchor]);
  const totals = useMemo(() => weekTotals(logs, days), [logs, days]);
  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const thisWeek = days.includes(today);
  const lastWeek = !thisWeek && days.includes(addDays(today, -7));
  const range = weekRange(days);
  const label = thisWeek ? `This week · ${range}` : lastWeek ? `Last week · ${range}` : range;

  // Projects that have logs, so the filter offers only what can match.
  const usedIds = useMemo(() => new Set(logs.map((l) => l.projectId)), [logs]);
  const filterProjects = projects.filter((p) => usedIds.has(p.id));
  const activeProject = projectId !== 'all' && usedIds.has(projectId) ? projectId : 'all';

  // A search looks through every week; otherwise the list is the strip's week (or its picked day).
  const searching = query.trim() !== '';
  const shown = useMemo(() => {
    const hits = filterLogs(logs, { ...NO_FILTERS, query, projectId: activeProject }, today);
    if (searching) return hits;
    return day ? hits.filter((l) => l.date === day) : hits.filter((l) => l.date >= days[0] && l.date <= days[6]);
  }, [logs, query, activeProject, today, searching, day, days]);

  const groups = useMemo(() => {
    const map = new Map<string, WorkLog[]>();
    [...shown]
      .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
      .forEach((l) => map.set(l.date, [...(map.get(l.date) ?? []), l]));
    return [...map];
  }, [shown]);

  const shownIds = shown.map((l) => l.id);
  const allPicked = shownIds.length > 0 && shownIds.every((i) => selectedIds.includes(i));
  const selectedLogs = useMemo(() => logs.filter((l) => selectedIds.includes(l.id)), [logs, selectedIds]);

  const moveWeek = (n: number) => {
    setAnchor((a) => addDays(a, n * 7));
    setDay(null);
  };

  // "· 6:12 logged · in 09:48 · out 18:01": the figures in the numeral face, the words in the body face.
  const dayMeta = (date: string, list: WorkLog[]) => {
    const n = (s: string) => <span className="num">{s}</span>;
    const rec = workdays[date];
    return (
      <>
        <span>· {n(formatHmMin(list.reduce((sum, l) => sum + (l.durationMinutes ?? 0), 0)))} logged</span>
        {rec && <span>· in {n(localTimeStr(new Date(rec.clockIn)))}</span>}
        {rec?.clockOut && <span>· out {n(localTimeStr(new Date(rec.clockOut)))}</span>}
        {rec && !rec.clockOut && date < today && <span>· no clock-out</span>}
      </>
    );
  };

  const stamp = today;
  const exportItems = [
    { label: 'Download CSV', onSelect: () => download(logsToCsv(logs), `workpulse-logs-${stamp}.csv`) },
    { label: 'Copy as Markdown', onSelect: () => onCopy(logsToMarkdown(logs, projects)) },
    { label: 'Print', onSelect: () => window.print() },
  ];

  const emptyText = searching
    ? `No logs match “${query.trim()}”.`
    : day
      ? `Nothing logged on ${dayLabelLong(day)}.`
      : logs.length === 0
        ? 'No logs yet. What you log on Today shows up here, a week at a time.'
        : 'Nothing logged this week.';

  return (
    <div className="v2-history mx-auto max-w-[960px] px-4 sm:px-8 py-6 sm:py-7 flex flex-col gap-7">
      <section aria-labelledby={`${id}-week`} className="no-print">
        <h2 id={`${id}-week`} className="v2-head">
          <span>Week</span>
          <span className="v2-head-meta">Pick a day to see only its logs.</span>
        </h2>
        <WeekStrip
          days={totals}
          projects={projects}
          selected={day}
          onSelectDay={setDay}
          onPrevWeek={() => moveWeek(-1)}
          onNextWeek={() => moveWeek(1)}
          label={label}
          workdays={workdays}
          hours={hours}
          nextDisabled={thisWeek}
        />
      </section>

      <section aria-labelledby={`${id}-logs`} className="flex flex-col gap-4">
        <h2 id={`${id}-logs`} className="v2-head">
          <span>Logs</span>
          <span className="v2-head-meta num">
            {plural(shown.length)}
            {searching ? ' in all weeks' : day ? ` on ${dayLabelLong(day)}` : ''}
          </span>
        </h2>

        {day && !searching && (
          <p className="no-print -mt-2 flex flex-wrap items-center gap-x-3 text-[length:var(--fs-small)] text-[var(--text-muted)]">
            Showing {dayLabelLong(day)} only.
            <button type="button" onClick={() => setDay(null)} className={TEXT_BTN}>
              Show the whole week
            </button>
          </p>
        )}

        <div className="no-print grid gap-3 sm:grid-cols-[minmax(0,1fr)_13rem_auto] sm:items-end">
          <div>
            <label htmlFor={`${id}-q`} className={LABEL}>
              Search all logs
            </label>
            <input
              id={`${id}-q`}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Words, project or tag"
              autoComplete="off"
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor={`${id}-p`} className={LABEL}>
              Project
            </label>
            <select id={`${id}-p`} value={activeProject} onChange={(e) => setProjectId(e.target.value)} className={FIELD}>
              <option value="all">All projects</option>
              {filterProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end">
            <RowMenu label="Export all logs" buttonText="Export" items={exportItems} />
          </div>
        </div>

        {groups.length === 0 ? (
          <div className="v2-panel v2-row v2-inset flex flex-wrap items-center gap-x-4 gap-y-1">
            <p className="text-[length:var(--fs-body)] text-[var(--text-muted)]">{emptyText}</p>
            {searching && (
              <button type="button" onClick={() => setQuery('')} className={TEXT_BTN}>
                Clear search
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="no-print flex flex-wrap items-center justify-between gap-x-4 gap-y-1 -mb-1">
              <p className="text-[length:var(--fs-small)] text-[var(--text-muted)]">Tick logs for a standup, a timesheet or an export.</p>
              <button
                type="button"
                onClick={() => (allPicked ? onClearSelection() : onSelectMany([...new Set([...selectedIds, ...shownIds])]))}
                className={TEXT_BTN}
              >
                {allPicked ? 'Clear selection' : `Select all ${plural(shownIds.length)}`}
              </button>
            </div>
            {groups.map(([date, list]) => (
              <section key={date} aria-labelledby={`${id}-d-${date}`}>
                <h3
                  id={`${id}-d-${date}`}
                  className="flex flex-wrap items-baseline gap-x-2 pb-2 text-[length:var(--fs-small)] text-[var(--text-muted)]"
                >
                  <span className="font-bold text-[var(--text-main)]">
                    {date === today ? `Today · ${dayLabelLong(date)}` : dayLabelLong(date)}
                  </span>
                  {dayMeta(date, list)}
                </h3>
                <ul className="v2-panel">
                  {list.map((l) => (
                    <LogRow
                      key={l.id}
                      log={l}
                      project={byId.get(l.projectId)}
                      onEdit={onEditLog}
                      onDuplicate={onDuplicateLog}
                      onDelete={onDeleteLog}
                      selected={selectedIds.includes(l.id)}
                      onToggleSelect={onToggleSelect}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </section>

      <div aria-live="polite" className="no-print sticky bottom-4 z-10 empty:hidden">
        {selectedLogs.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 bg-[var(--bg-surface-elevated)] border border-[var(--border-control)] rounded-[var(--radius-card)]">
            <p className="num text-[length:var(--fs-small)] font-semibold text-[var(--text-main)] mr-1">{plural(selectedLogs.length)} selected</p>
            <button type="button" onClick={onStandup} className="v2-btn v2-btn-strong min-h-11 px-4 cursor-pointer">
              Standup
            </button>
            <button type="button" onClick={onTimesheet} className="v2-btn min-h-11 px-4 cursor-pointer">
              Timesheet
            </button>
            <button type="button" onClick={() => onCopy(logsToMarkdown(selectedLogs, projects))} className="v2-btn min-h-11 px-4 cursor-pointer">
              Copy as Markdown
            </button>
            <button
              type="button"
              onClick={() => download(logsToCsv(selectedLogs), `workpulse-logs-${stamp}.csv`)}
              className="v2-btn min-h-11 px-4 cursor-pointer"
            >
              Download CSV
            </button>
            <button type="button" onClick={onClearSelection} className={TEXT_BTN}>
              Clear
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// No backlog here, so nothing ticks: a plain shallow memo is enough.
export const HistoryScreen = React.memo(HistoryScreenView);
