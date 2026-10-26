import { describe, expect, it } from 'vitest';

import type { ModelPriceItem } from '@/api/ops';
import { groupByModel, toPriceBody, type PriceForm } from '@/utils/prices';

const item = (over: Partial<ModelPriceItem>): ModelPriceItem => ({
  provider: 'gemini',
  model: 'g',
  input_micro_per_mtok: 300_000,
  output_micro_per_mtok: 2_500_000,
  effective_from: '2026-10-01T00:00:00Z',
  source_url: 'https://ai.google.dev/pricing',
  verified_on: '2026-10-01',
  in_force: false,
  ...over,
});

const now = new Date('2026-10-26T12:00:00Z');

describe('groupByModel', () => {
  it('keeps the price in force and the ones still to come, and drops the old history', () => {
    const groups = groupByModel(
      [
        item({ effective_from: '2026-01-01T00:00:00Z' }),
        item({ effective_from: '2026-10-01T00:00:00Z', in_force: true }),
        item({ effective_from: '2027-03-01T00:00:00Z' }),
        item({ effective_from: '2027-01-01T00:00:00Z' }),
        item({ provider: 'anthropic', model: 'a' }),
      ],
      now,
    );
    expect(groups.map((g) => `${g.provider}/${g.model}`)).toEqual(['anthropic/a', 'gemini/g']);
    const g = groups[1]!;
    expect(g.current?.effective_from).toBe('2026-10-01T00:00:00Z');
    expect(g.scheduled.map((s) => s.effective_from)).toEqual([
      '2027-01-01T00:00:00Z',
      '2027-03-01T00:00:00Z',
    ]);
    expect(groups[0]!.current).toBeNull();
  });
});

const form = (over: Partial<PriceForm> = {}): PriceForm => ({
  provider: 'gemini',
  model: 'gemini-3.5-flash-lite',
  input: '0,30',
  output: '2.5',
  start: 'now',
  from: '',
  sourceUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
  verifiedOn: '2026-10-26',
  ...over,
});

describe('toPriceBody', () => {
  it('turns USD per million into micro-USD and starts a minute ago when it is "now"', () => {
    const r = toPriceBody(form(), now);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.body.input_micro_per_mtok).toBe(300_000);
    expect(r.body.output_micro_per_mtok).toBe(2_500_000);
    expect(r.body.effective_from).toBe('2026-10-26T11:59:00.000Z');
    expect(r.body.verified_on).toBe('2026-10-26');
  });

  it('starts at midnight UTC of the chosen day', () => {
    const r = toPriceBody(form({ start: 'date', from: '2027-01-01' }), now);
    expect(r.ok && r.body.effective_from).toBe('2027-01-01T00:00:00.000Z');
  });

  it.each([
    [{ model: '' }, 'model'],
    [{ model: 'has spaces' }, 'model'],
    [{ input: 'abc' }, 'amount'],
    [{ output: '-1' }, 'amount'],
    [{ start: 'date' as const, from: '' }, 'date'],
    [{ sourceUrl: 'http://ai.google.dev/pricing' }, 'source'],
    [{ sourceUrl: 'not a url' }, 'source'],
    [{ verifiedOn: '2026-12-01' }, 'verified'],
    [{ verifiedOn: '' }, 'verified'],
  ])('rejects %j as %s', (over, error) => {
    expect(toPriceBody(form(over), now)).toEqual({ ok: false, error });
  });
});
