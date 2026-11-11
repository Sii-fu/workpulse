import React, { useCallback, useId, useMemo, useState } from 'react';
import type { BacklogTask, Project, TaskStage } from '../../../types';
import { TaskRow } from './TaskRow';
import { StateMark, type TaskState } from './StateMark';
import { todayStateGroups } from '../../../utils/todayTasks';
import { dayHeading } from '../../../utils/taskDates';
import { defaultProject, splitProjectTag } from '../../../utils/projects';

export interface TodayTasksProps {
  backlog: BacklogTask[];
  projects: Project[];
  today: string;
  onAddTask(title: string, projectId: string, stage: TaskStage): void;
  onStage(id: string, stage: TaskStage, reason?: string): void;
  onComplete(task: BacklogTask): void;
  onLogTask(task: BacklogTask): void;
  onReopen(id: string): void;
  onDeleteTask(id: string): void;
  /** Sets the due date of the given pending tasks to today. */
  onMoveToToday(ids: string[]): void;
  /** Opens Plan your day (earlier tasks to carry, new tasks for today). */
  onPlanDay(): void;
  /** Switches to the Tasks page (the Plans list holds the not-started tasks of earlier days). */
  onOpenTasks(): void;
}

/** One state group inside the card: a heading with the state's mark and a count, then its rows. */
const StateGroup: React.FC<{ state: TaskState; label: string; count: number; children: React.ReactNode }> = ({ state, label, count, children }) => {
  const id = useId();
  return (
    <div role="group" aria-labelledby={`${id}-h`} className="border-t border-[var(--border-app)] [.v2-row+&]:border-t-0 [[data-theme=timecard]_&]:border-t-0">
      <div className="v2-head v2-inset pt-5 !mb-0">
        <h3 id={`${id}-h`} className="v2-head-group">
          <span className="inline-flex items-center gap-2">
            <StateMark state={state} />
            {label}
          </span>
          <span className="v2-head-meta num">{count}</span>
        </h3>
      </div>
      {children}
    </div>
  );
};

export const TodayTasks: React.FC<TodayTasksProps> = ({ backlog, projects, today, onAddTask, onStage, onComplete, onLogTask, onReopen, onDeleteTask, onMoveToToday, onPlanDay, onOpenTasks }) => {
  const id = useId();
  const [draft, setDraft] = useState('');
  const g = useMemo(() => todayStateGroups(backlog, today), [backlog, today]);
  const moveOne = useCallback((taskId: string) => onMoveToToday([taskId]), [onMoveToToday]);
  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const running = g.running.length;
  const done = g.done.length;
  const open = running + g.paused.length + g.blocked.length + g.upNext.length;
  const shown = open + done;

  const rows = (list: BacklogTask[]) => (
    <ul>
      {list.map((t) => (
        <TaskRow
          key={t.id}
          task={t}
          project={byId.get(t.projectId)}
          fromLabel={t.dueDate < today && !(t.completedAt || t.stage === 'done') ? dayHeading(t.dueDate, today) : undefined}
          onStage={onStage}
          onComplete={onComplete}
          onLogTask={onLogTask}
          onReopen={onReopen}
          onDeleteTask={onDeleteTask}
          onMoveToToday={moveOne}
        />
      ))}
    </ul>
  );

  const earlierLine =
    g.earlierPlans > 0 ? (
      <div className="v2-inset py-2">
        <button
          type="button"
          onClick={onOpenTasks}
          className="min-h-8 pointer-coarse:min-h-11 px-1 text-[length:var(--fs-small)] font-semibold text-[var(--accent-text)] underline underline-offset-4 cursor-pointer"
        >
          {g.earlierPlans} more {g.earlierPlans === 1 ? 'plan' : 'plans'} from earlier {g.earlierPlans === 1 ? 'day' : 'days'}
        </button>
      </div>
    ) : null;

  const parsed = splitProjectTag(draft, projects);
  const fallback = defaultProject(projects);
  const target = parsed.project ?? fallback;

  const add = (start: boolean) => {
    const title = parsed.text.trim();
    if (!title) return;
    onAddTask(title, target?.id ?? 'default', start ? 'in_progress' : 'planned');
    setDraft('');
  };

  return (
    <section aria-labelledby={`${id}-h`}>
      <div className="v2-head v2-head-split">
        <h2 id={`${id}-h`} className="v2-head-group">
          <span>Today's tasks</span>
          <span className="v2-head-meta num">
            {open} open
            {/* Under 420px only the first part shows; screen readers still hear all of it. */}
            <span className="sr-only min-[420px]:not-sr-only">
              {' '}· {running} running · {done} done
            </span>
          </span>
        </h2>
        <button
          type="button"
          onClick={onPlanDay}
          className="shrink-0 min-h-8 pointer-coarse:min-h-11 px-1 normal-case tracking-normal text-[length:var(--fs-small)] font-semibold text-[var(--accent-text)] underline underline-offset-4 cursor-pointer"
        >
          Plan your day
        </button>
      </div>
      <div className="v2-panel">
        <div className="v2-row v2-inset">
          <label htmlFor={`${id}-add`} className="sr-only">
            Add a task for today
          </label>
          <input
            id={`${id}-add`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add(e.shiftKey);
              }
            }}
            placeholder="Add a task for today…"
            aria-describedby={`${id}-hint`}
            autoComplete="off"
            className="v2-input w-full h-11 px-3 text-[length:var(--fs-body)]"
          />
          <p id={`${id}-hint`} aria-live="polite" className="mt-1.5 text-[length:var(--fs-small)] text-[var(--text-muted)]">
            {draft.trim()
              ? parsed.tag && !parsed.project
                ? `No project starts with "${parsed.tag}", so it goes to ${fallback?.name ?? 'General'}. Enter adds it, Shift+Enter adds and starts it.`
                : `Goes to ${target?.name ?? 'General'}. Enter adds it, Shift+Enter adds and starts it.`
              : 'End with #project to pick the project.'}
          </p>
        </div>
        {shown === 0 && (
          <p className="v2-row v2-inset text-[length:var(--fs-body)] text-[var(--text-muted)]">
            {g.earlierPlans > 0 ? 'Nothing due today.' : 'Nothing planned yet. Add the first task above.'}
          </p>
        )}
        {running > 0 && (
          <StateGroup state="running" label="Running" count={running}>
            {rows(g.running)}
          </StateGroup>
        )}
        {g.paused.length > 0 && (
          <StateGroup state="paused" label="Paused" count={g.paused.length}>
            {rows(g.paused)}
          </StateGroup>
        )}
        {g.blocked.length > 0 && (
          <StateGroup state="blocked" label="Blocked" count={g.blocked.length}>
            {rows(g.blocked)}
          </StateGroup>
        )}
        {g.upNext.length > 0 ? (
          <StateGroup state="upnext" label="Up next" count={g.upNext.length}>
            {rows(g.upNext)}
            {earlierLine}
          </StateGroup>
        ) : (
          shown > 0 && earlierLine && <div className="border-t border-[var(--border-app)] [[data-theme=timecard]_&]:border-t-0">{earlierLine}</div>
        )}
        {shown === 0 && earlierLine}
        {done > 0 && (
          <StateGroup state="done" label="Done" count={done}>
            {rows(g.done)}
          </StateGroup>
        )}
      </div>
    </section>
  );
};
