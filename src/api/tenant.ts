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

export type DocumentStatus = 'processing' | 'ready' | 'failed';

export interface KnowledgeDocument {
  id: string;
  title: string;
  source?: string;
  source_type: 'pdf' | 'docx' | 'xlsx' | 'csv' | 'md' | 'txt';
  format: 'plain' | 'markdown' | 'table' | 'paged';
  status: DocumentStatus;
  error?: string;
  chunk_count: number;
  ignored_images: number;
  embedding_model?: string;
  created_at: string;
}

export interface CreditLot {
  kind: 'plan' | 'purchase' | 'courtesy';
  initial_micro: number;
  remaining_micro: number;
  granted_at: string;
  expires_at: string;
}

export interface Balance {
  balance_micro: number;
  currency: 'USD';
  lots: CreditLot[];
}

export interface LedgerEntry {
  id: string;
  kind: 'grant' | 'reserve' | 'settle' | 'release';
  amount_micro: number;
  ref?: string;
  estimated: boolean;
  charged_micro?: number;
  model?: string;
  created_at: string;
}

export interface CreditPackage {
  id: string;
  name: string;
  credit_micro: number;
  /** Price in the minor unit of the currency (cents). */
  price_minor: number;
  currency: string;
  active: boolean;
}

export interface CreditOrder {
  id: string;
  package_id: string;
  credit_micro: number;
  price_minor: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed';
  checkout_url?: string;
  created_at: string;
  paid_at?: string;
}

export interface UsageItem {
  key: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  charged_micro: number;
}

export type ChannelName = 'whatsapp' | 'instagram' | 'facebook';

export interface Channel {
  channel: ChannelName;
  external_account_id: string;
  status: 'active' | 'disabled';
  updated_at: string;
}

export interface MailSettings {
  business_name: string;
  recipients: string[];
  sent_today: number;
}

export interface Email {
  id: string;
  kind: 'business' | 'contact';
  to: string;
  subject: string;
  status: 'pending' | 'sent' | 'failed';
  reason?: string;
  provider_id?: string;
  created_at: string;
  sent_at?: string;
}

export type ConsentPurpose = 'data_processing' | 'email';

export interface Consent {
  purpose: ConsentPurpose;
  status: 'notified' | 'granted' | 'revoked';
  address?: string;
  source?: 'continued' | 'explicit' | 'api';
  notice_version: number;
  evidence?: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  channel: string;
  external_id: string;
  display_name?: string;
  created_at: string;
  consents: Consent[];
}

export interface ConsentInput {
  purpose: ConsentPurpose;
  granted: boolean;
  address?: string;
  evidence?: string;
}

export interface Erasure {
  id: string;
  contact_code: string;
  channel: string;
  reason: 'request' | 'retention';
  requested_by: string;
  erased_at: string;
  proofs: {
    purpose: ConsentPurpose;
    status: 'notified' | 'granted' | 'revoked';
    source?: 'continued' | 'explicit' | 'api';
    notice_version: number;
    evidence?: string;
    granted_at: string;
    updated_at: string;
  }[];
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

    documents: (p: { cursor?: string; limit?: number } = {}) =>
      http.get<Page<KnowledgeDocument>>(`/knowledge/documents${query(p)}`),
    uploadDocument: (file: File, title?: string) => {
      const form = new FormData();
      form.set('file', file);
      if (title) form.set('title', title);
      return http.post<KnowledgeDocument>('/knowledge/documents', form);
    },
    reindexDocument: (id: string) =>
      http.post<void>(`/knowledge/documents/${encodeURIComponent(id)}/reindex`, {}),
    reindexAll: () => http.post<{ documents: number }>('/knowledge/reindex', {}),
    deleteDocument: (id: string) =>
      http.del<void>(`/knowledge/documents/${encodeURIComponent(id)}`),

    channels: () => http.get<{ items: Channel[] }>('/channels'),
    configureChannel: (
      channel: ChannelName,
      body: { external_account_id: string; access_token: string },
    ) => http.put<Channel>(`/channels/${channel}`, body),

    mailSettings: () => http.get<MailSettings>('/mail'),
    mailOutbox: (limit = 50) => http.get<{ items: Email[] }>(`/mail/outbox${query({ limit })}`),

    privacyNotice: () => http.get<{ notice: string; version: number }>('/privacy'),
    contacts: (limit = 100) => http.get<{ items: Contact[] }>(`/contacts${query({ limit })}`),
    recordConsent: (id: string, body: ConsentInput) =>
      http.post<void>(`/contacts/${encodeURIComponent(id)}/consents`, body),
    exportContact: (id: string) =>
      http.get<Record<string, unknown>>(`/contacts/${encodeURIComponent(id)}/export`),
    eraseContact: (id: string) => http.del<void>(`/contacts/${encodeURIComponent(id)}`),
    erasures: (limit = 100) => http.get<{ items: Erasure[] }>(`/erasures${query({ limit })}`),

    balance: () => http.get<Balance>('/credits/balance'),
    ledger: (p: { cursor?: string; limit?: number } = {}) =>
      http.get<Page<LedgerEntry> & { currency: 'USD' }>(`/credits/ledger${query(p)}`),
    packages: () => http.get<{ items: CreditPackage[] }>('/credits/packages'),
    orders: () => http.get<{ items: CreditOrder[] }>('/credits/orders'),
    placeOrder: (packageId: string) =>
      http.post<CreditOrder>('/credits/orders', { package_id: packageId }),
    usage: (p: { from?: string; to?: string; by?: 'day' | 'model' }) =>
      http.get<{ by: 'day' | 'model'; items: UsageItem[]; currency: 'USD' }>(
        `/credits/usage${query(p)}`,
      ),
  };
}
