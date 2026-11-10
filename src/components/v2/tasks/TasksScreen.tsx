import React, { useCallback, useId, useMemo, useState } from 'react';
import type { BacklogTask, Project, TaskStage } from '../../../types';
import { TaskRow, metaFor } from '../today/TaskRow';
import { getTaskStage } from '../../tasks/helpers';
import { sameTasksIgnoringLiveTime } from '../../../utils/timerStore';
import { addDays, localDateOfIso, localTimeStr } from '../../../utils/dates';
import { defaultProject } from '../../../utils/projects';
import { dayLabelLong, filterByProject, groupTasks, sectionProjectIds } from '../../../utils/taskSections';

export interface TasksScreenProps {
  backlog: BacklogTask[];
  projects: Project[];
  /** Local YYYY-MM-DD. */
  today: string;
  /** `dueDate` is a local YYYY-MM-DD; absent means today. */
  onAddTask(title: string, projectId: string, stage: TaskStage, dueDate?: string): void;
  onStage(id: string, stage: TaskStage, reason?: string): void;
  onComplete(task: BacklogTask): void;
  onLogTask(task: BacklogTask): void;
  /** Reopens a done task into planned ("Back to planned"). */
  onReopen(id: string): void;
  onDeleteTask(id: string): void;
  /** "Write timesheet from N tasks": the ids of the selected done tasks. */
  onLogSelected(ids: string[]): void;
}

const LABEL = 'block mb-1 text-[length:var(--fs-small)] font-semibold text-[var(--text-muted)]';
const FIELD = 'v2-input w-full h-11 px-3 text-[length:var(--fs-body)]';
const TEXT_BTN =
  'min-h-8 pointer-coarse:min-h-11 px-1 text-[length:var(--fs-small)] font-semibold text-[var(--accent-text)] underline underline-offset-4 cursor-pointer';

const plural = (n: number) => `${n} ${n === 1 ? 'task' : 'tasks'}`;

/** A section: the same heading as Today, a panel under it. */
const Section: React.FC<{ title: string; count: number; children: React.ReactNode }> = ({ title, count, children }) => {
  const id = useId();
  return (
    <section aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="v2-head">
        <span>{title}</span>
        <span className="v2-head-meta num">{plural(count)}</span>
      </h2>
      <div className="v2-panel">{children}</div>
    </section>
  );
};

const TasksScreenView: React.FC<TasksScreenProps> = ({
  backlog,
  projects,
  today,
  onAddTask,
  onStage,
  onComplete,
  onLogTask,
  onReopen,
  onDeleteTask,
  onLogSelected,
}) => {
  const id = useId();
  const [title, setTitle] = useState('');
  const [projectDraft, setProjectDraft] = useState('');
  const [dueDraft, setDueDraft] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const all = useMemo(() => groupTasks(backlog, today), [backlog, today]);
  const projectIds = useMemo(() => sectionProjectIds(all), [all]);
  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const activeFilter = filter && projectIds.includes(filter) ? filter : null;
  const sections = useMemo(() => filterByProject(all, activeFilter), [all, activeFilter]);
  const chips = projects.filter((p) => projectIds.includes(p.id));

  // The add row: a draft that is gone, archived or empty falls back to the first active project / today.
  const active = projects.filter((p) => !p.isArchived);
  const projectId = active.some((p) => p.id === projectDraft) ? projectDraft : (defaultProject(projects)?.id ?? 'default');
  const due = dueDraft && dueDraft >= today ? dueDraft : today;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = title.trim();
    if (!text) return;
    onAddTask(text, projectId, 'planned', due);
    setTitle('');
    setDueDraft('');
  };

  // Selection only counts done tasks that are on screen (a project filter hides the rest).
  const doneIds = sections.doneRecently.map((t) => t.id);
  const picked = doneIds.filter((i) => selected.includes(i));
  const allPicked = doneIds.length > 0 && picked.length === doneIds.length;
  const toggle = useCallback(
    (taskId: string) => setSelected((cur) => (cur.includes(taskId) ? cur.filter((i) => i !== taskId) : [...cur, taskId])),
    [],
  );

  const row = (t: BacklogTask, extra: Partial<React.ComponentProps<typeof TaskRow>> = {}) => (
    <TaskRow
      key={t.id}
      task={t}
      project={byId.get(t.projectId)}
      onStage={onStage}
      onComplete={onComplete}
      onLogTask={onLogTask}
      onReopen={onReopen}
      onDeleteTask={onDeleteTask}
      {...extra}
    />
  );

  const anyTasks = projectIds.length > 0;
  const upcomingCount = sections.upcoming.reduce((n, d) => n + d.tasks.length, 0);
  const tomorrow = addDays(today, 1);

  return (
    <div className="mx-auto max-w-[960px] px-4 sm:px-8 py-6 sm:py-7 flex flex-col gap-7">
      <form onSubmit={submit} aria-label="Add a task" className="v2-panel v2-inset py-[var(--row-pad)]">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(11rem,15rem)_10rem_auto] sm:items-end">
          <div>
            <label htmlFor={`${id}-title`} className={LABEL}>
              Task
            </label>
            <input
              id={`${id}-title`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs doing?"
              autoComplete="off"
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor={`${id}-project`} className={LABEL}>
              Project
            </label>
            <select id={`${id}-project`} value={projectId} onChange={(e) => setProjectDraft(e.target.value)} className={FIELD}>
              {active.length === 0 && <option value="default">General</option>}
              {active.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-due`} className={LABEL}>
              Due
            </label>
            <input
              id={`${id}-due`}
              type="date"
              value={due}
              min={today}
              onChange={(e) => setDueDraft(e.target.value)}
              className={`${FIELD} num`}
            />
          </div>
          <button
            type="submit"
            disabled={!title.trim()}
            className="v2-btn v2-btn-strong h-11 px-5 cursor-pointer disabled:opacity-50 disabled:cursor-default"
          >
            Add
          </button>
        </div>
      </form>

      {chips.length > 1 && (
        <div role="group" aria-label="Filter by project" className="flex flex-wrap gap-2 -mt-2">
          {[null, ...chips].map((p) => {
            const on = (p?.id ?? null) === activeFilter;
            return (
              <button
                key={p?.id ?? 'all'}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(p?.id ?? null)}
                className={`v2-btn ${on ? 'v2-btn-strong' : ''} inline-flex items-center gap-2 min-h-8 pointer-coarse:min-h-11 px-3 cursor-pointer transition-colors`}
              >
                {p && <span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />}
                {p ? p.name : 'All'}
              </button>
            );
          })}
        </div>
      )}

      {sections.overdue.length > 0 && (
        <Section title="Overdue" count={sections.overdue.length}>
          <ul>
            {sections.overdue.map((t) => {
              const from = sections.overdueFrom[t.id];
              const base = metaFor(t, getTaskStage(t));
              return row(t, { meta: from && from < today ? `from ${dayLabelLong(from)} · ${base}` : base });
            })}
          </ul>
        </Section>
      )}

      <Section title="Today" count={sections.today.length}>
        {sections.today.length === 0 ? (
          <p className="v2-row v2-inset text-[length:var(--fs-body)] text-[var(--text-muted)]">
            {anyTasks ? 'Nothing due today.' : 'Nothing planned yet. Add the first task above.'}
          </p>
        ) : (
          <ul>{sections.today.map((t) => row(t))}</ul>
        )}
      </Section>

      {upcomingCount > 0 && (
        <Section title="Upcoming" count={upcomingCount}>
          {sections.upcoming.map((d) => (
            <React.Fragment key={d.date}>
              <h3 className="v2-inset pt-3 pb-1 text-[length:var(--fs-small)] font-bold text-[var(--text-muted)] border-t border-[var(--border-app)] first:border-t-0">
                {d.date === tomorrow ? `Tomorrow · ${dayLabelLong(d.date)}` : dayLabelLong(d.date)}
              </h3>
              <ul>{d.tasks.map((t) => row(t))}</ul>
            </React.Fragment>
          ))}
        </Section>
      )}

      {sections.blocked.length > 0 && (
        <Section title="Blocked" count={sections.blocked.length}>
          <ul>{sections.blocked.map((t) => row(t))}</ul>
        </Section>
      )}

      {sections.doneRecently.length > 0 && (
        <Section title="Done recently" count={sections.doneRecently.length}>
          <div className="v2-row v2-inset flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <p className="text-[length:var(--fs-small)] text-[var(--text-muted)]">Tick done tasks to write a timesheet from them.</p>
            <button
              type="button"
              onClick={() => setSelected(allPicked ? selected.filter((i) => !doneIds.includes(i)) : [...new Set([...selected, ...doneIds])])}
              className={TEXT_BTN}
            >
              {allPicked ? 'Clear selection' : 'Select all'}
            </button>
          </div>
          <ul>
            {sections.doneRecently.map((t) =>
              row(t, {
                selected: picked.includes(t.id),
                onToggleSelect: toggle,
                meta: t.completedAt
                  ? `done ${dayLabelLong(localDateOfIso(t.completedAt))}, ${localTimeStr(new Date(t.completedAt))}`
                  : `done ${dayLabelLong(t.dueDate)}`,
              }),
            )}
          </ul>
        </Section>
      )}

      <div aria-live="polite" className="sticky bottom-4 z-10 empty:hidden">
        {picked.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 bg-[var(--bg-surface-elevated)] border border-[var(--border-control)] rounded-[var(--radius-card)]">
            <button
              type="button"
              onClick={() => {
                onLogSelected(picked);
                setSelected([]);
              }}
              className="v2-btn v2-btn-strong min-h-11 px-4 cursor-pointer"
            >
              Write timesheet from {plural(picked.length)}
            </button>
            <button type="button" onClick={() => setSelected([])} className={TEXT_BTN}>
              Clear
            </button>
            <p className="text-[length:var(--fs-small)] text-[var(--text-muted)]">Time already in a log is not added twice.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Redraws only when something it shows changes: running clocks tick on their own (<TaskClock>),
// so a backlog that differs only in running tasks' elapsed seconds is "the same".
const sameTasksProps = (prev: TasksScreenProps, next: TasksScreenProps): boolean =>
  (Object.keys(next) as (keyof TasksScreenProps)[]).every((k) =>
    k === 'backlog' ? sameTasksIgnoringLiveTime(prev.backlog, next.backlog) : prev[k] === next[k],
  );

export const TasksScreen = React.memo(TasksScreenView, sameTasksProps);
