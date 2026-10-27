import type { AuditEntry } from '@/api/audit';

/** The i18n key of the label of an action code (dots are not allowed in a key segment). */
export const actionKey = (code: string): string => `audit.actions.${code.replace(/\./g, '_')}`;

/**
 * The key to read for an action: its own label; or, for what the Ignis team did on a client
 * (`ops.tenants.<x>`), the label of `<x>`; or none.
 */
export function actionKeys(code: string): string[] {
  const keys = [actionKey(code)];
  if (code.startsWith('ops.tenants.')) keys.push(actionKey(code.slice('ops.tenants.'.length)));
  return keys;
}

/** The facts of an entry worth reading at a glance: the detail first, then the ids of the path. */
export function factsOf(e: Pick<AuditEntry, 'detail' | 'target'>): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(e.detail)) if (v) out.push(`${k}: ${v}`);
  for (const [k, v] of Object.entries(e.target)) if (v && k !== 'id') out.push(`${k}: ${v}`);
  return out;
}

/** A day as the API takes it, from a date input. */
export const dayOf = (v: string | null | undefined): string => (v ?? '').trim();

/** The families of action a person can filter by, by area. */
export const TENANT_FAMILIES = [
  'automations.',
  'knowledge.',
  'channels.',
  'whatsapp.',
  'users.',
  'contacts.',
  'assistant.',
] as const;

export const OPS_FAMILIES = [
  'ops.tenants.',
  'ops.plans.',
  'ops.credit_packages.',
  'ops.credits.',
  'ops.model_prices.',
  'ops.operators.',
  'ops.demo.',
] as const;
