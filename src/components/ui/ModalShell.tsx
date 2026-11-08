import React, { useEffect, useRef } from 'react';

// Every dialog in the app goes through this shell so they all behave the same way:
// role="dialog" + aria-modal, a name for screen readers, Escape closes the top-most dialog,
// Tab stays inside, focus moves in on open and goes back to what opened it on close.

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

// Dialogs can stack (e.g. "new project" inside the logger); only the last one handles Escape.
const openDialogs: symbol[] = [];

interface ModalShellProps {
  onClose: () => void;
  /** Accessible name when the dialog has no visible heading. */
  label?: string;
  /** id of the visible heading, preferred over `label`. */
  labelledBy?: string;
  /** 'center' for dialogs, 'top' for the search palette. */
  align?: 'center' | 'top';
  /** Click on the dimmed backdrop closes. Off for dialogs that hold unsaved work. */
  closeOnBackdrop?: boolean;
  /** Classes for the backdrop (padding, scrolling). Colour is set by the shell. */
  backdropClassName?: string;
  /** Classes for the dialog panel. */
  className?: string;
  children: React.ReactNode;
}

export const ModalShell: React.FC<ModalShellProps> = ({
  onClose,
  label,
  labelledBy,
  align = 'center',
  closeOnBackdrop = false,
  backdropClassName = 'p-4 sm:p-6',
  className = '',
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const token = Symbol('dialog');
    openDialogs.push(token);
    const opener = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) {
      const preferred = panel.querySelector<HTMLElement>('[data-autofocus]');
      (preferred ?? panel).focus({ preventScroll: true });
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (openDialogs[openDialogs.length - 1] !== token) return;
      e.preventDefault();
      onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      const i = openDialogs.indexOf(token);
      if (i >= 0) openDialogs.splice(i, 1);
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  const handlePanelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement
    );
    if (items.length === 0) {
      e.preventDefault();
      panel.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panel)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // Close only when the press started AND ended on the backdrop, so selecting text and
  // releasing outside the panel does not dismiss the dialog.
  const pressedOnBackdrop = useRef(false);

  return (
    <div
      className={`fade-in fixed inset-0 z-50 flex justify-center bg-black/60 ${
        align === 'top' ? 'items-start' : 'items-center'
      } ${backdropClassName}`}
      onMouseDown={(e) => {
        pressedOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (closeOnBackdrop && pressedOnBackdrop.current && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onKeyDown={handlePanelKeyDown}
        className={`rise-in ${className}`}
      >
        {children}
      </div>
    </div>
  );
};
