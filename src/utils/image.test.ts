import { describe, it, expect } from 'vitest';
import { fitWithin, dataUrlBytes } from './image';

describe('image helpers', () => {
  it('fitWithin scales large images down keeping aspect ratio', () => {
    expect(fitWithin(4000, 2000, 1280)).toEqual({ width: 1280, height: 640 });
    expect(fitWithin(2000, 4000, 1280)).toEqual({ width: 640, height: 1280 });
  });
  it('fitWithin never scales up', () => {
    expect(fitWithin(800, 600, 1280)).toEqual({ width: 800, height: 600 });
  });
  it('dataUrlBytes returns decoded size', () => {
    expect(dataUrlBytes('data:image/jpeg;base64,AAAA')).toBe(3);
    expect(dataUrlBytes('data:image/jpeg;base64,AAA=')).toBe(2);
  });
});
