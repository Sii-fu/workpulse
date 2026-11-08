import React from 'react';
import { Pause } from 'lucide-react';
import { BacklogTask, Project } from '../types';
import { clockParts } from '../utils/clock';

interface RunningStripProps {
  backlog: BacklogTask[];
  projects: Project[];
  onPause: (taskId: string) => void;
  onOpenTasks: () => void;
}

// The one thing on screen that moves: whatever you are timing right now, with its clock, on every
// screen and in every theme. Several tasks can run at once; the first is shown and the rest counted.
export const RunningStrip: React.FC<RunningStripProps> = ({ backlog, projects, onPause, onOpenTasks }) => {
  const running = backlog.filter((t) => t.stage === 'in_progress');
  if (running.length === 0) return null;

  const task = running[0];
  const project = projects.find((p) => p.id === task.projectId);
  const [h, m, s] = clockParts(task.elapsedSeconds);

  return (
    <div
      role="region"
      aria-label="Running task"
      className="no-print border-b border-[var(--border-app)] bg-[var(--bg-surface)]"
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-1.5 flex items-center gap-3 text-xs">
        <span className="flex items-center gap-2 min-w-0 flex-1">
          <span className="relative flex w-2 h-2 shrink-0" aria-hidden="true">
            <span className="absolute inset-0 rounded-full bg-[var(--accent)]" />
          </span>
          <span className="font-semibold text-[var(--text-main)] truncate">{task.title}</span>
          {project && <span className="text-[var(--text-muted)] truncate hidden sm:inline">{project.name}</span>}
        </span>

        {/* Not announced every second: the visible clock is for the eye, the label below is for the reader. */}
        <span className="font-mono tabular-nums text-sm text-[var(--text-main)] shrink-0" aria-hidden="true">
          {h}
          <span className="clock-colon">:</span>
          {m}
          <span className="clock-colon">:</span>
          {s}
        </span>
        <span className="sr-only">
          Running for {Number(h)} hours {Number(m)} minutes
        </span>

        {running.length > 1 && (
          <button
            type="button"
            onClick={onOpenTasks}
            className="text-[var(--accent-text)] hover:underline cursor-pointer shrink-0"
          >
            +{running.length - 1} more running
          </button>
        )}
        <button
          type="button"
          onClick={() => onPause(task.id)}
          aria-label={`Pause running task: ${task.title}`}
          className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-btn)] border border-[var(--border-control)] text-[var(--text-main)] hover:bg-[var(--bg-subtle)] cursor-pointer"
        >
          <Pause className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Pause</span>
        </button>
        <button
          type="button"
          onClick={onOpenTasks}
          className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:underline cursor-pointer hidden sm:inline"
        >
          Open tasks
        </button>
      </div>
    </div>
  );
};
