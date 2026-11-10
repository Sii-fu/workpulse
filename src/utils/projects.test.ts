import { describe, it, expect } from 'vitest';
import { splitProjectTag } from './projects';
import type { Project } from '../types';

const p = (id: string, name: string, isArchived = false): Project => ({ id, name, color: '#000000', isArchived });
const projects = [p('a', 'BGB Portal'), p('b', 'HR Dashboard'), p('c', 'Old thing', true), p('d', 'Hr tools')];

describe('splitProjectTag', () => {
  it('returns the text untouched when there is no trailing #word', () => {
    expect(splitProjectTag('Fix the date filter', projects)).toEqual({ text: 'Fix the date filter' });
    expect(splitProjectTag('Review PR #212 today', projects)).toEqual({ text: 'Review PR #212 today' });
  });

  it('picks the first active project whose name starts with the tag, ignoring case and spaces', () => {
    expect(splitProjectTag('Fix the date filter #bgb', projects)).toEqual({ text: 'Fix the date filter', tag: 'bgb', project: projects[0] });
    expect(splitProjectTag('Fix it #BGBPor', projects).project?.id).toBe('a');
    expect(splitProjectTag('Leave table #hr', projects).project?.id).toBe('b');
  });

  it('skips archived projects', () => {
    expect(splitProjectTag('Clean up #old', projects)).toEqual({ text: 'Clean up #old', tag: 'old' });
  });

  it('keeps the text whole when nothing matches (it may be "PR #212"), and reports the tag', () => {
    expect(splitProjectTag('Write docs #nope', projects)).toEqual({ text: 'Write docs #nope', tag: 'nope' });
    expect(splitProjectTag('Review PR #212', projects)).toEqual({ text: 'Review PR #212', tag: '212' });
  });

  it('ignores trailing spaces and a tag on its own', () => {
    expect(splitProjectTag('Write docs #hr  ', projects).project?.id).toBe('b');
    expect(splitProjectTag('#hr', projects)).toEqual({ text: '', tag: 'hr', project: projects[1] });
  });
});
