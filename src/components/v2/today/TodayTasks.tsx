import React, { useId, useMemo, useState } from 'react';
import type { BacklogTask, Project, TaskStage } from '../../../types';
import { TaskRow } from './TaskRow';
import { isRunningTask } from '../../../utils/timerStore';
import { isPendingTask } from '../../../utils/taskLogging';
import { todaysTasks } from '../../../utils/todayTasks';
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
}

export const TodayTasks: React.FC<TodayTasksProps> = ({ backlog, projects, today, onAddTask, onStage, onComplete, onLogTask, onReopen, onDeleteTask }) => {
  const id = useId();
  const [draft, setDraft] = useState('');
  const tasks = useMemo(() => todaysTasks(backlog, today), [backlog, today]);
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
      <h2 id={`${id}-h`} className="v2-head">
        <span>Today's tasks</span>
        <span className="v2-head-meta num">
          {open} open · {running} running · {done} done
        </span>
      </h2>
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
          <p className="v2-row v2-inset text-[length:var(--fs-body)] text-[var(--text-muted)]">Nothing planned yet. Add the first task above.</p>
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
      </div>
    </section>
  );
};
