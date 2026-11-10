// The three themes and the mapping from the four old ones.
import type { ThemeId } from '../types';

export type { ThemeId };

export const THEMES: { id: ThemeId; name: string; blurb: string; dark: boolean }[] = [
  { id: 'chase', name: 'The Chase', blurb: 'Pitch green scoreboard band over a light chalk page.', dark: false },
  { id: 'timecard', name: 'Time Card', blurb: 'A punch-clock card: manila, black stamped figures, red for the leave mark.', dark: false },
  { id: 'console', name: 'Graphite Console', blurb: 'Dark graphite panels with hairline seams; colour only means state.', dark: true },
];

const FROM_OLD: Record<string, ThemeId> = {
  chase: 'chase',
  timecard: 'timecard',
  console: 'console',
  modern: 'chase',
  compact: 'chase',
  minimalist: 'timecard',
  matrix: 'console',
};

/** Any stored theme value (old, new or junk) to one of the three v2 themes. */
export function normalizeTheme(v: unknown): ThemeId {
  return (typeof v === 'string' && Object.prototype.hasOwnProperty.call(FROM_OLD, v)) ? FROM_OLD[v] : 'chase';
}
