import { Project, WorkLog, BacklogTask, AppSettings } from '../types';
import { localDateStr } from '../utils/dates';

export const INITIAL_PROJECTS: Project[] = [
  { id: 'proj-1', name: 'Core Platform & API', color: '#10b981', isArchived: false },
  { id: 'proj-2', name: 'Frontend & Design System', color: '#6366f1', isArchived: false },
  { id: 'proj-3', name: 'DevOps & Reliability', color: '#f59e0b', isArchived: false },
  { id: 'proj-4', name: 'Customer Integrations', color: '#06b6d4', isArchived: false },
];

export const INITIAL_TAGS: string[] = [
  '#bugfix',
  '#code-review',
  '#deep-work',
  '#meeting',
  '#infra',
  '#client',
  '#admin',
  '#architecture',
];

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'modern',
  colorMode: 'dark',
  googleScriptUrl: '',
  geminiApiKey: '',
  defaultTone: 'casual',
  crtEffect: false,
};

// Generates dynamic dates relative to today
export function getInitialSeedData(): {
  logs: WorkLog[];
  backlog: BacklogTask[];
  projects: Project[];
  tags: string[];
} {
  const today = new Date();
  const formatDate = (d: Date) => localDateStr(d);

  const todayStr = formatDate(today);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDate(yesterday);

  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const twoDaysAgoStr = formatDate(twoDaysAgo);

  const initialLogs: WorkLog[] = [
    {
      id: 'log-1',
      date: todayStr,
      time: '11:30',
      projectId: 'proj-1',
      projectName: 'Core Platform & API',
      description: 'Refactored auth token refresh middleware to avoid race condition during concurrent API calls. Added unit tests for edge-case expiration.',
      status: 'completed',
      tags: ['#bugfix', '#deep-work'],
      linkUrl: 'https://github.com/company/repo/pull/482',
      durationMinutes: 90,
      energyRating: 5,
      createdAt: new Date().toISOString(),
      isSynthesized: true,
      underlyingTasks: [
        { id: 'subtask-1', title: 'Trace async promise deadlock in token refresh flow', stage: 'done', elapsedSeconds: 2700 },
        { id: 'subtask-2', title: 'Add Jest unit tests for token expiration and retry jitter', stage: 'done', elapsedSeconds: 2100 },
        { id: 'subtask-3', title: 'Run load test on auth cluster with 500 concurrent workers', stage: 'done', elapsedSeconds: 600 }
      ],
    },
    {
      id: 'log-2',
      date: todayStr,
      time: '14:15',
      projectId: 'proj-2',
      projectName: 'Frontend & Design System',
      description: 'Review and merge PR #129: Multi-theme palette token migration. Verified accessibility contrast across dark and high-contrast modes.',
      status: 'completed',
      tags: ['#code-review'],
      linkUrl: 'https://github.com/company/repo/pull/129',
      durationMinutes: 45,
      energyRating: 4,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'log-3',
      date: todayStr,
      time: '16:00',
      projectId: 'proj-3',
      projectName: 'DevOps & Reliability',
      description: 'Investigating sporadic latency spikes on Redis cluster node 3. Paged devops team, waiting for cloud metrics retention export.',
      status: 'blocked',
      tags: ['#infra', '#bugfix'],
      linkUrl: 'https://datadog.com/incident/8831',
      durationMinutes: 60,
      energyRating: 3,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'log-4',
      date: yesterdayStr,
      time: '10:00',
      projectId: 'proj-1',
      projectName: 'Core Platform & API',
      description: 'Architecture sync on distributed event streaming with Kafka vs RabbitMQ for order fulfillment pipeline.',
      status: 'completed',
      tags: ['#architecture', '#meeting'],
      linkUrl: 'https://docs.google.com/document/d/1Xyz987',
      durationMinutes: 60,
      energyRating: 4,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'log-5',
      date: yesterdayStr,
      time: '15:30',
      projectId: 'proj-4',
      projectName: 'Customer Integrations',
      description: 'Drafting webhook retry policy specification for enterprise client onboarding. Setup sandbox testing environment.',
      status: 'in_progress',
      tags: ['#client', '#deep-work'],
      durationMinutes: 120,
      energyRating: 4,
      createdAt: new Date(Date.now() - 86400000 + 1000).toISOString(),
    },
    {
      id: 'log-6',
      date: twoDaysAgoStr,
      time: '17:00',
      projectId: 'proj-2',
      projectName: 'Frontend & Design System',
      description: 'Fixed keyboard navigation trap inside modal dialogs and improved screen reader ARIA labels.',
      status: 'completed',
      tags: ['#bugfix', '#deep-work'],
      linkUrl: 'https://github.com/company/repo/pull/470',
      durationMinutes: 75,
      energyRating: 4,
      createdAt: new Date(Date.now() - 172800000).toISOString(),
    },
  ];

  const initialBacklog: BacklogTask[] = [
    {
      id: 'task-1',
      title: 'Complete Redis failover rehearsal and runbook update',
      projectId: 'proj-3',
      dueDate: todayStr,
      completed: false,
      stage: 'in_progress',
      startedAt: new Date(Date.now() - 42 * 60000).toISOString(),
      originalDate: yesterdayStr,
      isRolledOver: true,
      elapsedSeconds: 2534, // 00:42:14
      isRunning: true,
    },
    {
      id: 'task-2',
      title: 'Review PR #489: Customer webhook signature verification',
      projectId: 'proj-4',
      dueDate: todayStr,
      completed: false,
      stage: 'planned',
      originalDate: todayStr,
      isRolledOver: false,
      elapsedSeconds: 0,
      isRunning: false,
    },
    {
      id: 'task-3',
      title: 'Draft RFC for database indexing on search query performance',
      projectId: 'proj-1',
      dueDate: todayStr,
      completed: false,
      stage: 'planned',
      originalDate: todayStr,
      isRolledOver: false,
      elapsedSeconds: 0,
      isRunning: false,
    },
    {
      id: 'task-4',
      title: 'Deploy staging environment with Postgres 16 replica',
      projectId: 'proj-3',
      dueDate: todayStr,
      completed: false,
      stage: 'blocked',
      blockReason: 'Awaiting cloud security VPC peering approval from SecOps',
      originalDate: todayStr,
      isRolledOver: false,
      elapsedSeconds: 1800, // 00:30:00
      isRunning: false,
    },
    {
      id: 'task-5',
      title: 'Refactor mobile navigation drawer swipe gestures',
      projectId: 'proj-2',
      dueDate: todayStr,
      completed: false,
      stage: 'paused',
      originalDate: todayStr,
      isRolledOver: false,
      elapsedSeconds: 1240, // 00:20:40
      isRunning: false,
    },
  ];

  return {
    logs: initialLogs,
    backlog: initialBacklog,
    projects: INITIAL_PROJECTS,
    tags: INITIAL_TAGS,
  };
}
