import { describe, it, expect } from 'vitest';
import { parseLogCommand } from './logCommand';

describe('parseLogCommand (B15)', () => {
  it('keeps an unquoted multi-word message', () => {
    expect(parseLogCommand('log -m fixed the bug')).toMatchObject({ description: 'fixed the bug', status: 'completed' });
  });
  it('handles a quoted message with project, status and time', () => {
    expect(parseLogCommand('log -m "fixed the bug" -p "Core Platform" -s blocked -t 45')).toEqual({
      description: 'fixed the bug',
      project: 'Core Platform',
      status: 'blocked',
      minutes: 45,
    });
  });
  it('an unquoted message stops at the next flag', () => {
    expect(parseLogCommand('log -m fixed the bug -s in_progress')).toMatchObject({
      description: 'fixed the bug',
      status: 'in_progress',
    });
  });
  it('flag-like text inside quotes stays in the message', () => {
    const r = parseLogCommand('log -m "no -s blocked here"');
    expect(r.description).toBe('no -s blocked here');
    expect(r.status).toBe('completed');
  });
  it('without -m, the non-flag words are the message (not the raw command)', () => {
    expect(parseLogCommand('log wrote the report -t 30')).toMatchObject({ description: 'wrote the report', minutes: 30 });
  });
  it('the log prefix is case-insensitive', () => {
    expect(parseLogCommand('LOG -m Hello').description).toBe('Hello');
  });
  it('plain text is the message', () => {
    expect(parseLogCommand('  just a note  ')).toEqual({ description: 'just a note', status: 'completed' });
  });
  it('ignores a bad or zero -t value', () => {
    expect(parseLogCommand('log -m x -t abc').minutes).toBeUndefined();
    expect(parseLogCommand('log -m x -t 0').minutes).toBeUndefined();
  });
  it('a bare "log" has an empty description', () => {
    expect(parseLogCommand('log').description).toBe('');
  });
});
