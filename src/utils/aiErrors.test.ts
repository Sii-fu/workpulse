import { describe, expect, it } from 'vitest';
import { plainAiMessage, plainSheetMessage } from './aiErrors';

describe('plainAiMessage', () => {
  it('says offline first', () => {
    expect(plainAiMessage('Failed to fetch', false)).toMatch(/offline/i);
  });
  it('explains a missing or rejected key and a usage limit', () => {
    expect(plainAiMessage('No Gemini API key provided. Please configure your key in Settings or set GEMINI_API_KEY.', true)).toMatch(/No Gemini key is set/);
    expect(plainAiMessage('[400] API_KEY_INVALID', true)).toMatch(/did not accept the key/);
    expect(plainAiMessage('429 RESOURCE_EXHAUSTED: quota', true)).toMatch(/usage limit/);
  });
  it('explains a server that cannot be reached', () => {
    expect(plainAiMessage('Failed to fetch', true)).toMatch(/could not reach its server/);
    expect(plainAiMessage('Could not reach the WorkPulse server.', true)).toMatch(/still running/);
  });
  it('passes other short messages through and shortens long ones', () => {
    expect(plainAiMessage('Model said no.', true)).toBe('Model said no.');
    expect(plainAiMessage('x'.repeat(300), true).length).toBeLessThanOrEqual(160);
    expect(plainAiMessage(undefined, true)).toBe('The AI did not answer.');
  });
});

describe('plainSheetMessage', () => {
  it('names the likely cause', () => {
    expect(plainSheetMessage('x', false)).toMatch(/offline/i);
    expect(plainSheetMessage('Failed to fetch', true)).toMatch(/could not reach/);
    expect(plainSheetMessage('HTTP 403', true)).toMatch(/refused/);
    expect(plainSheetMessage('', true)).toMatch(/did not accept/);
  });
});
