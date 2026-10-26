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

/** Four decimals: one answer of the model costs a fraction of a cent. */
export function formatMicroUsdPrecise(micro: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
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

const DAY_MS = 86_400_000;

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);

/** Number of days in an inclusive range of ISO dates. */
export function rangeDays(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / DAY_MS) + 1;
}

/** The window of the same length that ends the day before `from`. */
export function previousWindow(from: string, to: string): { from: string; to: string } {
  const n = rangeDays(from, to);
  const end = new Date(toDate(from).getTime() - DAY_MS);
  const start = new Date(end.getTime() - (n - 1) * DAY_MS);
  return { from: toIso(start), to: toIso(end) };
}

/** One value per metric for a point of the series, in the order of `metrics`. */
export function seriesValues(series: StatsPoint[], metric: Metric): number[] {
  return series.map((p) => p[metric]);
}

const csvCell = (v: string | number): string => {
  const s = String(v);
  // A cell that starts like a formula is neutralised so a spreadsheet does not run it.
  const safe = /^[=+\-@\t\r]/.test(s) && typeof v === 'string' ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** The series as CSV: one row per period, one column per metric. */
export function toCsv(
  series: StatsPoint[],
  headers: Record<Metric, string>,
  periodHeader: string,
): string {
  const metrics = Object.keys(headers) as Metric[];
  const lines = [[periodHeader, ...metrics.map((m) => headers[m])].map(csvCell).join(',')];
  for (const p of series) {
    lines.push(
      [p.period, ...metrics.map((m) => (m === 'charged_micro' ? p[m] / 1_000_000 : p[m]))]
        .map(csvCell)
        .join(','),
    );
  }
  return lines.join('\n') + '\n';
}
