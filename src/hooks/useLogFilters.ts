import { useMemo, useState } from 'react';
import { WorkLog } from '../types';
import { localDateStr } from '../utils/dates';
import { LogFilters, NO_FILTERS, filterLogs, hasActiveFilters, tagsInUse } from '../utils/logFilter';

// Filter state plus the filtered list, so each theme's timeline only has to draw it.
export function useLogFilters(logs: WorkLog[]) {
  const [filters, setFilters] = useState<LogFilters>(NO_FILTERS);
  const visible = useMemo(() => filterLogs(logs, filters, localDateStr()), [logs, filters]);
  const tags = useMemo(() => tagsInUse(logs), [logs]);
  return {
    filters,
    setFilter: <K extends keyof LogFilters>(key: K, value: LogFilters[K]) =>
      setFilters((prev) => ({ ...prev, [key]: value })),
    reset: () => setFilters(NO_FILTERS),
    isFiltering: hasActiveFilters(filters),
    visible,
    tags,
  };
}
