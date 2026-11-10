import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project, WorkLog } from '../types';
import { logsToCsv, logsToMarkdown } from './exportLogs';

process.env.TZ = 'Asia/Dhaka';

const projects: Project[] = [
  { id: 'p1', name: 'Acme', color: '#2563eb' } as Project,
  { id: 'p2', name: 'Beta', color: '#16a34a' } as Project,
];

// Newest first, as the app stores them; the Markdown puts the older day first.
const logs: WorkLog[] = [
  {
    id: 'log-a-1731225600000',
    date: '2026-11-10',
    time: '14:00',
    projectId: 'p1',
    projectName: 'Acme',
    description: 'Fix login, then "polish"',
    status: 'completed',
    tags: ['auth', 'ui'],
    linkUrl: 'https://x.test/pr/1',
    durationMinutes: 90,
    energyRating: 4,
    createdAt: '2026-11-10T08:00:00.000Z',
  },
  {
    id: 'log-b-1731139200000',
    date: '2026-11-09',
    time: '09:30',
    projectId: 'p2',
    projectName: 'Beta',
    description: 'Plan sprint',
    status: 'blocked',
    tags: [],
    durationMinutes: 30,
    createdAt: '2026-11-09T03:30:00.000Z',
  },
];

describe('logsToCsv', () => {
  it('writes the Settings CSV columns, escaping a comma and a quote', () => {
    expect(logsToCsv(logs)).toBe(
      '﻿' +
        'ID,Date,Time,Project,Description,Status,Tags,Link,Duration_Mins,Energy_Rating\n' +
        'log-a-1731225600000,2026-11-10,14:00,Acme,"Fix login, then ""polish""",completed,auth ui,https://x.test/pr/1,90,4\n' +
        'log-b-1731139200000,2026-11-09,09:30,Beta,Plan sprint,blocked,,,30,0\n',
    );
  });

  it('writes only the header for no logs', () => {
    expect(logsToCsv([])).toBe('﻿ID,Date,Time,Project,Description,Status,Tags,Link,Duration_Mins,Energy_Rating\n');
  });
});

describe('logsToMarkdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T12:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('keeps the Analytics summary and groups the work log by date, then project, with minutes', () => {
    const generated = new Date().toLocaleDateString();
    expect(logsToMarkdown(logs, projects)).toBe(
      `# WorkPulse Timesheet & Activity Summary\n` +
        `*Period: 2026-11-09 to 2026-11-10 (Generated: ${generated})*\n\n` +
        `## High-Level Metrics\n` +
        `- **Total Time Logged:** 2.0 hours\n` +
        `- **Tasks Completed:** 1\n` +
        `- **Tasks In Progress:** 0\n` +
        `- **Tasks Blocked:** 1\n\n` +
        `## Project Breakdown\n` +
        `| Project | Tasks | Hours | Share |\n` +
        `| :--- | :--- | :--- | :--- |\n` +
        `| Acme | 1 | 1.5h | 75% |\n` +
        `| Beta | 1 | 0.5h | 25% |\n\n` +
        `## Detailed Work Log\n` +
        `### 2026-11-09\n` +
        `- 🛑 **[Beta]** Plan sprint (30m) — *2026-11-09*\n\n` +
        `### 2026-11-10\n` +
        `- ✅ **[Acme]** Fix login, then "polish" (90m) — *2026-11-10*\n`,
    );
  });

  it('orders a day by project, then time, and leaves out a missing duration', () => {
    const day: WorkLog[] = [
      { ...logs[1], id: 'z', date: '2026-11-10', time: '16:00', status: 'in_progress', durationMinutes: undefined },
      { ...logs[0], id: 'y', time: '15:00' },
      { ...logs[0], id: 'x', time: '08:00', description: 'Early' },
    ];
    const md = logsToMarkdown(day, projects);
    expect(md).toContain(`*Period: 2026-11-10 (Generated:`);
    expect(md.split('## Detailed Work Log\n')[1]).toBe(
      `### 2026-11-10\n` +
        `- ✅ **[Acme]** Early (90m) — *2026-11-10*\n` +
        `- ✅ **[Acme]** Fix login, then "polish" (90m) — *2026-11-10*\n` +
        `- ⏳ **[Beta]** Plan sprint — *2026-11-10*\n`,
    );
  });
});
