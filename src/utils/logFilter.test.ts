import { describe, expect, it } from 'vitest';
import { filterLogs, hasActiveFilters, NO_FILTERS, tagsInUse } from './logFilter';
import { WorkLog } from '../types';

const log = (over: Partial<WorkLog>): WorkLog => ({
  id: 'x',
  date: '2026-11-08',
  time: '10:00',
  projectId: 'p1',
  projectName: 'Core Platform',
  description: 'Fixed the cache race',
  status: 'completed',
  tags: ['#bugfix'],
  energyRating: 4,
  createdAt: '2026-11-08T04:00:00.000Z',
  ...over,
});

const logs = [
  log({ id: 'a' }),
  log({ id: 'b', date: '2026-11-01', projectId: 'p2', projectName: 'Frontend', description: 'Palette tokens', status: 'blocked', tags: ['#design'] }),
  log({ id: 'c', date: '2026-10-01', description: 'Old work', tags: [] }),
];
const ids = (l: WorkLog[]) => l.map((x) => x.id);
const TODAY = '2026-11-08';

describe('filterLogs', () => {
  it('shows everything with no filters', () => {
    expect(ids(filterLogs(logs, NO_FILTERS, TODAY))).toEqual(['a', 'b', 'c']);
  });
  it('searches description, project name and tags, ignoring case and padding', () => {
    expect(ids(filterLogs(logs, { ...NO_FILTERS, query: '  CACHE ' }, TODAY))).toEqual(['a']);
    expect(ids(filterLogs(logs, { ...NO_FILTERS, query: 'frontend' }, TODAY))).toEqual(['b']);
    expect(ids(filterLogs(logs, { ...NO_FILTERS, query: 'design' }, TODAY))).toEqual(['b']);
  });
  it('filters by project, status and tag together', () => {
    expect(ids(filterLogs(logs, { ...NO_FILTERS, projectId: 'p1' }, TODAY))).toEqual(['a', 'c']);
    expect(ids(filterLogs(logs, { ...NO_FILTERS, status: 'blocked' }, TODAY))).toEqual(['b']);
    expect(ids(filterLogs(logs, { ...NO_FILTERS, tag: '#bugfix', projectId: 'p1' }, TODAY))).toEqual(['a']);
  });
  it('filters by local date range', () => {
    expect(ids(filterLogs(logs, { ...NO_FILTERS, range: 'today' }, TODAY))).toEqual(['a']);
    expect(ids(filterLogs(logs, { ...NO_FILTERS, range: 'month' }, TODAY))).toEqual(['a', 'b']);
  });
});

describe('hasActiveFilters / tagsInUse', () => {
  it('reports whether anything narrows the list', () => {
    expect(hasActiveFilters(NO_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...NO_FILTERS, query: '   ' })).toBe(false);
    expect(hasActiveFilters({ ...NO_FILTERS, range: 'week' })).toBe(true);
  });
  it('lists each tag once, in first-seen order', () => {
    expect(tagsInUse(logs)).toEqual(['#bugfix', '#design']);
  });
});
