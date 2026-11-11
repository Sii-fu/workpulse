import { minutesFromSeconds } from './duration';

// Pure grouping/merging for the EOD synthesizer (server.ts and tests). Tasks are grouped by
// project x status; AI text is merged per group, and any group the AI skipped gets template text.

export type EodStatus = 'completed' | 'in_progress' | 'blocked';

export interface EodProject {
  id: string;
  name: string;
  color: string;
}

export interface SplitBucket {
  splitId: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  status: EodStatus;
  tasks: any[];
  totalElapsedSeconds: number;
}

export interface SynthLog {
  id: string;
  splitId: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  status: EodStatus;
  durationMinutes: number;
  summaryBullets: string;
  tags: string[];
  taskIds: string[];
  underlyingTasks: { id: string; title: string; stage: string; elapsedSeconds: number }[];
  source: 'ai' | 'template';
}

export function buildBuckets(tasks: any[], projects: EodProject[]): SplitBucket[] {
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const grouped = new Map<string, any[]>();
  tasks.forEach((t) => {
    const pId = t.projectId || 'general';
    if (!grouped.has(pId)) grouped.set(pId, []);
    grouped.get(pId)!.push(t);
  });

  const buckets: SplitBucket[] = [];
  for (const [pId, pTasks] of grouped) {
    const project = projectMap.get(pId) || { id: pId, name: 'General Initiative', color: '#6366f1' };
    const done: any[] = [];
    const blocked: any[] = [];
    const active: any[] = [];
    pTasks.forEach((t) => {
      const stage = t.stage || (t.completed ? 'done' : 'planned');
      // A planned task is only skipped when it has no tracked time (same rule as the client).
      if (stage === 'planned' && !t.completed && !(t.elapsedSeconds > 0)) return;
      if (stage === 'blocked') blocked.push(t);
      else if (stage === 'done' || t.completed) done.push(t);
      else active.push(t);
    });
    const add = (status: EodStatus, list: any[]) => {
      if (list.length === 0) return;
      buckets.push({
        splitId: `${pId}_${status}`,
        projectId: pId,
        projectName: project.name,
        projectColor: project.color,
        status,
        tasks: list,
        totalElapsedSeconds: list.reduce((acc, t) => acc + (t.elapsedSeconds || 0), 0),
      });
    };
    add('completed', done);
    add('blocked', blocked);
    add('in_progress', active);
  }
  return buckets;
}

// Minutes for a group come only from tracked time (B12).
export function bucketMinutes(b: SplitBucket): number {
  return minutesFromSeconds(b.totalElapsedSeconds);
}

function templateBullets(b: SplitBucket): string {
  const titles = b.tasks.map((t) => t.title).join(', ');
  if (b.status === 'completed') {
    return `• Completed deliverables: Successfully finalized and delivered ${titles}.`;
  }
  if (b.status === 'blocked') {
    return b.tasks
      .map((t) => {
        const reason = t.blockReason ? ` (Blocker: ${t.blockReason})` : '';
        return `• Roadblock encountered: Progress halted on ${t.title}${reason}.`;
      })
      .join('\n');
  }
  return `• Active focus: Currently advancing engineering implementation for ${titles}.`;
}

function toLog(b: SplitBucket, text: string, minutes: number, tags: string[], source: 'ai' | 'template'): SynthLog {
  return {
    id: b.splitId,
    splitId: b.splitId,
    projectId: b.projectId,
    projectName: b.projectName,
    projectColor: b.projectColor,
    status: b.status,
    durationMinutes: minutes,
    summaryBullets: text,
    tags,
    taskIds: b.tasks.map((t) => t.id),
    underlyingTasks: b.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      stage: t.stage || (t.completed ? 'done' : 'in_progress'),
      elapsedSeconds: t.elapsedSeconds || 0,
    })),
    source,
  };
}

const defaultTags = (b: SplitBucket) => [
  '#eod-synthesis',
  `#${b.projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
  `#${b.status}`,
];

export function templateLog(b: SplitBucket): SynthLog {
  return toLog(b, templateBullets(b), bucketMinutes(b), defaultTags(b), 'template');
}

// Every group gets exactly one log: the AI's text when it returned usable text for that group,
// otherwise the template. fallbackSplitIds lists the groups that fell back (B9).
export function mergeSynthesis(
  buckets: SplitBucket[],
  aiItems: unknown[],
): { logs: SynthLog[]; fallbackSplitIds: string[] } {
  const items = (Array.isArray(aiItems) ? aiItems : []).filter(
    (i): i is Record<string, any> => typeof i === 'object' && i !== null,
  );
  const fallbackSplitIds: string[] = [];
  const logs = buckets.map((b) => {
    const item =
      items.find((i) => i.splitId === b.splitId) ||
      items.find((i) => i.projectId === b.projectId && i.status === b.status);
    const text = typeof item?.summaryBullets === 'string' ? item.summaryBullets.trim() : '';
    if (!item || !text) {
      fallbackSplitIds.push(b.splitId);
      return templateLog(b);
    }
    // The AI's own duration estimate is ignored: durations must match tracked time.
    const minutes = bucketMinutes(b);
    const tags =
      Array.isArray(item.tags) && item.tags.length > 0 && item.tags.every((t: unknown) => typeof t === 'string')
        ? item.tags
        : defaultTags(b);
    return toLog(b, text, minutes, tags, 'ai');
  });
  return { logs, fallbackSplitIds };
}

// The prompt for both AI writers (Claude Code and Gemini), so the end-of-day text reads the same.
export function buildEodPrompt(date: string, buckets: SplitBucket[]): { systemInstruction: string; userPrompt: string } {
  const promptPayload = {
    date,
    groups: buckets.map((b) => ({
      splitId: b.splitId,
      projectId: b.projectId,
      projectName: b.projectName,
      status: b.status,
      totalElapsedSeconds: b.totalElapsedSeconds,
      tasks: b.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        stage: t.stage || (t.completed ? 'done' : 'in_progress'),
        elapsedSeconds: t.elapsedSeconds || 0,
        blockReason: t.blockReason || null,
      })),
    })),
  };

  const systemInstruction = `You are a Principal Engineering Staff Architect and executive work log synthesizer.
Your mission is to take daily task records split by Project AND Status (Completed, Blocked, In Progress) and synthesize distinct, executive-ready timesheet entries for each group.

CRITICAL ARCHITECTURAL RULES (ABSOLUTE REQUIREMENTS):
1. STATUS SEPARATION: Maintain separate log entries for each split group (do NOT merge completed items with blocked or in-progress items).
2. NO RAW DUMPS: NEVER output a raw list of task titles.
3. NO COMPLETION TAGS: NEVER prefix items with '[COMPLETED]', '[IN PROGRESS]', '[BLOCKED]', or '[PLANNED]'.
4. NARRATIVE SYNTHESIS (1-3 bullets per group):
   - For 'completed' groups: Highlight concrete features shipped, bugs resolved, or technical milestones delivered using strong action verbs (e.g., "• Finalized client report schema, resolving token expiration race conditions across user onboarding.")
   - For 'blocked' groups: Concisely articulate the external blocker, dependency, or decision gate (e.g., "• Halted database migration pending upstream API credentials from DevOps.")
   - For 'in_progress' groups: Summarize the active development milestone, technical investigation, or next steps (e.g., "• Advancing performance profiling on client-side state hydration to eliminate initial paint latency.")
5. Each bullet point MUST start with "• ".
6. Duration is computed by the app from tracked time. Set durationMinutes to round(totalElapsedSeconds / 60); do not estimate.
7. Suggest 2-3 relevant tags (e.g., #deep-work, #backend, #infra, #frontend).

You MUST respond strictly with valid JSON conforming to this schema (no markdown formatting or wrappers outside JSON):
{
  "synthesized": [
    {
      "splitId": "string",
      "projectId": "string",
      "projectName": "string",
      "status": "completed" | "in_progress" | "blocked",
      "durationMinutes": number,
      "summaryBullets": "string (bullet points separated by \\n, each starting with •)",
      "tags": ["#tag1", "#tag2"]
    }
  ]
}`;

  const userPrompt = `Synthesize the following project-status split groups into executive work logs for date: ${date}.\n\nSplit Groups Data:\n${JSON.stringify(promptPayload, null, 2)}\n\nSynthesize distinct executive entries for each split group now. Remember: NO raw task titles with [COMPLETED] tags.`;
  return { systemInstruction, userPrompt };
}

/** The body for /api/synthesize-eod. The Gemini key goes along only when Gemini is the writer. */
export function eodRequestBody(
  ai: 'claude' | 'gemini',
  tasks: unknown[],
  projects: unknown[],
  date: string,
  customApiKey?: string,
) {
  return { tasks, projects, date, provider: ai, customApiKey: ai === 'gemini' ? customApiKey || undefined : undefined };
}

// The shape Claude Code must answer with (the CLI checks its answer against this schema).
export const EOD_SCHEMA = {
  type: 'object',
  properties: {
    synthesized: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          splitId: { type: 'string' },
          projectId: { type: 'string' },
          projectName: { type: 'string' },
          status: { type: 'string', enum: ['completed', 'in_progress', 'blocked'] },
          durationMinutes: { type: 'number' },
          summaryBullets: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['splitId', 'projectId', 'status', 'summaryBullets'],
      },
    },
  },
  required: ['synthesized'],
};
