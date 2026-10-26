import { describe, expect, it } from 'vitest';

import { isEmail, isHttpsOrEmpty, majorToMinor, parseRecipients } from '@/utils/validate';

describe('validators', () => {
  it('accepts plausible emails and refuses what is clearly not one', () => {
    expect(isEmail('ana@negocio.co')).toBe(true);
    expect(isEmail(' ana@negocio.co ')).toBe(true);
    expect(isEmail('ana@negocio')).toBe(false);
    expect(isEmail('ana negocio@x.co')).toBe(false);
    expect(isEmail('')).toBe(false);
  });

  it('only lets an https policy link through, or nothing', () => {
    expect(isHttpsOrEmpty('')).toBe(true);
    expect(isHttpsOrEmpty('https://negocio.co/politica')).toBe(true);
    expect(isHttpsOrEmpty('http://negocio.co/politica')).toBe(false);
    expect(isHttpsOrEmpty('javascript:alert(1)')).toBe(false);
    expect(isHttpsOrEmpty('negocio.co')).toBe(false);
  });

  it('splits recipients by comma, space or line, lowercased and without repeats', () => {
    expect(parseRecipients('A@x.co, b@x.co\nA@x.co  c@x.co;')).toEqual([
      'a@x.co',
      'b@x.co',
      'c@x.co',
    ]);
    expect(parseRecipients('  ')).toEqual([]);
  });

  it('reads a price in major units as cents', () => {
    expect(majorToMinor('65')).toBe(6500);
    expect(majorToMinor('12,5')).toBe(1250);
    expect(majorToMinor('0.99')).toBe(99);
    expect(majorToMinor('1.999')).toBeNull();
    expect(majorToMinor('-1')).toBeNull();
    expect(majorToMinor('x')).toBeNull();
  });
});
