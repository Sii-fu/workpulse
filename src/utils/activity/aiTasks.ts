import { clip, redactSecrets } from './sanitize';
import type { ActivityItem, AiTask } from './types';

const PER_FOLDER_CAP = 40;
const ITEM_TEXT_MAX = 200;
const OTHER_TEXT = 'Other activity';

/** The shape the AI must answer with: { tasks: [{ text, itemIds[] }] }. */
export const ACTIVITY_TASKS_SCHEMA = {
  type: 'object',
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: { text: { type: 'string' }, itemIds: { type: 'array', items: { type: 'string' } } },
        required: ['text', 'itemIds'],
      },
    },
  },
  required: ['tasks'],
};

// Models sometimes leave the short ids in the sentence: "fixed the drift [i1] and ([i2]) tests".
const cleanText = (text: string): string =>
  text.replace(/\s*\(?\[i\d+\]\)?/g, '').replace(/\s+([.,;:])/g, '$1').replace(/\s{2,}/g, ' ').trim();

const baseName = (p: string): string => p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || p;

const SYSTEM_INSTRUCTION = `You turn a developer's raw activity for one day into short work-log entries.

You are given activity items, each with a short id in square brackets (like [i3]), grouped by project.
Group related items into tasks. For each task write one or two plain sentences in the past tense
(for example "Fixed the timer drift on the Tasks screen and added tests.").

RULES:
1. Refer to items ONLY by their short ids, in "itemIds". Never invent ids. Every item should be in one task.
2. Do NOT state any duration, time or number of minutes, and do NOT name or choose a project. The app works those out.
3. No markdown, no bullet characters, no raw commit hashes, no file contents.
4. Do not write the item ids in the text: ids belong only in "itemIds".

Respond with valid JSON only, in exactly this shape:
{ "tasks": [ { "text": "string", "itemIds": ["i1", "i2"] } ] }`;

/**
 * The prompt sent to Gemini. Each item is given a short id (i1, i2, ...) so the model can group
 * items without ever handling the real ids; `shortToId` maps them back. Text is redacted and
 * clipped again here as a safety net, and a folder contributes at most its 40 latest items.
 */
export function buildActivityPrompt(
  items: ActivityItem[],
  projectNameByFolder: Record<string, string>,
): { systemInstruction: string; userPrompt: string; shortToId: Record<string, string> } {
  const byFolder = new Map<string, ActivityItem[]>();
  for (const it of items) byFolder.set(it.folder, [...(byFolder.get(it.folder) ?? []), it]);

  // Cap each folder first (latest items win), then group folders that share a project name.
  const byProject = new Map<string, ActivityItem[]>();
  for (const [folder, list] of byFolder) {
    const kept = [...list].sort((a, b) => b.time.localeCompare(a.time)).slice(0, PER_FOLDER_CAP).reverse();
    const name = projectNameByFolder[folder] || baseName(folder);
    byProject.set(name, [...(byProject.get(name) ?? []), ...kept]);
  }

  const shortToId: Record<string, string> = {};
  let n = 0;
  const sections: string[] = [];
  for (const [name, list] of byProject) {
    const rows = [...list]
      .sort((a, b) => a.time.localeCompare(b.time))
      .map((it) => {
        const short = `i${++n}`;
        shortToId[short] = it.id;
        const kind = it.source === 'git' ? 'commit' : 'claude';
        return `[${short}] (${kind}) ${clip(redactSecrets(it.text), ITEM_TEXT_MAX)}`;
      });
    sections.push(`Project: ${name}\n${rows.join('\n')}`);
  }

  return {
    systemInstruction: SYSTEM_INSTRUCTION,
    userPrompt: `Group this activity into work-log tasks.\n\n${sections.join('\n\n')}`,
    shortToId,
  };
}

/**
 * Reads the model's answer defensively. Unknown ids are ignored, an id counts only in the first
 * task that cites it, tasks left without text or ids are dropped, and anything the model did not
 * place (or that was never sent) becomes one "Other activity" task, so nothing is silently lost.
 */
export function parseAiTasks(raw: unknown, shortToId: Record<string, string>, items: ActivityItem[]): AiTask[] {
  const known = new Set(items.map((i) => i.id));
  const used = new Set<string>();
  const tasks: AiTask[] = [];

  const list = (raw as { tasks?: unknown } | null)?.tasks;
  if (Array.isArray(list)) {
    for (const t of list) {
      const text = typeof t?.text === 'string' ? cleanText(t.text) : '';
      if (!text || !Array.isArray(t?.itemIds)) continue;
      const ids: string[] = [];
      for (const short of t.itemIds) {
        const real = typeof short === 'string' ? shortToId[short] : undefined;
        if (real && known.has(real) && !used.has(real)) {
          used.add(real);
          ids.push(real);
        }
      }
      if (ids.length > 0) tasks.push({ text, itemIds: ids });
    }
  }

  const leftover = items.filter((i) => !used.has(i.id)).map((i) => i.id);
  if (leftover.length > 0) tasks.push({ text: OTHER_TEXT, itemIds: leftover });
  return tasks;
}
