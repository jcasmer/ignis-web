/** A price held in the minor unit of its currency (cents) as money. */
export function formatMinor(minor: number, currency: string): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

/** Days from now to a moment, never negative. */
export function daysUntil(iso: string, now = new Date()): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000));
}

/**
 * The page where an order is paid. Only https is followed: a link that came in a
 * response must never lead to javascript:, data: or a plain http page.
 */
export function safeCheckoutUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const ACCEPTED = ['.pdf', '.docx', '.xlsx', '.csv', '.md', '.txt'];

/** Why a file cannot be uploaded, or null when it can. The server checks again. */
export function uploadProblem(file: { name: string; size: number }): 'size' | 'type' | null {
  if (file.size > MAX_UPLOAD_BYTES) return 'size';
  const name = file.name.toLowerCase();
  return ACCEPTED.some((ext) => name.endsWith(ext)) ? null : 'type';
}

export const ACCEPT_ATTR = ACCEPTED.join(',');

/** One value per day of an inclusive range of ISO dates, zero where the API had nothing. */
export function fillDays(
  items: { key: string; value: number }[],
  from: string,
  to: string,
): { day: string; value: number }[] {
  const byDay = new Map(items.map((i) => [i.key.slice(0, 10), i.value]));
  const out: { day: string; value: number }[] = [];
  const end = new Date(`${to}T00:00:00Z`).getTime();
  for (let t = new Date(`${from}T00:00:00Z`).getTime(); t <= end; t += 86_400_000) {
    const day = new Date(t).toISOString().slice(0, 10);
    out.push({ day, value: byDay.get(day) ?? 0 });
  }
  return out;
}
