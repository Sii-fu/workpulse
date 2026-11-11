import type { NextFunction, Request, Response } from 'express';
import { isLocalOnlyRequest } from './activityGuard';
import type { ClaudeRunResult } from './claudeCli';
import { buildEodPrompt, EOD_SCHEMA, mergeSynthesis } from '../utils/eodSynthesis';
import type { SplitBucket, SynthLog } from '../utils/eodSynthesis';

// Claude Code on this computer (the default) or Gemini writes the standup and end-of-day text.

export type AiWriter = 'claude' | 'gemini';

export const CLAUDE_MODEL_LABEL = 'Claude Code';

/** Claude unless the request asks for Gemini. */
export const writerFromRequest = (raw: unknown): AiWriter => (raw === 'gemini' ? 'gemini' : 'claude');

export const CLAUDE_LOCAL_ONLY_MESSAGE =
  'Claude only works on this computer, in the normal local setup. Showing the offline template instead.';

/** Claude runs a program on this computer, so it answers only the local setup. Gemini has no such limit. */
export function mayAnswer(writer: AiWriter, bindHost: string, hostHeader: string | undefined, port: number): boolean {
  return writer === 'gemini' || isLocalOnlyRequest(bindHost, hostHeader, port);
}

/** Express middleware: refuses a Claude request with 403 unless it is the local setup (see activityGuard). */
export function claudeWriterGuard(bindHost: string, port: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // 'none' means "no AI": the browser builds the text itself and must not call these routes.
    if (req.body?.provider === 'none') {
      res.status(400).json({ error: 'No AI writer was chosen for this request.' });
      return;
    }
    if (!mayAnswer(writerFromRequest(req.body?.provider), bindHost, req.headers.host, port)) {
      res.status(403).json({ error: CLAUDE_LOCAL_ONLY_MESSAGE });
      return;
    }
    next();
  };
}

export type ClaudeRunner = (opts: { prompt: string; schema: object }) => Promise<ClaudeRunResult>;

export const STANDUP_SCHEMA = {
  type: 'object',
  properties: { text: { type: 'string' } },
  required: ['text'],
};

const UNREADABLE = 'Claude Code gave an unreadable answer.';

export async function standupViaClaude(
  run: ClaudeRunner,
  prompt: string,
  systemInstruction: string,
): Promise<{ ok: true; text: string } | { ok: false; reason: string }> {
  const result = await run({ prompt: `${systemInstruction}\n\n${prompt}`, schema: STANDUP_SCHEMA });
  if (!result.ok) return { ok: false, reason: result.reason };
  const text = (result.data as { text?: unknown } | null)?.text;
  if (typeof text !== 'string' || !text.trim()) return { ok: false, reason: UNREADABLE };
  return { ok: true, text: text.trim() };
}

export async function eodViaClaude(
  run: ClaudeRunner,
  buckets: SplitBucket[],
  date: string,
): Promise<{ ok: true; logs: SynthLog[]; fallbackSplitIds: string[] } | { ok: false; reason: string }> {
  const { systemInstruction, userPrompt } = buildEodPrompt(date, buckets);
  const result = await run({ prompt: `${systemInstruction}\n\n${userPrompt}`, schema: EOD_SCHEMA });
  if (!result.ok) return { ok: false, reason: result.reason };
  const items = (result.data as { synthesized?: unknown } | null)?.synthesized;
  if (!Array.isArray(items)) return { ok: false, reason: UNREADABLE };
  const { logs, fallbackSplitIds } = mergeSynthesis(buckets, items);
  return { ok: true, logs, fallbackSplitIds };
}
