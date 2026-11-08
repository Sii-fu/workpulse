import React from 'react';
import { FileEdit } from 'lucide-react';
import { BacklogTask } from '../../types';
import { IconButton } from '../ui/IconButton';

interface LogDetailsButtonProps {
  task: BacklogTask;
  onLogWithDetails?: (task: BacklogTask) => void;
  /** icon (Modern, Minimalist), "DETAILS" (Compact) or "[DETAILS]" (Matrix) */
  variant?: 'icon' | 'text' | 'bracket';
}

// Opens the full log form filled in from this task: link, screenshot, tags, duration, date.
// The same control sits on every task card in every theme.
export const LogDetailsButton: React.FC<LogDetailsButtonProps> = ({ task, onLogWithDetails, variant = 'icon' }) => {
  if (!onLogWithDetails) return null;
  const label = `Log with details: ${task.title}`;
  if (variant === 'icon') {
    return (
      <IconButton label={label} hint="Log with details" onClick={() => onLogWithDetails(task)}>
        <FileEdit className="w-3.5 h-3.5" />
      </IconButton>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onLogWithDetails(task)}
      aria-label={label}
      title="Log with details"
      className={`cursor-pointer text-xs pointer-coarse:min-h-11 ${
        variant === 'text'
          ? 'px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] hover:text-[var(--accent-text)]'
          : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
      }`}
    >
      {variant === 'text' ? 'DETAILS' : '[DETAILS]'}
    </button>
  );
};
