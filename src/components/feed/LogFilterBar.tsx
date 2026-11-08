import React from 'react';
import { Search } from 'lucide-react';
import { Project } from '../../types';
import { DateRange } from '../../utils/dates';
import { LogFilters } from '../../utils/logFilter';

interface LogFilterBarProps {
  filters: LogFilters;
  setFilter: <K extends keyof LogFilters>(key: K, value: LogFilters[K]) => void;
  reset: () => void;
  isFiltering: boolean;
  projects: Project[];
  tags: string[];
  /** shown / total, so a narrowed list says how much it is hiding */
  shown: number;
  total: number;
  /** tighter rows and mono text for the Compact and Matrix themes */
  dense?: boolean;
}

const RANGES: { id: DateRange; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'all', label: 'All time' },
];

// Search, date range, project, status and tag filters for the log list. Uses theme tokens only,
// so the same markup reads correctly in all four themes.
export const LogFilterBar: React.FC<LogFilterBarProps> = ({
  filters,
  setFilter,
  reset,
  isFiltering,
  projects,
  tags,
  shown,
  total,
  dense = false,
}) => {
  const field = `bg-[var(--bg-subtle)] border border-[var(--border-control)] text-[var(--text-main)] rounded-[var(--radius-btn)] ${
    dense ? 'h-7 px-1.5 text-xs' : 'px-2.5 py-1 text-xs'
  } cursor-pointer`;
  const opt = 'bg-[var(--bg-surface)]';

  return (
    <div role="search" aria-label="Filter work logs" className="no-print space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            value={filters.query}
            onChange={(e) => setFilter('query', e.target.value)}
            aria-label="Search logs"
            placeholder="Search logs by keyword, project or tag"
            className={`w-full pl-8 pr-3 bg-[var(--bg-subtle)] border border-[var(--border-control)] rounded-[var(--radius-btn)] text-[var(--text-main)] ${
              dense ? 'h-7 text-xs' : 'py-1.5 text-xs sm:text-sm'
            }`}
          />
        </div>
        <div
          role="group"
          aria-label="Date range"
          className="flex items-center gap-0.5 p-0.5 rounded-[var(--radius-btn)] bg-[var(--bg-subtle)] border border-[var(--border-control)] text-xs shrink-0"
        >
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              aria-pressed={filters.range === r.id}
              onClick={() => setFilter('range', r.id)}
              className={`px-2.5 ${dense ? 'py-0.5 text-xs' : 'py-1'} flex-1 sm:flex-none rounded-[var(--radius-btn)] transition-colors cursor-pointer ${
                filters.range === r.id
                  ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] font-semibold shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select aria-label="Filter by project" value={filters.projectId} onChange={(e) => setFilter('projectId', e.target.value)} className={field}>
          <option value="all" className={opt}>All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id} className={opt}>{p.name}</option>
          ))}
        </select>
        <select aria-label="Filter by status" value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className={field}>
          <option value="all" className={opt}>All statuses</option>
          <option value="completed" className={opt}>Completed</option>
          <option value="in_progress" className={opt}>In progress</option>
          <option value="blocked" className={opt}>Blocked</option>
        </select>
        {tags.length > 0 && (
          <select aria-label="Filter by tag" value={filters.tag} onChange={(e) => setFilter('tag', e.target.value)} className={field}>
            <option value="all" className={opt}>All tags</option>
            {tags.map((t) => (
              <option key={t} value={t} className={opt}>{t}</option>
            ))}
          </select>
        )}
        {isFiltering && (
          <>
            <span className="text-[var(--text-muted)]" aria-live="polite">
              Showing {shown} of {total}
            </span>
            <button type="button" onClick={reset} className="text-[var(--accent-text)] hover:underline ml-auto font-medium cursor-pointer">
              Clear filters
            </button>
          </>
        )}
      </div>
    </div>
  );
};
