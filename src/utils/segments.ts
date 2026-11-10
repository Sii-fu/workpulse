import { BacklogTask, Project, WorkdayRecord } from '../types';

const SLOT_MS = 10 * 60_000;
const BALLS_PER_OVER = 6;
const UNASSIGNED_COLOR = '#8a8f98';

type Segment = { start: string; end?: string };

const hasOpenSegment = (segments: Segment[] | undefined): boolean => {
  const last = segments && segments[segments.length - 1];
  return !!last && last.end === undefined;
};

// Timer started: opens a segment unless one is already open.
export function startSegment(t: BacklogTask, nowIso: string): BacklogTask {
  if (hasOpenSegment(t.segments)) return t;
  return { ...t, segments: [...(t.segments ?? []), { start: nowIso }] };
}

// Timer stopped: closes the last open segment (no-op when none is open).
export function endSegment(t: BacklogTask, nowIso: string): BacklogTask {
  if (!t.segments || !hasOpenSegment(t.segments)) return t;
  const segments = t.segments.slice();
  segments[segments.length - 1] = { ...segments[segments.length - 1], end: nowIso };
  return { ...t, segments };
}

// A running task with no open segment (its clock ran before segments existed) gets one starting now.
export function ensureOpenSegment(t: BacklogTask, nowIso: string): BacklogTask {
  return hasOpenSegment(t.segments) ? t : startSegment(t, nowIso);
}

export type Ball =
  | { kind: 'empty' }
  | { kind: 'now' }
  | { kind: 'project'; color: string; projectName: string };

export interface Over {
  label: string; // local hour of the over's first slot, e.g. "09"
  balls: Ball[]; // always 6, one per 10 minutes
}

// The workday as "overs" of six 10-minute balls, from clock-in to the later of the leave time and now.
// A slot shows the project whose segments overlap it the longest; the slot holding `now` is `now`.
export function buildOvers(
  rec: WorkdayRecord,
  hours: number,
  tasks: BacklogTask[],
  projects: Project[],
  nowMs: number,
): Over[] {
  const startMs = Date.parse(rec.clockIn);
  const endMs = Math.max(startMs + hours * 3600_000, nowMs);
  const slotCount = Math.max(1, Math.ceil((endMs - startMs) / SLOT_MS));
  const overCount = Math.ceil(slotCount / BALLS_PER_OVER);
  const nowSlot = Math.floor((nowMs - startMs) / SLOT_MS);

  const spans: { projectId: string; from: number; to: number }[] = [];
  for (const t of tasks) {
    for (const s of t.segments ?? []) {
      const from = Date.parse(s.start);
      const to = s.end ? Date.parse(s.end) : nowMs;
      if (Number.isFinite(from) && Number.isFinite(to) && to > from) spans.push({ projectId: t.projectId, from, to });
    }
  }

  const slotBall = (slot: number): Ball => {
    if (slot === nowSlot) return { kind: 'now' };
    if (slot > nowSlot) return { kind: 'empty' };
    const slotStart = startMs + slot * SLOT_MS;
    const slotEnd = slotStart + SLOT_MS;
    const byProject = new Map<string, number>();
    for (const sp of spans) {
      const overlap = Math.min(sp.to, slotEnd) - Math.max(sp.from, slotStart);
      if (overlap > 0) byProject.set(sp.projectId, (byProject.get(sp.projectId) ?? 0) + overlap);
    }
    let bestId: string | null = null;
    let bestMs = 0;
    byProject.forEach((overlapMs, id) => {
      if (overlapMs > bestMs) {
        bestId = id;
        bestMs = overlapMs;
      }
    });
    if (bestId === null) return { kind: 'empty' };
    const project = projects.find((p) => p.id === bestId);
    return {
      kind: 'project',
      color: project?.color ?? UNASSIGNED_COLOR,
      projectName: project?.name ?? 'Unassigned',
    };
  };

  const overs: Over[] = [];
  for (let o = 0; o < overCount; o++) {
    const first = o * BALLS_PER_OVER;
    const label = String(new Date(startMs + first * SLOT_MS).getHours()).padStart(2, '0');
    overs.push({ label, balls: Array.from({ length: BALLS_PER_OVER }, (_, i) => slotBall(first + i)) });
  }
  return overs;
}
