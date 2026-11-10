import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, MoreHorizontal } from 'lucide-react';
import { IconButton } from '../ui/IconButton';

export interface RowMenuItem {
  label: string;
  onSelect(): void;
  /** Drawn in the danger colour (Delete). */
  danger?: boolean;
}

interface RowMenuProps {
  /** What the menu belongs to, for screen readers: "Actions for Fix date filter". */
  label: string;
  items: RowMenuItem[];
  /** Shows a text button ("Export") instead of the ⋯ icon; `label` stays the accessible name. */
  buttonText?: string;
}

// The ⋯ menu at the end of a task or log row. Arrow keys move, Escape closes and returns focus
// to the button, a click outside closes.
export const RowMenu: React.FC<RowMenuProps> = ({ label, items, buttonText }) => {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  if (items.length === 0) return null;

  const close = () => {
    setOpen(false);
    wrapRef.current?.querySelector<HTMLButtonElement>('[aria-haspopup]')?.focus();
  };

  const onMenuKey = (e: React.KeyboardEvent) => {
    const list = itemRefs.current.filter(Boolean) as HTMLButtonElement[];
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      // Handled here so an enclosing dialog does not close as well.
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      list[(i + 1) % list.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      list[(i - 1 + list.length) % list.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      list[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      list[list.length - 1]?.focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative shrink-0">
      {buttonText ? (
        <button
          type="button"
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={() => setOpen((o) => !o)}
          className="v2-btn inline-flex items-center gap-1.5 min-h-11 px-3 cursor-pointer"
        >
          {buttonText}
          <ChevronDown className="w-4 h-4" aria-hidden="true" />
        </button>
      ) : (
        <IconButton
          label={label}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={() => setOpen((o) => !o)}
        >
          <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
        </IconButton>
      )}
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          className="absolute right-0 top-full mt-1 z-30 min-w-44 py-1 bg-[var(--bg-surface-elevated)] border border-[var(--border-control)] rounded-[var(--radius-btn)]"
        >
          {items.map((item, i) => (
            <button
              key={item.label}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={`block w-full text-left px-3 min-h-9 pointer-coarse:min-h-11 text-[length:var(--fs-small)] font-medium hover:bg-[var(--bg-subtle)] focus:bg-[var(--bg-subtle)] cursor-pointer ${
                item.danger ? 'text-danger' : 'text-[var(--text-main)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
