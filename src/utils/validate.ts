/** A plausible email: one @, something on each side, a dot in the domain. The server decides for real. */
export function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

/** The policy link is optional, but when it is there it must be https: it is shown to the tenant's contacts. */
export function isHttpsOrEmpty(v: string): boolean {
  const t = v.trim();
  if (!t) return true;
  try {
    return new URL(t).protocol === 'https:';
  } catch {
    return false;
  }
}

/** The recipients of the notices: split by comma, space or line, trimmed and without repeats. */
export function parseRecipients(text: string): string[] {
  const seen = new Set<string>();
  for (const part of text.split(/[\s,;]+/)) {
    const e = part.trim().toLowerCase();
    if (e) seen.add(e);
  }
  return [...seen];
}

/** A price typed in major units ("65" or "12,5") as minor units (cents), or null if invalid. */
export function majorToMinor(text: string): number | null {
  const clean = text.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}
