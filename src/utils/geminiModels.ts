// One model list for every Gemini call (C1). The first model that answers wins.
export const GEMINI_MODEL_CASCADE = [
  'gemini-3.5-flash', // primary
  'gemini-3.8-flash', // latest release
  'gemini-3.1-flash-lite', // fast fallback
  'gemini-2.5-flash', // safety net
];

// Per-request limit. The request is cancelled with an AbortSignal, not just ignored.
export const GEMINI_TIMEOUT_MS = 18000;

// "gemini-3.5-flash" -> "Gemini 3.5 Flash"
export function modelLabel(id?: string): string {
  if (!id) return 'Gemini';
  return id
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}
