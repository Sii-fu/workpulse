import React, { useCallback, useId, useMemo, useState } from 'react';
import type { BacklogTask, Project, TaskStage } from '../../../types';
import { TaskRow } from './TaskRow';
import { EarlierBlock } from '../tasks/EarlierGroup';
import { isRunningTask } from '../../../utils/timerStore';
import { isPendingTask } from '../../../utils/taskLogging';
import { earlierPending, todaysTasks } from '../../../utils/todayTasks';
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
}

/** The "Earlier, still pending" block shows this many of the most recent days until the user asks for more. */
const EARLIER_DAYS_SHOWN = 3;

export const TodayTasks: React.FC<TodayTasksProps> = ({ backlog, projects, today, onAddTask, onStage, onComplete, onLogTask, onReopen, onDeleteTask, onMoveToToday, onPlanDay }) => {
  const id = useId();
  const [draft, setDraft] = useState('');
  const [allEarlier, setAllEarlier] = useState(false);
  const tasks = useMemo(() => todaysTasks(backlog, today), [backlog, today]);
  const earlier = useMemo(() => earlierPending(backlog, today), [backlog, today]);
  const moveOne = useCallback((taskId: string) => onMoveToToday([taskId]), [onMoveToToday]);
  const shownEarlier = allEarlier ? earlier : earlier.slice(0, EARLIER_DAYS_SHOWN);
  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const running = tasks.filter(isRunningTask).length;
  const done = tasks.filter((t) => !isPendingTask(t)).length;
  const open = tasks.length - done;

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
        {tasks.length === 0 ? (
          <p className="v2-row v2-inset text-[length:var(--fs-body)] text-[var(--text-muted)]">
            {earlier.length > 0 ? 'Nothing due today.' : 'Nothing planned yet. Add the first task above.'}
          </p>
        ) : (
          <ul>
            {tasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                project={byId.get(t.projectId)}
                onStage={onStage}
                onComplete={onComplete}
                onLogTask={onLogTask}
                onReopen={onReopen}
                onDeleteTask={onDeleteTask}
              />
            ))}
          </ul>
        )}
        {earlier.length > 0 && (
          <div aria-labelledby={`${id}-earlier`} role="group" className="mt-2">
            {/* The rule above the block: the last task row already draws one in Time Card, and the empty line does everywhere. */}
            <h3
              id={`${id}-earlier`}
              className={`v2-inset pt-3 text-[length:var(--fs-small)] font-semibold text-[var(--text-muted)] ${tasks.length > 0 ? 'border-t border-[var(--border-app)] [[data-theme=timecard]_&]:border-t-0' : ''}`}
            >
              Earlier, still pending
            </h3>
            {shownEarlier.map((d) => (
              <EarlierBlock key={d.date} heading={dayHeading(d.date, today)} tasks={d.tasks} onMoveAll={onMoveToToday}>
                <ul>
                  {d.tasks.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      project={byId.get(t.projectId)}
                      onStage={onStage}
                      onComplete={onComplete}
                      onLogTask={onLogTask}
                      onReopen={onReopen}
                      onDeleteTask={onDeleteTask}
                      onMoveToToday={moveOne}
                    />
                  ))}
                </ul>
              </EarlierBlock>
            ))}
            {earlier.length > EARLIER_DAYS_SHOWN && (
              <div className="v2-inset py-2">
                <button
                  type="button"
                  aria-expanded={allEarlier}
                  onClick={() => setAllEarlier((v) => !v)}
                  className="min-h-8 pointer-coarse:min-h-11 px-1 text-[length:var(--fs-small)] font-semibold text-[var(--accent-text)] underline underline-offset-4 cursor-pointer"
                >
                  {allEarlier ? 'Show fewer days' : `Show ${earlier.length - EARLIER_DAYS_SHOWN} more ${earlier.length - EARLIER_DAYS_SHOWN === 1 ? 'day' : 'days'}`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
