import { TaskStatus } from '../types';

// How a log's status reads and which colour role it takes, in one place.
export const STATUS_META: Record<TaskStatus, { label: string; short: string; tone: 'success' | 'info' | 'danger' }> = {
  completed: { label: 'Completed', short: 'DONE', tone: 'success' },
  in_progress: { label: 'In Progress', short: 'IN_PROG', tone: 'info' },
  blocked: { label: 'Blocked', short: 'BLOCKED', tone: 'danger' },
};
