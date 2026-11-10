import React, { useId } from 'react';
import type { BacklogTask } from '../../../types';

export const plural = (n: number) => `${n} ${n === 1 ? 'task' : 'tasks'}`;

const TEXT_BTN =
  'shrink-0 min-h-8 pointer-coarse:min-h-11 px-1 normal-case tracking-normal text-[length:var(--fs-small)] font-semibold text-[var(--accent-text)] underline underline-offset-4 cursor-pointer';

/** "Move all to today" for one date group. The date is added for screen readers, so each button has its own name. */
const MoveAll: React.FC<{ heading: string; onClick(): void }> = ({ heading, onClick }) => (
  <button type="button" onClick={onClick} className={TEXT_BTN}>
    Move all to today
    <span className="sr-only"> from {heading}</span>
  </button>
);

interface GroupProps {
  /** Output of `dayHeading`: Yesterday, Mon 9 Nov. */
  heading: string;
  tasks: BacklogTask[];
  onMoveAll(ids: string[]): void;
  children: React.ReactNode;
}

/** A date group of earlier tasks as a section of its own (Tasks screen): section heading, then a panel of rows. */
export const EarlierSection: React.FC<GroupProps> = ({ heading, tasks, onMoveAll, children }) => {
  const id = useId();
  return (
    <section aria-labelledby={`${id}-h`}>
      <div className="v2-head v2-head-split">
        <h2 id={`${id}-h`} className="v2-head-group">
          <span>{heading}</span>
          <span className="v2-head-meta num">{plural(tasks.length)}</span>
        </h2>
        <MoveAll heading={heading} onClick={() => onMoveAll(tasks.map((t) => t.id))} />
      </div>
      <div className="v2-panel">{children}</div>
    </section>
  );
};

/** A date group inside a card (Today screen): a small subheading with the count and the move button, then the rows. */
export const EarlierBlock: React.FC<GroupProps> = ({ heading, tasks, onMoveAll, children }) => (
  <div>
    <div className="v2-inset flex flex-wrap items-center gap-x-3 pt-3 pb-1">
      <h4 className="text-[length:var(--fs-small)] font-bold text-[var(--text-muted)]">{heading}</h4>
      <span className="num text-[length:var(--fs-small)] text-[var(--text-muted)]">{plural(tasks.length)}</span>
      <span className="ml-auto">
        <MoveAll heading={heading} onClick={() => onMoveAll(tasks.map((t) => t.id))} />
      </span>
    </div>
    {children}
  </div>
);
