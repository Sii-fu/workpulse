import { describe, it, expect } from 'vitest';
import { DEFAULT_EMAIL_TIME, parseEmailTime, ensureDeviceId, phoneLink } from './phoneSettings';
import { DEFAULT_SETTINGS } from '../data/seedData';

describe('parseEmailTime', () => {
  it('accepts HH:MM from 00:00 to 23:59', () => {
    expect(parseEmailTime('18:00')).toEqual({ hour: 18, minute: 0 });
    expect(parseEmailTime('07:05')).toEqual({ hour: 7, minute: 5 });
    expect(parseEmailTime('00:00')).toEqual({ hour: 0, minute: 0 });
    expect(parseEmailTime('23:59')).toEqual({ hour: 23, minute: 59 });
  });
  it('rejects anything else', () => {
    for (const bad of ['24:00', '7:5', '', '12:60', '1800', ' 18:00', 1800, null, undefined]) {
      expect(parseEmailTime(bad)).toBeNull();
    }
  });
  it('the default time is valid', () => {
    expect(DEFAULT_EMAIL_TIME).toBe('18:00');
    expect(parseEmailTime(DEFAULT_EMAIL_TIME)).not.toBeNull();
  });
});

describe('ensureDeviceId', () => {
  it('adds a dev- id once and keeps it stable', () => {
    const a = ensureDeviceId({ ...DEFAULT_SETTINGS });
    expect(a.phoneDeviceId).toMatch(/^dev-[A-Za-z0-9]{12}$/);
    const b = ensureDeviceId(a);
    expect(b).toBe(a);
  });
  it('does not change an existing id', () => {
    const s = { ...DEFAULT_SETTINGS, phoneDeviceId: 'dev-existing' };
    expect(ensureDeviceId(s)).toBe(s);
  });
  it('different settings get different ids', () => {
    expect(ensureDeviceId({ ...DEFAULT_SETTINGS }).phoneDeviceId).not.toBe(ensureDeviceId({ ...DEFAULT_SETTINGS }).phoneDeviceId);
  });
});

describe('phoneLink', () => {
  it('appends ?page=phone', () => {
    expect(phoneLink('https://script.google.com/macros/s/ABC/exec')).toBe('https://script.google.com/macros/s/ABC/exec?page=phone');
  });
  it('keeps existing query parameters', () => {
    expect(phoneLink('https://script.google.com/macros/s/ABC/exec?x=1')).toBe('https://script.google.com/macros/s/ABC/exec?x=1&page=phone');
  });
  it('returns null for anything that is not a script URL', () => {
    for (const bad of ['https://example.com', 'http://script.google.com/macros/s/ABC/exec', 'https://script.google.com/other', '', 'nope']) {
      expect(phoneLink(bad)).toBeNull();
    }
  });
});
