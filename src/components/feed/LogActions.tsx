import React from 'react';
import { Copy, CopyCheck, Pencil, Trash2 } from 'lucide-react';
import { WorkLog } from '../../types';
import { IconButton } from '../ui/IconButton';

interface LogActionsProps {
  log: WorkLog;
  onCopyText: (text: string) => void;
  onEdit: (log: WorkLog) => void;
  onDuplicate: (log: WorkLog) => void;
  onDelete: (id: string) => void;
  /** icon buttons (Modern, Minimalist), "EDIT DUP DEL" (Compact), "[EDIT]" (Matrix) */
  variant?: 'icon' | 'text' | 'bracket';
  /** Hide until the row is hovered or focused. Always shown on touch screens. */
  revealOnHover?: boolean;
}

export const copyTextOf = (log: WorkLog) => `[${log.projectName}] ${log.description}`;

// Copy, edit, duplicate and delete for one log, identical in every theme.
export const LogActions: React.FC<LogActionsProps> = ({
  log,
  onCopyText,
  onEdit,
  onDuplicate,
  onDelete,
  variant = 'icon',
  revealOnHover = false,
}) => {
  const reveal = revealOnHover
    ? 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100 transition-opacity'
    : '';

  const actions = [
    { key: 'copy', label: 'Copy log text', title: 'Copy log to clipboard', short: 'COPY', bracket: '[COPY]', icon: Copy, run: () => onCopyText(copyTextOf(log)), danger: false },
    { key: 'dup', label: 'Duplicate log', title: 'Duplicate log', short: 'DUP', bracket: '[CLONE]', icon: CopyCheck, run: () => onDuplicate(log), danger: false },
    { key: 'edit', label: 'Edit log', title: 'Edit log', short: 'EDIT', bracket: '[EDIT]', icon: Pencil, run: () => onEdit(log), danger: false },
    { key: 'del', label: 'Delete log', title: 'Delete log', short: 'DEL', bracket: '[RM]', icon: Trash2, run: () => onDelete(log.id), danger: true },
  ];

  return (
    <div className={`no-print flex items-center ${variant === 'icon' ? 'gap-0.5' : 'gap-1'} ${reveal}`}>
      {actions.map((a) => {
        if (variant === 'icon') {
          const Icon = a.icon;
          return (
            <IconButton
              key={a.key}
              label={a.label}
              hint={a.title}
              onClick={a.run}
              className={a.danger ? 'hover:text-danger hover:bg-danger/10' : ''}
            >
              <Icon className="w-3.5 h-3.5" />
            </IconButton>
          );
        }
        return (
          <button
            key={a.key}
            type="button"
            onClick={a.run}
            aria-label={a.label}
            title={a.title}
            className={`cursor-pointer text-[10px] pointer-coarse:min-h-11 pointer-coarse:min-w-11 ${
              variant === 'text'
                ? `px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] ${a.danger ? 'hover:text-danger' : 'hover:text-[var(--accent-text)]'}`
                : `${a.danger ? 'hover:text-danger' : 'hover:text-[var(--text-main)]'}`
            }`}
          >
            {variant === 'text' ? a.short : a.bracket}
          </button>
        );
      })}
    </div>
  );
};
