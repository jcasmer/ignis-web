import type { StatsOverview, StatsPoint, StatsTotals } from '@/api/tenant';

export type Metric = keyof StatsTotals;

/** Micro-USD (millionths of a dollar) as a readable amount. */
export function formatMicroUsd(micro: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(micro / 1_000_000);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('es-CO').format(n);
}

/**
 * Change of a metric against the previous period, as a fraction (0.25 = +25%).
 * Null when there is nothing to compare with: a rise from zero has no percentage.
 */
export function change(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}

export function formatChange(c: number | null): string {
  if (c === null) return '—';
  const pct = Math.round(Math.abs(c) * 100);
  return `${c > 0 ? '+' : c < 0 ? '−' : ''}${pct}%`;
}

/** Short label for a point of the series: "12 oct" for a day, "sem 12 oct" for a week. */
export function periodLabel(period: string, granularity: 'day' | 'week'): string {
  const d = new Date(`${period}T00:00:00Z`);
  const text = new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(d);
  return granularity === 'week' ? `sem ${text}` : text;
}

export interface ChartSeries {
  labels: string[];
  values: Record<Metric, number[]>;
}

const METRICS: Metric[] = [
  'messages_in',
  'messages_out',
  'conversations_active',
  'new_contacts',
  'handoffs',
  'llm_calls',
  'charged_micro',
];

export function toChart(stats: Pick<StatsOverview, 'series' | 'granularity'>): ChartSeries {
  const values = Object.fromEntries(
    METRICS.map((m) => [m, stats.series.map((p: StatsPoint) => p[m])]),
  ) as Record<Metric, number[]>;
  return { labels: stats.series.map((p) => periodLabel(p.period, stats.granularity)), values };
}

/** ISO date (UTC) n days before `from`, for the period selector. */
export function daysBefore(from: Date, n: number): string {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() - n));
  return d.toISOString().slice(0, 10);
}
