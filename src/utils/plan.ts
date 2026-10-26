/**
 * The limits of a tenant are sent as a patch: only what changed, and `null` to go
 * back to the default of the module. `current` holds the overrides the tenant has
 * now; `next` holds what the form says for each limit (`null` = the default).
 */
export function diffLimits(
  current: Record<string, number>,
  next: Record<string, number | null>,
): Record<string, number | null> {
  const patch: Record<string, number | null> = {};
  for (const [key, value] of Object.entries(next)) {
    const had = key in current ? current[key]! : null;
    if (value !== had) patch[key] = value;
  }
  return patch;
}

/** The modules that were added and removed, for the confirmation text. */
export function diffModules(
  before: string[],
  after: string[],
): { added: string[]; removed: string[] } {
  return {
    added: after.filter((m) => !before.includes(m)),
    removed: before.filter((m) => !after.includes(m)),
  };
}

/** A decimal amount in dollars ("12,5" or "12.50") as micro-dollars, or null if it is not a valid amount. */
export function usdToMicro(text: string): number | null {
  const clean = text.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,6})?$/.test(clean)) return null;
  const [whole, frac = ''] = clean.split('.');
  return Number(whole) * 1_000_000 + Number(frac.padEnd(6, '0'));
}

/** A suggestion for the slug of a tenant from its name: lowercase, ASCII, dashes. */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

/** A random password of 20 characters from a safe alphabet, from the browser's CSPRNG. */
export function generatePassword(length = 20): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_';
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  // Rejection-free: 4294967296 is not a multiple of the alphabet size, so use the high bits.
  return Array.from(bytes, (b) => alphabet[Math.floor((b / 2 ** 32) * alphabet.length)]).join('');
}
