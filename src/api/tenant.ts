import type { Http } from './http';

export interface StatsTotals {
  messages_in: number;
  messages_out: number;
  conversations_active: number;
  new_contacts: number;
  handoffs: number;
  llm_calls: number;
  /** Micro-USD charged for the AI. */
  charged_micro: number;
}

export interface StatsPoint extends StatsTotals {
  period: string;
}

export interface StatsOverview {
  from: string;
  to: string;
  granularity: 'day' | 'week';
  totals: StatsTotals;
  previous: StatsTotals;
  series: StatsPoint[];
}

export interface ContactRef {
  id: string;
  channel: string;
  external_id: string;
  display_name?: string;
}

export interface ConversationSummary {
  id: string;
  contact: ContactRef;
  status: 'open' | 'closed';
  last_message_at: string;
  last_message: string;
  last_direction: 'in' | 'out';
  handoff_active: boolean;
}

export interface ConversationMessage {
  id: string;
  direction: 'in' | 'out';
  body: string;
  status: 'received' | 'pending' | 'sent' | 'failed';
  flags: string[];
  at: string;
}

export interface Page<T> {
  items: T[];
  next_cursor?: string;
}

export type HandoffReason = 'contact_request' | 'assistant' | 'failures';

export interface Handoff {
  id: string;
  conversation_id: string;
  status: 'active' | 'closed';
  reason: HandoffReason;
  note?: string;
  opened_at: string;
  expires_at: string;
  closed_at?: string;
  closed_by?: string;
}

export interface HandoffStats {
  since: string;
  conversations: number;
  handoffs: number;
  rate: number;
  by_reason: Record<string, number>;
  closed_by_person: number;
  expired: number;
  active: number;
  avg_seconds_to_person: number;
}

export type ActionStatus = 'pending' | 'approved' | 'rejected' | 'failed' | 'expired';

export interface PendingAction {
  id: string;
  tool: string;
  risk: 'write' | 'external';
  summary: string;
  arguments: Record<string, unknown>;
  code: string;
  status: ActionStatus;
  result?: string;
  resolved_by?: string;
  created_at: string;
  resolved_at?: string;
  expires_at: string;
}

function query(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** What the tenant's console reads and does; the API checks the role of each call. */
export function tenantApi(http: Http) {
  return {
    stats: (p: { from?: string; to?: string; granularity?: 'day' | 'week' }) =>
      http.get<StatsOverview>(`/stats/overview${query(p)}`),
    conversations: (p: { cursor?: string; limit?: number } = {}) =>
      http.get<Page<ConversationSummary>>(`/conversations${query(p)}`),
    messages: (id: string, p: { cursor?: string; limit?: number } = {}) =>
      http.get<Page<ConversationMessage>>(
        `/conversations/${encodeURIComponent(id)}/messages${query(p)}`,
      ),
    handoffs: (status: 'active' | 'closed' = 'active') =>
      http.get<{ items: Handoff[] }>(`/handoffs${query({ status })}`),
    handoffStats: (days: number) => http.get<HandoffStats>(`/handoffs/stats${query({ days })}`),
    closeHandoff: (id: string) =>
      http.post<Handoff>(`/handoffs/${encodeURIComponent(id)}/close`, {}),
    actions: (status: ActionStatus = 'pending') =>
      http.get<{ items: PendingAction[] }>(`/actions${query({ status })}`),
    approve: (id: string) =>
      http.post<PendingAction>(`/actions/${encodeURIComponent(id)}/approve`, {}),
    reject: (id: string) => http.post<void>(`/actions/${encodeURIComponent(id)}/reject`, {}),
  };
}
