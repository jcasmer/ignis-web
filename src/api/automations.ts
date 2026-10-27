import type { Http } from './http';

export type AutomationTriggerType = 'message_received' | 'schedule';

export interface AutomationSchedule {
  /** HH:MM in `timezone`. */
  at: string;
  /** 1 (Monday) to 7 (Sunday); empty is every day. */
  weekdays?: number[];
  timezone: string;
}

export interface AutomationTrigger {
  type: AutomationTriggerType;
  schedule?: AutomationSchedule;
}

export type ConditionOp =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'contains_any'
  | 'starts_with'
  | 'in'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'exists';

export type ConditionValue = string | number | boolean | (string | number)[];

export interface AutomationCondition {
  field: string;
  op: ConditionOp;
  value?: ConditionValue;
}

export interface AutomationGuard {
  match?: 'all' | 'any';
  conditions: AutomationCondition[];
}

export type AutomationActionType =
  | 'reply'
  | 'email_business'
  | 'connector_call'
  | 'handoff'
  | 'ai_analyze'
  | 'ai_extract'
  | 'ignis_stats'
  | 'knowledge_search';

export interface AutomationAction {
  type: AutomationActionType;
  text?: string;
  subject?: string;
  body?: string;
  connector?: string;
  operation?: string;
  arguments?: Record<string, unknown>;
  as?: string;
  reason?: string;
  prompt?: string;
  inputs?: Record<string, string>;
  schema?: Record<string, unknown>;
  model?: string;
  query?: string;
  limit?: number;
  max_tokens?: number;
  days?: number;
  when?: AutomationGuard;
}

/** Whether an AI provider can be chosen, and if not, why. */
export interface ModelProvider {
  id: string;
  status: 'available' | 'not_configured' | 'no_price';
}

/** What the API takes to create or replace a rule. */
export interface AutomationInput {
  name: string;
  enabled?: boolean;
  trigger: AutomationTrigger;
  match?: 'all' | 'any';
  conditions?: AutomationCondition[];
  actions: AutomationAction[];
  timezone?: string;
  /** The most one run may spend on models, in micro-USD. */
  ai_budget_micro?: number;
  cooldown_minutes?: number;
}

export interface AutomationRule extends AutomationInput {
  id: string;
  enabled: boolean;
  match: 'all' | 'any';
  conditions: AutomationCondition[];
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AutomationStep {
  action: AutomationActionType;
  ok: boolean;
  /** What happened, never what the contact wrote. */
  detail?: string;
  cost_micro?: number;
}

export type AutomationRunStatus = 'running' | 'done' | 'failed' | 'skipped';

export interface AutomationRun {
  id: string;
  rule_id: string;
  rule_name: string;
  rule_version: number;
  key: string;
  status: AutomationRunStatus;
  steps: AutomationStep[];
  ai_cost_micro: number;
  error?: string;
  started_at: string;
  finished_at?: string;
}

export interface AutomationTrace {
  matched: boolean;
  conditions: { condition: string; passed: boolean }[];
  actions: { type: AutomationActionType; detail: string }[];
}

export interface AutomationSampleEvent {
  at?: string;
  message?: { text: string; channel: string };
  contact?: { name: string; channel: string; is_new: boolean };
}

/** One question a template asks, in plain words. */
export interface TemplateParam {
  id: string;
  label: string;
  hint?: string;
  /** How it is asked: one line, several lines, an hour (0 to 23), a time (HH:MM) or words separated by commas. */
  kind: 'text' | 'longtext' | 'hour' | 'time' | 'list';
  default: string;
}

/** A ready-made rule a tenant can start from. */
export interface AutomationTemplate {
  id: string;
  name: string;
  summary: string;
  category: 'attention' | 'alerts' | 'reports';
  trigger: AutomationTriggerType;
  /** What the customer must have: the email of the business (mail) or the AI steps (ai). */
  needs: ('mail' | 'ai')[];
  params: TemplateParam[];
}

/** What the screens do with rules, for the tenant itself or, for an operator, for a tenant. */
export interface AutomationsClient {
  list(): Promise<{ items: AutomationRule[] }>;
  create(input: AutomationInput): Promise<AutomationRule>;
  replace(id: string, input: AutomationInput): Promise<AutomationRule>;
  remove(id: string): Promise<void>;
  runs(p?: { rule?: string; limit?: number }): Promise<{ items: AutomationRun[] }>;
  test(rule: AutomationInput, event: AutomationSampleEvent): Promise<AutomationTrace>;
  /** The models a step may ask for, as "provider:model". */
  models(): Promise<{ items: string[]; providers: ModelProvider[] }>;
  /** The ready-made rules. */
  templates(): Promise<{ items: AutomationTemplate[] }>;
  /** The rule a template makes with the answers given; nothing is saved. */
  buildTemplate(id: string, values: Record<string, string>): Promise<AutomationRule>;
}

function query(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** The rules under `base`: `/automations` for the tenant, `/ops/tenants/{id}/automations` for an operator. */
export function automationsClient(http: Http, base: string): AutomationsClient {
  const one = (id: string) => `${base}/${encodeURIComponent(id)}`;
  return {
    list: () => http.get(base),
    create: (input) => http.post(base, input),
    replace: (id, input) => http.put(one(id), input),
    remove: (id) => http.del(one(id)),
    runs: (p = {}) => http.get(`${base}/runs${query({ rule: p.rule, limit: p.limit })}`),
    test: (rule, event) => http.post(`${base}/test`, { rule, event }),
    models: () => http.get(`${base}/models`),
    templates: () => http.get(`${base}/templates`),
    buildTemplate: (id, values) =>
      http.post(`${base}/templates/${encodeURIComponent(id)}/build`, { values }),
  };
}
