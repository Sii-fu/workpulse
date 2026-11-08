import React from 'react';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { TaskStatus } from '../../types';
import { STATUS_META } from '../../utils/logStatus';

const ICONS = { completed: CheckCircle2, in_progress: Clock, blocked: AlertCircle } as const;
const TONE = { success: 'text-success', info: 'text-info', danger: 'text-danger' } as const;

interface StatusBadgeProps {
  status: TaskStatus;
  /** icon + label (Modern), plain label (Minimalist), [SHORT] (Compact, Matrix) */
  variant?: 'icon' | 'text' | 'bracket';
}

// A log's status as text, never colour alone: the label is always there.
export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, variant = 'icon' }) => {
  const meta = STATUS_META[status];
  const tone = TONE[meta.tone];
  if (variant === 'bracket') {
    return <span className={`${tone} font-bold text-[10px]`}>[{meta.short}]</span>;
  }
  if (variant === 'text') {
    return <span>{meta.label}</span>;
  }
  const Icon = ICONS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${tone}`}>
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      <span>{meta.label}</span>
    </span>
  );
};
