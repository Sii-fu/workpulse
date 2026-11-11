import React, { useId, useMemo, useState } from 'react';
import type { BacklogTask, Project } from '../../types';
import { ModalShell } from '../ui/ModalShell';
import { dayHeading } from '../../utils/taskDates';
import { dayLabelLong } from '../../utils/taskSections';
import { parsePlanLines } from '../../utils/planYourDay';

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
}) => {
  const id = useId();
  const [checked, setChecked] = useState<Set<string>>(() => new Set(defaultCheckedIds));
  const [draft, setDraft] = useState('');
  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const newTasks = parsePlanLines(draft, projects);

  const toggle = (taskId: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });

  const start = () =>
    onStart({ carryIds: candidates.filter((t) => checked.has(t.id)).map((t) => t.id), newTasks });

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
          <textarea
            id={`${id}-new`}
            data-autofocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                start();
              }
            }}
            rows={3}
            placeholder="One task per line…"
            aria-describedby={`${id}-hint`}
            className="v2-input block w-full px-3 py-2.5 text-[length:var(--fs-body)] leading-snug resize-y"
          />
          <p id={`${id}-hint`} aria-live="polite" className={`mt-1.5 ${MUTED}`}>
            {newTasks.length > 0
              ? `${newTasks.length} new ${newTasks.length === 1 ? 'task' : 'tasks'} for today.`
              : 'End a line with #project to pick the project. Ctrl+Enter starts the day.'}
          </p>
        </section>
      </div>

      <div className="flex items-center justify-end gap-2 px-4 sm:px-6 py-3 border-t border-[var(--border-app)] shrink-0">
        <button type="button" onClick={onClose} className={FOOT_BTN}>
          Skip
        </button>
        <button type="button" onClick={start} className={`${FOOT_BTN} v2-btn-strong`}>
          Start the day
        </button>
      </div>
    </ModalShell>
  );
};
