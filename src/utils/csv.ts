// CSV export helpers (B16). Every field is escaped the same way, so a quote, comma or newline in a
// project name, link or description can no longer shift columns in Excel.

export function csvField(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: unknown[][]): string {
  // BOM first so Excel opens the file as UTF-8 instead of mangling non-English text.
  return '﻿' + rows.map((r) => r.map(csvField).join(',')).join('\n') + '\n';
}
