// Splits tracked seconds into zero-padded parts for a digital clock: 00 : 14 : 22.
export function clockParts(seconds: number = 0): [string, string, string] {
  const s = Math.max(0, Math.floor(seconds));
  const pad = (n: number) => String(n).padStart(2, '0');
  return [pad(Math.floor(s / 3600)), pad(Math.floor((s % 3600) / 60)), pad(s % 60)];
}
