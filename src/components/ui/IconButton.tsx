import React from 'react';

// An icon-only button. `label` is required: it becomes aria-label (what a screen reader says)
// and title (what a mouse user sees on hover), so the two can't drift apart.
// 32 px on a mouse, 44 px on a touch screen.

interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'title'> {
  label: string;
  /** Extra text for the tooltip only, e.g. a shortcut: "Search (Ctrl+K)". */
  hint?: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  label,
  hint,
  className = '',
  type = 'button',
  children,
  ...rest
}) => (
  <button
    type={type}
    aria-label={label}
    title={hint ?? label}
    className={`inline-flex items-center justify-center min-w-8 min-h-8 pointer-coarse:min-w-11 pointer-coarse:min-h-11 rounded-[var(--radius-btn)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    {...rest}
  >
    {children}
  </button>
);
