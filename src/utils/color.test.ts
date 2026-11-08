import { describe, expect, it } from 'vitest';
import { readableOn, relativeLuminance } from './color';

describe('readableOn', () => {
  it('uses black on light and mid colours, white on dark ones', () => {
    expect(readableOn('#10b981')).toBe('#000000'); // emerald-500 (seed project colour)
    expect(readableOn('#06b6d4')).toBe('#000000'); // cyan-500
    expect(readableOn('#f59e0b')).toBe('#000000'); // amber-500
    expect(readableOn('#4338ca')).toBe('#ffffff'); // indigo-700
    expect(readableOn('#1e293b')).toBe('#ffffff');
    expect(readableOn('#ffffff')).toBe('#000000');
    expect(readableOn('#000000')).toBe('#ffffff');
  });

  it('accepts short hex and falls back to white for anything else', () => {
    expect(readableOn('#fff')).toBe('#000000');
    expect(readableOn('rebeccapurple')).toBe('#ffffff');
    expect(readableOn('')).toBe('#ffffff');
  });
});

describe('relativeLuminance', () => {
  it('matches the WCAG endpoints', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
    expect(relativeLuminance('nope')).toBeNull();
  });
});
