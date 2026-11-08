// Wall-clock based timer maths (B1). Browsers throttle setInterval in hidden tabs (to about one
// call per minute), so counting "+1 per tick" under-counts. Instead each tick adds the real
// seconds that passed since the last tick.

// A gap longer than this is treated as the computer being asleep or the tab frozen: it is not
// counted as work (it would otherwise add phantom hours).
export const MAX_TICK_GAP_SECONDS = 120;

export function advanceClock(
  lastMs: number,
  nowMs: number,
  maxGapSeconds = MAX_TICK_GAP_SECONDS,
): { seconds: number; nextMs: number } {
  const delta = nowMs - lastMs;
  if (delta < 0 || delta > maxGapSeconds * 1000) return { seconds: 0, nextMs: nowMs };
  const seconds = Math.floor(delta / 1000);
  return { seconds, nextMs: lastMs + seconds * 1000 };
}
