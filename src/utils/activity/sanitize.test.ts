import { describe, it, expect } from 'vitest';
import { redactSecrets, clip } from './sanitize';

describe('redactSecrets', () => {
  it('redacts Google API keys and GitHub tokens', () => {
    const key = 'AIzaSyA1234567890abcdefghijklmnopqrstuv9';
    const tok = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789';
    const out = redactSecrets(`key ${key} and token ${tok}`);
    expect(out).not.toContain(key);
    expect(out).not.toContain(tok);
    expect(out.match(/\[redacted\]/g)).toHaveLength(2);
  });
  it('redacts sk- keys, Bearer tokens and password assignments', () => {
    expect(redactSecrets('use sk-abcdefghijklmnopqrstuvwx now')).not.toContain('sk-abcdefghijklmnopqrstuvwx');
    expect(redactSecrets('Authorization: Bearer abc.def.ghi123')).not.toContain('abc.def.ghi123');
    expect(redactSecrets('password=hunter2 ok')).not.toContain('hunter2');
  });
  it('leaves ordinary text alone', () => {
    const text = 'Fixed the timer bug in TaskClock and added 3 tests';
    expect(redactSecrets(text)).toBe(text);
  });
});

describe('clip', () => {
  it('shortens to the limit and ends with an ellipsis', () => {
    const out = clip('a'.repeat(300), 200);
    expect(out).toHaveLength(200);
    expect(out.endsWith('…')).toBe(true);
  });
  it('returns short text unchanged', () => expect(clip('short', 200)).toBe('short'));
});

describe('redactSecrets: more kinds of secret', () => {
  it.each([
    ['AWS access key', 'id AKIAIOSFODNN7EXAMPLE here', 'AKIAIOSFODNN7EXAMPLE'],
    ['Slack token', 'use xoxb-123456789012-abcdefghijklmnop now', 'xoxb-123456789012-abcdefghijklmnop'],
    ['GitLab token', 'pat glpat-abcdefghij0123456789 ok', 'glpat-abcdefghij0123456789'],
    ['JWT', 'auth eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U end', 'eyJhbGciOiJIUzI1NiJ9'],
    ['spoken password', 'my password is hunter2 ok', 'hunter2'],
    ['spoken token', 'the api key is abcd1234efgh ok', 'abcd1234efgh'],
  ])('redacts a %s', (_name, text, secret) => {
    const out = redactSecrets(text);
    expect(out).not.toContain(secret);
    expect(out).toContain('[redacted]');
  });
  it('redacts a private key block header line', () => {
    expect(redactSecrets('-----BEGIN RSA PRIVATE KEY----- MIIEow')).toContain('[redacted]');
  });
  it('still leaves ordinary sentences about passwords and tokens alone', () => {
    const text = 'Added password reset email and token refresh tests';
    expect(redactSecrets(text)).toBe(text);
  });
});
