import { describe, expect, it } from 'vitest';

import {
  diffLimits,
  diffModules,
  generatePassword,
  slugify,
  SLUG_PATTERN,
  usdToMicro,
} from '@/utils/plan';

describe('plan helpers', () => {
  it('sends only the limits that changed, and null to return to the default', () => {
    const current = { 'users.max': 5, 'documents.max': 20 };
    const patch = diffLimits(current, {
      'users.max': 5, // unchanged
      'documents.max': null, // back to the default
      'handoff.window_minutes': 90, // new
      'email.daily_emails': null, // was default, still default
    });
    expect(patch).toEqual({ 'documents.max': null, 'handoff.window_minutes': 90 });
  });

  it('lists the modules added and removed', () => {
    expect(diffModules(['a', 'b'], ['b', 'c'])).toEqual({ added: ['c'], removed: ['a'] });
    expect(diffModules(['a'], ['a'])).toEqual({ added: [], removed: [] });
  });

  it('reads an amount in dollars as micro-dollars', () => {
    expect(usdToMicro('25')).toBe(25_000_000);
    expect(usdToMicro('12,5')).toBe(12_500_000);
    expect(usdToMicro(' 0.000001 ')).toBe(1);
    expect(usdToMicro('1.2345678')).toBeNull();
    expect(usdToMicro('-5')).toBeNull();
    expect(usdToMicro('abc')).toBeNull();
    expect(usdToMicro('')).toBeNull();
  });

  it('makes a valid slug from a business name', () => {
    expect(slugify('Panadería La Estrella')).toBe('panaderia-la-estrella');
    expect(slugify('  ¡Café & Té! ')).toBe('cafe-te');
    expect(SLUG_PATTERN.test(slugify('Panadería La Estrella'))).toBe(true);
    expect(SLUG_PATTERN.test('a')).toBe(false);
    expect(SLUG_PATTERN.test('-ab-')).toBe(false);
  });

  it('generates different strong passwords', () => {
    const a = generatePassword();
    const b = generatePassword();
    expect(a).toHaveLength(20);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
