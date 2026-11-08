import { describe, it, expect } from 'vitest';
import { isAllowedScriptUrl } from './scriptUrl';

describe('isAllowedScriptUrl', () => {
  it('accepts a Google Apps Script web app URL', () => {
    expect(isAllowedScriptUrl('https://script.google.com/macros/s/ABC123/exec')).toBe(true);
  });
  it.each([
    'http://script.google.com/macros/s/x/exec',
    'https://script.google.com.evil.com/macros/s/x/exec',
    'https://evil.com/script.google.com/macros/s/x',
    'https://script.google.com/other',
    'https://script.google.com@evil.com/macros/s/x',
    'https://127.0.0.1:3000/api/health',
    'not a url',
    '',
  ])('rejects %s', (u) => {
    expect(isAllowedScriptUrl(u)).toBe(false);
  });
});
