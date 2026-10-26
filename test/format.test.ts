import { describe, expect, it } from 'vitest';

import { daysUntil, fillDays, formatMinor, safeCheckoutUrl, uploadProblem } from '@/utils/format';

describe('format helpers', () => {
  it('writes a price from its minor unit', () => {
    expect(formatMinor(1999, 'USD')).toContain('19,99');
    expect(formatMinor(0, 'USD')).toContain('0,00');
  });

  it('counts the days to a date without going negative', () => {
    const now = new Date('2026-10-01T00:00:00Z');
    expect(daysUntil('2026-10-11T00:00:00Z', now)).toBe(10);
    expect(daysUntil('2026-09-01T00:00:00Z', now)).toBe(0);
  });

  it('follows only https checkout links', () => {
    expect(safeCheckoutUrl('https://pay.example/checkout/1')).toBe(
      'https://pay.example/checkout/1',
    );
    expect(safeCheckoutUrl('http://pay.example/checkout/1')).toBeNull();
    expect(safeCheckoutUrl('javascript:alert(1)')).toBeNull();
    expect(safeCheckoutUrl('data:text/html,hi')).toBeNull();
    expect(safeCheckoutUrl('not a url')).toBeNull();
    expect(safeCheckoutUrl(undefined)).toBeNull();
  });

  it('refuses files that are too big or of an unknown type before sending them', () => {
    expect(uploadProblem({ name: 'menu.PDF', size: 1000 })).toBeNull();
    expect(uploadProblem({ name: 'precios.xlsx', size: 10 * 1024 * 1024 })).toBeNull();
    expect(uploadProblem({ name: 'grande.pdf', size: 10 * 1024 * 1024 + 1 })).toBe('size');
    expect(uploadProblem({ name: 'virus.exe', size: 10 })).toBe('type');
    expect(uploadProblem({ name: 'sin-extension', size: 10 })).toBe('type');
  });
});

describe('fillDays', () => {
  it('gives one value per day and zero where there was no usage', () => {
    const out = fillDays(
      [
        { key: '2026-10-02', value: 5 },
        { key: '2026-10-04T00:00:00Z', value: 7 },
      ],
      '2026-10-01',
      '2026-10-04',
    );
    expect(out.map((d) => d.value)).toEqual([0, 5, 0, 7]);
    expect(out[0]!.day).toBe('2026-10-01');
  });
});
