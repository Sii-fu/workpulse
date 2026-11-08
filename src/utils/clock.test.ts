import { describe, expect, it } from 'vitest';
import { clockParts } from './clock';

describe('clockParts', () => {
  it('pads hours, minutes and seconds', () => {
    expect(clockParts(0)).toEqual(['00', '00', '00']);
    expect(clockParts(862)).toEqual(['00', '14', '22']);
    expect(clockParts(3 * 3600 + 5 * 60 + 9)).toEqual(['03', '05', '09']);
  });
  it('ignores negative and missing values', () => {
    expect(clockParts(-5)).toEqual(['00', '00', '00']);
    expect(clockParts(undefined)).toEqual(['00', '00', '00']);
  });
});
