import { describe, it, expect } from 'vitest';
import { isAllowedHostHeader, isAllowedOrigin, isStrictLocalHost } from './hostCheck';

describe('isAllowedHostHeader', () => {
  it.each(['localhost:3000', 'localhost', '127.0.0.1:3055', '[::1]:3000', 'LOCALHOST:3000'])('allows %s', (h) => {
    expect(isAllowedHostHeader(h)).toBe(true);
  });
  it.each(['evil.com', 'evil.com:3000', 'localhost.evil.com', '127.0.0.1.evil.com', '192.168.1.5:3000', '', undefined])(
    'rejects %s',
    (h) => {
      expect(isAllowedHostHeader(h as any)).toBe(false);
    },
  );
  it('allows extra configured hosts', () => {
    expect(isAllowedHostHeader('my-pc.lan:3000', ['my-pc.lan'])).toBe(true);
  });
});

describe('isAllowedOrigin', () => {
  it('allows a missing origin and local origins', () => {
    expect(isAllowedOrigin(undefined)).toBe(true);
    expect(isAllowedOrigin('http://localhost:3000')).toBe(true);
  });
  it('rejects foreign or malformed origins', () => {
    expect(isAllowedOrigin('https://evil.com')).toBe(false);
    expect(isAllowedOrigin('null')).toBe(false);
  });
});

describe('isStrictLocalHost', () => {
  it.each(['localhost:3000', '127.0.0.1:3000', 'LOCALHOST:3000'])('allows %s on port 3000', (h) => {
    expect(isStrictLocalHost(h, 3000)).toBe(true);
  });
  it.each(['evil.com:3000', 'localhost:3001', 'localhost', '127.0.0.1', 'localhost:3000.evil.com', '[::1]:3000', '', undefined])(
    'rejects %s on port 3000',
    (h) => {
      expect(isStrictLocalHost(h as any, 3000)).toBe(false);
    },
  );
  it('rejects a good host when the server port differs', () => {
    expect(isStrictLocalHost('localhost:3000', 4000)).toBe(false);
  });
});
