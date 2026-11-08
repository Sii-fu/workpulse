import { useEffect } from 'react';

// Id of a log's row in every theme's timeline.
export const logRowId = (logId: string) => `log-row-${logId}`;

/**
 * When the user picks a log in the search palette, scroll its row into view and flash it.
 * `reveal` clears any filter that could be hiding the row; the lookup waits one frame so the
 * row exists by then. `onDone` lets the app forget the id so the same log can be picked again.
 */
export function useFocusLog(focusLogId: string | null | undefined, reveal: () => void, onDone?: () => void) {
  useEffect(() => {
    if (!focusLogId) return;
    reveal();
    const frame = requestAnimationFrame(() => {
      const el = document.getElementById(logRowId(focusLogId));
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.focus({ preventScroll: true });
        el.classList.remove('log-flash');
        void el.offsetWidth; // restart the animation if it is already running
        el.classList.add('log-flash');
        window.setTimeout(() => el.classList.remove('log-flash'), 1800);
      }
      onDone?.();
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusLogId]);
}
