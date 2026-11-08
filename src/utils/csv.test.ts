import { describe, it, expect } from 'vitest';
import { csvField, toCsv } from './csv';

describe('csvField', () => {
  it('leaves plain values alone', () => {
    expect(csvField('abc')).toBe('abc');
    expect(csvField(42)).toBe('42');
  });
  it('quotes and doubles quotes (B16)', () => {
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
  });
  it('quotes values with commas or newlines', () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('a\nb')).toBe('"a\nb"');
  });
  it('treats null and undefined as empty', () => {
    expect(csvField(null)).toBe('');
    expect(csvField(undefined)).toBe('');
  });
});

describe('toCsv', () => {
  it('a quote in the project name or link keeps the column count', () => {
    const csv = toCsv([['id', 'project', 'link'], ['1', 'Acme "Pro", Inc', 'http://x/?a="1"']]);
    const body = csv.replace('﻿', '').trim().split('\n');
    expect(body[1]).toBe('1,"Acme ""Pro"", Inc","http://x/?a=""1"""');
  });
  it('starts with a BOM for Excel', () => {
    expect(toCsv([['a']]).charCodeAt(0)).toBe(0xfeff);
  });
});
