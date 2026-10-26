import type { Http } from './http';
import type { CreditPackage, PendingAction } from './tenant';

export interface TenantListItem {
  id: string;
  slug: string;
  name: string;
  status: 'active' | 'suspended';
  model_profile: 'economic' | 'quality';
  modules: string[];
  created_at: string;
}

export interface LimitDef {
  key: string;
  description: string;
  default: number;
  /** Bytes per unit in a storage limit; 1 when it counts items. */
  unit: number;
}

export interface CatalogModule {
  id: string;
  description: string;
  limits: LimitDef[];
}

export interface Catalog {
  models: { model: string; input_micro_per_mtok: number; output_micro_per_mtok: number }[];
  modules: CatalogModule[];
  core_limits: LimitDef[];
}

export interface Entitlements {
  modules: string[];
  /** Only what was changed from the default. */
  limits: Record<string, number>;
  llm_model: string;
  downgrade_near_cap: boolean;
  cap_warn_percent: number;
  low_balance_micro: number;
}

export interface EntitlementsPatch {
  modules?: string[];
  limits?: Record<string, number | null>;
  llm_model?: string;
  downgrade_near_cap?: boolean;
  cap_warn_percent?: number;
  low_balance_micro?: number;
}

export interface CreateTenantInput {
  slug: string;
  name: string;
  owner_email: string;
  owner_password: string;
  modules?: string[];
}

export interface Statement {
  from: string;
  to: string;
  opening_micro: number;
  plan_micro: number;
  purchased_micro: number;
  courtesy_micro: number;
  charged_micro: number;
  expired_micro: number;
  other_micro: number;
  closing_micro: number;
  currency: 'USD';
}

export interface BillingRow {
  tenant_id: string;
  slug: string;
  name: string;
  charged_micro: number;
  cost_micro: number;
  margin_micro: number;
  held_plan_micro: number;
  held_purchased_micro: number;
  held_courtesy_micro: number;
}

export interface BillingTotals {
  charged_micro: number;
  cost_micro: number;
  margin_micro: number;
  held_plan_micro: number;
  held_purchased_micro: number;
  held_courtesy_micro: number;
}

export interface BillingSummary {
  items: BillingRow[];
  totals: BillingTotals;
  currency: 'USD';
}

export interface QueueStats {
  counts: Record<string, number>;
  oldest_ready_age_seconds: number;
  stuck: { id: string; type: string; lease_until: string }[];
}

export interface GrantInput {
  tenant_id: string;
  amount_micro: number;
  idempotency_key: string;
  kind: 'purchase' | 'courtesy';
  expires_at?: string;
}

export interface Operator {
  id: string;
  email: string;
  name: string;
  role: 'super' | 'staff';
  status: 'active' | 'disabled';
  mfa_enabled: boolean;
  created_at: string;
}

export interface MailInput {
  business_name: string;
  recipients: string[];
}

export interface PrivacySettings {
  business_name: string;
  notice_text: string;
  policy_url: string;
}

export interface NewPackage {
  name: string;
  credit_micro: number;
  price_minor: number;
  currency: string;
}

export interface DemoStatus {
  ready: boolean;
  tenant_id?: string;
  documents: number;
  balance_micro: number;
  daily_cap_micro: number;
}

export interface DemoMessage {
  id: string;
  /** `in` is what the presenter wrote; `out` is what the assistant answered. */
  from: 'in' | 'out';
  body: string;
  state: 'received' | 'pending' | 'sent' | 'failed';
  at: string;
}

export interface DemoThread {
  messages: DemoMessage[];
  /** The last message is the presenter's and has no answer yet. */
  waiting: boolean;
  handoff_active: boolean;
  pending: PendingAction[];
}

function query(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** What the super admin reads and does. The API checks the operator on every call. */
export function opsApi(http: Http) {
  const t = (id: string) => encodeURIComponent(id);
  return {
    tenants: (p: { cursor?: string; limit?: number } = {}) =>
      http.get<{ items: TenantListItem[]; next_cursor?: string }>(`/ops/tenants${query(p)}`),
    createTenant: (input: CreateTenantInput) => http.post<{ id: string }>('/ops/tenants', input),
    catalog: () => http.get<Catalog>('/ops/catalog'),
    entitlements: (id: string) => http.get<Entitlements>(`/ops/tenants/${t(id)}/entitlements`),
    patchEntitlements: (id: string, patch: EntitlementsPatch) =>
      http.patch<Entitlements>(`/ops/tenants/${t(id)}/entitlements`, patch),
    security: (id: string) => http.get<{ mfa_required: boolean }>(`/ops/tenants/${t(id)}/security`),
    setSecurity: (id: string, mfaRequired: boolean) =>
      http.put<void>(`/ops/tenants/${t(id)}/security`, { mfa_required: mfaRequired }),
    statement: (id: string, p: { from?: string; to?: string } = {}) =>
      http.get<Statement>(`/ops/tenants/${t(id)}/statement${query(p)}`),
    grant: (input: GrantInput) =>
      http.post<{ tenant_id: string; balance_micro: number }>('/ops/credits/grant', input),
    billing: (p: { from?: string; to?: string } = {}) =>
      http.get<BillingSummary>(`/ops/billing/summary${query(p)}`),
    queue: () => http.get<QueueStats>('/ops/queue'),

    packages: () => http.get<{ items: CreditPackage[] }>('/ops/credit-packages'),
    createPackage: (p: NewPackage) => http.post<CreditPackage>('/ops/credit-packages', p),
    setPackageActive: (id: string, active: boolean) =>
      http.patch<void>(`/ops/credit-packages/${t(id)}`, { active }),

    operators: () => http.get<{ items: Operator[] }>('/ops/operators'),
    inviteOperator: (b: { email: string; name: string; role: 'super' | 'staff' }) =>
      http.post<Operator>('/ops/operators', b),
    setOperatorStatus: (id: string, status: 'active' | 'disabled') =>
      http.post<void>(`/ops/operators/${t(id)}/status`, { status }),
    resetOperatorMfa: (id: string) => http.post<void>(`/ops/operators/${t(id)}/reset-mfa`, {}),

    demo: () => http.get<DemoStatus>('/ops/demo'),
    demoSetup: () => http.post<DemoStatus>('/ops/demo/setup', {}),
    demoSend: (session: string, text: string) =>
      http.post<{ id: string }>('/ops/demo/messages', { session, text }),
    demoThread: (session: string) =>
      http.get<DemoThread>(`/ops/demo/messages${query({ session })}`),
    demoApprove: (id: string) => http.post<PendingAction>(`/ops/demo/actions/${t(id)}/approve`, {}),
    demoReject: (id: string) => http.post<void>(`/ops/demo/actions/${t(id)}/reject`, {}),
    demoRelease: (session: string) => http.post<void>('/ops/demo/release', { session }),

    mail: (id: string) => http.get<MailInput>(`/ops/tenants/${t(id)}/mail`),
    saveMail: (id: string, body: MailInput) => http.put<void>(`/ops/tenants/${t(id)}/mail`, body),
    privacy: (id: string) => http.get<PrivacySettings>(`/ops/tenants/${t(id)}/privacy`),
    savePrivacy: (id: string, body: PrivacySettings) =>
      http.put<void>(`/ops/tenants/${t(id)}/privacy`, body),
  };
}
