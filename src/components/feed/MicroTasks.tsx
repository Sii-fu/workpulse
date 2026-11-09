import React from 'react';
import { WorkLog } from '../../types';

// The tasks an end-of-day log was synthesized from, as a native disclosure (keyboard and
// screen reader support for free). Shared by every theme's timeline.
export const MicroTasks: React.FC<{ tasks: NonNullable<WorkLog['underlyingTasks']>; dense?: boolean }> = ({ tasks, dense }) => {
  if (tasks.length === 0) return null;
  return (
    <details className={`${dense ? 'text-xs' : 'text-xs'} text-[var(--text-muted)] pt-1`}>
      <summary className="cursor-pointer hover:underline text-[var(--accent-text)] font-semibold py-1">
        View Underlying Micro-Tasks ({tasks.length})
      </summary>
      <ul className="mt-1.5 space-y-1 pl-3 border-l border-[var(--border-control)]">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 min-w-0">
              <span className="font-mono uppercase text-xs shrink-0">{t.stage}</span>
              <span className="truncate text-[var(--text-main)]">{t.title}</span>
            </span>
            {t.elapsedSeconds > 0 && (
              <span className="font-mono tabular-nums shrink-0">{Math.floor(t.elapsedSeconds / 60)}m</span>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
};
