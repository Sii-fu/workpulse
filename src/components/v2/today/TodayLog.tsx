import React, { useId, useMemo, useState } from 'react';
import type { Project, WorkLog } from '../../../types';
import { LogRow, formatMinutes } from './LogRow';
import { SyncButton, type SyncState } from '../SyncButton';
import type { LogFormPrefill } from '../LogFormDialog';
import { localTimeStr } from '../../../utils/dates';
import { defaultProject, splitProjectTag } from '../../../utils/projects';

export interface TodayLogProps {
  logs: WorkLog[];
  projects: Project[];
  today: string;
  onAddLog(data: Omit<WorkLog, 'id' | 'createdAt'>): void;
  onOpenLogForm(prefill: LogFormPrefill | null): void;
  onEditLog(log: WorkLog): void;
  onDeleteLog(id: string): void;
  onDuplicateLog(log: WorkLog): void;
  onEndDay(): void;
  /** Opens the Standup dialog with today's logs selected. */
  onStandup(): void;
  onOpenImage(base64: string): void;
  sync: SyncState;
}

export const TodayLog: React.FC<TodayLogProps> = ({ logs, projects, today, onAddLog, onOpenLogForm, onEditLog, onDeleteLog, onDuplicateLog, onEndDay, onStandup, onOpenImage, sync }) => {
  const id = useId();
  const [draft, setDraft] = useState('');
  const todays = useMemo(
    () => logs.filter((l) => l.date === today).sort((a, b) => b.time.localeCompare(a.time) || b.createdAt.localeCompare(a.createdAt)),
    [logs, today],
  );
  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const total = todays.reduce((sum, l) => sum + (l.durationMinutes ?? 0), 0);

  const parsed = splitProjectTag(draft, projects);
  const target = parsed.project ?? defaultProject(projects);

  const logNow = () => {
    const text = parsed.text.trim();
    if (!text) return;
    onAddLog({
      date: today,
      time: localTimeStr(),
      projectId: target?.id ?? 'default',
      projectName: target?.name ?? 'General',
      description: text,
      status: 'completed',
      tags: [],
    });
    setDraft('');
  };

  const openDetails = () => {
    const text = parsed.text.trim();
    onOpenLogForm(text || parsed.project ? { description: text, projectId: target?.id ?? '', status: 'completed' } : null);
    setDraft('');
  };

  return (
    <section aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="v2-head">
        <span>Today's log</span>
        <span className="v2-head-meta num">
          {todays.length} {todays.length === 1 ? 'entry' : 'entries'} · {formatMinutes(total)}
          <span className="sr-only"> logged</span>
        </span>
      </h2>
      <div className="v2-panel">
        <div className="v2-row v2-inset">
          <div className="flex gap-2">
            <label htmlFor={`${id}-add`} className="sr-only">
              What did you just finish?
            </label>
            <input
              id={`${id}-add`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  logNow();
                }
              }}
              placeholder="What did you just finish?"
              aria-describedby={`${id}-hint`}
              autoComplete="off"
              className="v2-input flex-1 min-w-0 h-11 px-3 text-[length:var(--fs-body)]"
            />
            <button type="button" onClick={openDetails} className="v2-btn shrink-0 h-11 px-4 cursor-pointer transition-colors">
              Details
            </button>
          </div>
          <p id={`${id}-hint`} aria-live="polite" className="mt-1.5 text-[length:var(--fs-small)] text-[var(--text-muted)]">
            {draft.trim()
              ? parsed.tag && !parsed.project
                ? `No project starts with "${parsed.tag}", so Enter logs it to ${target?.name ?? 'General'}.`
                : `Enter logs it to ${target?.name ?? 'General'}.`
              : 'Enter logs it. End with #project to pick the project.'}
          </p>
        </div>
        {todays.length === 0 ? (
          <p className="v2-row v2-inset text-[length:var(--fs-body)] text-[var(--text-muted)]">No logs today. Finished something? Write one line above.</p>
        ) : (
          <ul>
            {todays.map((l) => (
              <LogRow
                key={l.id}
                log={l}
                project={byId.get(l.projectId)}
                onEdit={onEditLog}
                onDuplicate={onDuplicateLog}
                onDelete={onDeleteLog}
                onOpenImage={onOpenImage}
              />
            ))}
          </ul>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <SyncButton {...sync} />
        {todays.length > 0 && (
          <button type="button" onClick={onStandup} className="v2-btn min-h-11 px-4 cursor-pointer transition-colors">
            Standup
          </button>
        )}
        <button
          type="button"
          onClick={onEndDay}
          className="min-h-8 pointer-coarse:min-h-11 px-2 text-[length:var(--fs-body)] font-semibold text-[var(--accent-text)] underline-offset-4 hover:underline cursor-pointer"
        >
          End my day
        </button>
      </div>
    </section>
  );
};
