import { describe, expect, it } from 'vitest';

import { atLeast } from '@/utils/roles';
import {
  change,
  daysBefore,
  formatChange,
  formatMicroUsd,
  periodLabel,
  previousWindow,
  rangeDays,
  toChart,
  toCsv,
} from '@/utils/stats';

describe('stats helpers', () => {
  it('computes the change against the previous period', () => {
    expect(change(125, 100)).toBeCloseTo(0.25);
    expect(change(50, 100)).toBeCloseTo(-0.5);
    expect(change(5, 0)).toBeNull(); // a rise from zero has no percentage.
    expect(change(0, 0)).toBeNull();
  });

  it('writes the change with its sign', () => {
    expect(formatChange(0.254)).toBe('+25%');
    expect(formatChange(-0.5)).toBe('−50%');
    expect(formatChange(0)).toBe('0%');
    expect(formatChange(null)).toBe('—');
  });

  it('shows micro-dollars as dollars', () => {
    expect(formatMicroUsd(1_234_567)).toContain('1,23');
    expect(formatMicroUsd(0)).toContain('0,00');
  });

  it('labels days and weeks', () => {
    expect(periodLabel('2026-10-12', 'day')).toMatch(/12/);
    expect(periodLabel('2026-10-12', 'week').startsWith('sem ')).toBe(true);
  });

  it('turns the series into one array per metric', () => {
    const zero = {
      messages_in: 0,
      messages_out: 0,
      conversations_active: 0,
      new_contacts: 0,
      handoffs: 0,
      llm_calls: 0,
      charged_micro: 0,
    };
    const chart = toChart({
      granularity: 'day',
      series: [
        { ...zero, period: '2026-10-01', messages_in: 3 },
        { ...zero, period: '2026-10-02', messages_in: 5, handoffs: 1 },
      ],
    });
    expect(chart.labels).toHaveLength(2);
    expect(chart.values.messages_in).toEqual([3, 5]);
    expect(chart.values.handoffs).toEqual([0, 1]);
  });

  it('counts days back in UTC', () => {
    expect(daysBefore(new Date('2026-10-25T23:30:00Z'), 29)).toBe('2026-09-26');
    expect(daysBefore(new Date('2026-03-01T00:00:00Z'), 1)).toBe('2026-02-28');
  });
});

describe('roles', () => {
  it('follows the order of the API', () => {
    expect(atLeast('owner', 'admin')).toBe(true);
    expect(atLeast('agent', 'admin')).toBe(false);
    expect(atLeast('viewer', 'viewer')).toBe(true);
    expect(atLeast(null, 'viewer')).toBe(false);
  });
});

describe('report helpers', () => {
  it('counts the days of a range, both ends included', () => {
    expect(rangeDays('2026-10-01', '2026-10-30')).toBe(30);
    expect(rangeDays('2026-10-05', '2026-10-05')).toBe(1);
    expect(rangeDays('2026-02-20', '2026-03-05')).toBe(14);
  });

  it('finds the window of the same length right before', () => {
    expect(previousWindow('2026-10-01', '2026-10-30')).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(previousWindow('2026-03-01', '2026-03-07')).toEqual({
      from: '2026-02-22',
      to: '2026-02-28',
    });
    expect(previousWindow('2026-10-05', '2026-10-05')).toEqual({
      from: '2026-10-04',
      to: '2026-10-04',
    });
  });

  it('writes the series as CSV with the cost in dollars', () => {
    const zero = {
      messages_in: 0,
      messages_out: 0,
      conversations_active: 0,
      new_contacts: 0,
      handoffs: 0,
      llm_calls: 0,
      charged_micro: 0,
    };
    const headers = {
      messages_in: 'Recibidos',
      messages_out: 'Enviados',
      conversations_active: 'Conversaciones',
      new_contacts: 'Contactos',
      handoffs: 'Traspasos',
      llm_calls: 'Llamadas IA',
      charged_micro: 'Costo USD',
    };
    const csv = toCsv(
      [{ ...zero, period: '2026-10-01', messages_in: 4, charged_micro: 1_500_000 }],
      headers,
      'Periodo',
    );
    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'Periodo,Recibidos,Enviados,Conversaciones,Contactos,Traspasos,Llamadas IA,Costo USD',
    );
    expect(lines[1]).toBe('2026-10-01,4,0,0,0,0,0,1.5');
  });

  it('neutralises header text that a spreadsheet would run as a formula', () => {
    const zero = {
      messages_in: 0,
      messages_out: 0,
      conversations_active: 0,
      new_contacts: 0,
      handoffs: 0,
      llm_calls: 0,
      charged_micro: 0,
    };
    const headers = { ...zero, messages_in: '=HYPERLINK("x")' } as unknown as Record<
      keyof typeof zero,
      string
    >;
    expect(toCsv([], headers, 'P')).toContain('"\'=HYPERLINK(""x"")"');
  });
});
