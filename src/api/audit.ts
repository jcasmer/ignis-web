import type { Http } from '@/api/http';

/** Who did it. A client sees the Ignis team as one actor (`ignis`), with no name. */
export interface AuditActor {
  kind: 'operator' | 'user' | 'api_key' | 'ops_key' | 'system' | 'ignis';
  id?: string;
  name: string;
  role?: string;
}

export interface AuditEntry {
  id: number;
  at: string;
  tenant_id?: string;
  actor: AuditActor;
  /** A code made of the route, such as `ops.plans.put`. */
  action: string;
  method: string;
  route: string;
  target: Record<string, string>;
  outcome: 'ok' | 'denied' | 'failed';
  status: number;
  ip?: string;
  request_id?: string;
  detail: Record<string, string>;
}

export interface AuditPage {
  items: AuditEntry[];
  next_cursor?: string;
}

export interface AuditParams {
  tenant?: string;
  action?: string;
  outcome?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}

function query(p: AuditParams): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** The record of who changed what: `/audit` for a business, `/ops/audit` for the Ignis team. */
export function auditClient(http: Http, path: string) {
  return { list: (p: AuditParams = {}) => http.get<AuditPage>(`${path}${query(p)}`) };
}

export type AuditClient = ReturnType<typeof auditClient>;
