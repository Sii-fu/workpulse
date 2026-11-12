import React, { useId, useMemo, useState } from 'react';
import type { BacklogTask, Project } from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { dayHeading } from '../../utils/taskDates';
import { dayLabelLong } from '../../utils/taskSections';
import { defaultProject } from '../../utils/projects';
import { parsePlanLines } from '../../utils/planYourDay';
import { ProjectInput } from './ProjectInput';

export interface PlanYourDayResult {
  carryIds: string[];
  newTasks: { title: string; projectId: string }[];
}

interface PlanYourDayDialogProps {
  isOpen: boolean;
  onClose(): void;
  /** Local YYYY-MM-DD. */
  today: string;
  /** Tasks just taken from the phone inbox (read-only here). */
  phoneTasks: BacklogTask[];
  /** Pending tasks from earlier days that can be carried to today. */
  candidates: BacklogTask[];
  defaultCheckedIds: string[];
  projects: Project[];
  onStart(r: PlanYourDayResult): void;
  /** Remembers the project of the last task added. */
  onProjectUsed(id: string): void;
}

const FOOT_BTN = 'v2-btn min-h-11 px-4 cursor-pointer transition-colors';
const MUTED = 'text-[length:var(--fs-small)] text-[var(--text-muted)]';

export const PlanYourDayDialog: React.FC<PlanYourDayDialogProps> = ({ isOpen, ...rest }) =>
  isOpen ? <PlanPanel {...rest} /> : null;

// Mounted fresh on every open, so the ticks start from the defaults and the box is empty.
const PlanPanel: React.FC<Omit<PlanYourDayDialogProps, 'isOpen'>> = ({
  onClose,
  today,
  phoneTasks,
  candidates,
  defaultCheckedIds,
  projects,
  onStart,
  onProjectUsed,
}) => {
  const id = useId();
  const [checked, setChecked] = useState<Set<string>>(() => new Set(defaultCheckedIds));
  const [draft, setDraft] = useState('');
  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const { tasks: newTasks, problems } = useMemo(() => parsePlanLines(draft, projects), [draft, projects]);
  const blocked = problems.length > 0;
  const problemText = problems
    .map((p) =>
      p.kind === 'no-project'
        ? `No project at the start of line ${p.line} — start with a project name`
        : `Line ${p.line} has a project but no task after it`,
    )
    .join('; ');

  const toggle = (taskId: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });

  const start = () => {
    if (blocked) return;
    if (newTasks.length > 0) onProjectUsed(newTasks[newTasks.length - 1].projectId);
    onStart({ carryIds: candidates.filter((t) => checked.has(t.id)).map((t) => t.id), newTasks });
  };

  const carryCount = candidates.filter((t) => checked.has(t.id)).length;

  return (
    <ModalShell
      onClose={onClose}
      labelledBy={`${id}-title`}
      backdropClassName="p-0 sm:p-4"
      className="w-full max-w-xl max-h-[100dvh] sm:max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden bg-[var(--bg-app)] text-[var(--text-main)] sm:border border-[var(--border-app)] sm:rounded-[var(--radius-card)]"
    >
      <div className="px-4 sm:px-6 pt-5 pb-5 shrink-0">
        <h2 id={`${id}-title`} className="font-[family-name:var(--font-display)] text-[length:var(--fs-body)] font-extrabold">
          Plan your day
        </h2>
        <p className={`mt-0.5 ${MUTED}`}>{dayLabelLong(today)}. Choose what today holds; nothing moves unless you start.</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pb-5 flex flex-col gap-6">
        {phoneTasks.length > 0 && (
          <section aria-labelledby={`${id}-phone`}>
            <h3 id={`${id}-phone`} className="v2-head v2-head-label">
              <span>From your phone</span>
              <span className="v2-head-meta num">{phoneTasks.length} added</span>
            </h3>
            <ul className="v2-panel">
              {phoneTasks.map((t) => (
                <li key={t.id} className="v2-row v2-inset flex items-center gap-3.5">
                  <span
                    className="v2-ribbon self-stretch min-h-8"
                    style={{ backgroundColor: byId.get(t.projectId)?.color ?? 'var(--border-control)' }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-[length:var(--fs-body)] font-semibold break-words">{t.title}</p>
                    <p className={MUTED}>
                      {dayHeading(t.dueDate, today)} · {byId.get(t.projectId)?.name ?? 'No project'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {candidates.length > 0 && (
          <section aria-labelledby={`${id}-earlier`}>
            {/* The heading wraps on phones instead of being cut short. */}
            <h3 id={`${id}-earlier`} className="v2-head v2-head-label [&>span:first-child]:!whitespace-normal">
              <span>Still pending from earlier days</span>
              <span className="v2-head-meta num !shrink-0">{carryCount} to carry</span>
            </h3>
            <ul className="v2-panel">
              {candidates.map((t) => {
                return (
                  <li key={t.id} className="v2-row v2-inset">
                    <label className="flex items-center gap-3.5 min-h-8 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked.has(t.id)}
                        onChange={() => toggle(t.id)}
                        className="w-4 h-4 shrink-0 accent-[var(--accent-text)] cursor-pointer"
                      />
                      <span
                        className="v2-ribbon self-stretch min-h-8"
                        style={{ backgroundColor: byId.get(t.projectId)?.color ?? 'var(--border-control)' }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0">
                        <span className="block text-[length:var(--fs-body)] font-semibold break-words">{t.title}</span>
                        <span className={`block ${MUTED}`}>
                          {dayHeading(t.dueDate, today)} · {byId.get(t.projectId)?.name ?? 'No project'}
                          {t.fromPhone ? ' · from phone' : ''}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section>
          <h3 className="v2-head v2-head-label">
            <label htmlFor={`${id}-new`}>Add today's tasks</label>
          </h3>
          <ProjectInput
            id={`${id}-new`}
            label="Add today's tasks"
            multiline
            autoFocusMark
            value={draft}
            onChange={setDraft}
            projects={projects}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                start();
              }
            }}
            rows={3}
            placeholder={`${defaultProject(projects)?.name ?? 'Project'} the task you will do`}
            describedBy={`${id}-hint`}
          />
          <p
            id={`${id}-hint`}
            aria-live="polite"
            className={`mt-1.5 text-[length:var(--fs-small)] ${blocked ? 'text-[var(--danger)] font-semibold' : 'text-[var(--text-muted)]'}`}
          >
            {blocked
              ? `${problemText}. Fix or remove ${problems.length === 1 ? 'that line' : 'those lines'} to start the day.`
              : newTasks.length > 0
                ? `${newTasks.length} new ${newTasks.length === 1 ? 'task' : 'tasks'} for today.`
                : 'One task per line: the project name first, then the task. Ctrl+Enter starts the day.'}
          </p>
        </section>
      </div>

      <div className="flex items-center justify-end gap-2 px-4 sm:px-6 py-3 border-t border-[var(--border-app)] shrink-0">
        <button type="button" onClick={onClose} className={FOOT_BTN}>
          Skip
        </button>
        <button
          type="button"
          onClick={start}
          disabled={blocked}
          aria-describedby={blocked ? `${id}-hint` : undefined}
          className={`${FOOT_BTN} v2-btn-strong disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          Start the day
        </button>
      </div>
    </ModalShell>
  );
};
