import React from 'react';
import { Search } from 'lucide-react';
import { IconButton } from '../ui/IconButton';
import { nextActionLabel, type NextAction } from '../../utils/nextAction';
import { NavTabs, type V2Tab } from './NavTabs';

interface NextActionButtonProps {
  next: NextAction;
  onClick(): void;
}

// The one primary action in the top bar (chooseNextAction picks it).
export const NextActionButton: React.FC<NextActionButtonProps> = ({ next, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="shrink-0 h-10 max-sm:h-11 px-4 lg:px-[18px] rounded-[var(--radius-btn)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--on-accent)] text-[length:var(--fs-body)] font-bold whitespace-nowrap cursor-pointer transition-colors"
  >
    {nextActionLabel(next)}
  </button>
);

interface AppHeaderProps {
  active: V2Tab;
  onTab(t: V2Tab): void;
  todayMinutes: number;
  openTasks: number;
  next: NextAction;
  onNext(): void;
  onSearch(): void;
  /** The ClockBand (row 2). */
  children: React.ReactNode;
}

// Sticky top: row 1 (60 px) is brand, tabs, search and the next action; row 2 is the clock band.
// Under 640 px the tabs move to BottomNav.
export const AppHeader: React.FC<AppHeaderProps> = ({
  active,
  onTab,
  todayMinutes,
  openTasks,
  next,
  onNext,
  onSearch,
  children,
}) => (
  <header className="v2-band sticky top-0 z-40 bg-[var(--band-bg)] text-[var(--band-ink)] [border-bottom:var(--band-edge)]">
    <div className="h-[60px] flex items-center gap-4 lg:gap-9 px-4 md:px-6 lg:px-8 border-b border-[var(--band-line)]">
      <span className="v2-brand shrink-0 font-[family-name:var(--font-display)] text-[length:var(--fs-body)] font-extrabold tracking-[0.02em]">
        WorkPulse
      </span>
      <div className="hidden sm:block min-w-0">
        <NavTabs active={active} onChange={onTab} todayMinutes={todayMinutes} openTasks={openTasks} />
      </div>
      <div className="ml-auto flex items-center gap-2 min-w-0">
        <IconButton label="Search" hint="Search (Ctrl+K)" onClick={onSearch} className="max-sm:min-w-11 max-sm:min-h-11">
          <Search size={18} aria-hidden="true" />
        </IconButton>
        <NextActionButton next={next} onClick={onNext} />
      </div>
    </div>
    {children}
  </header>
);
