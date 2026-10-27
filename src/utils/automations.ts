import type {
  AutomationAction,
  AutomationActionType,
  AutomationCondition,
  AutomationGuard,
  AutomationInput,
  AutomationRule,
  ConditionOp,
  ConditionValue,
} from '@/api/automations';

// --- what a rule can read -------------------------------------------------------------

export const MESSAGE_FIELDS = [
  'message.text',
  'message.channel',
  'contact.name',
  'contact.channel',
  'contact.is_new',
] as const;
export const TIME_FIELDS = ['time.weekday', 'time.hour', 'time.date'] as const;
export const TIME_ZONES = [
  'America/Bogota',
  'America/Mexico_City',
  'America/Lima',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/Caracas',
  'America/New_York',
  'Europe/Madrid',
  'UTC',
] as const;
export const DEFAULT_TIMEZONE = 'America/Bogota';

/** What a field holds, which decides the comparisons that make sense for it. */
export type FieldKind = 'text' | 'number' | 'flag' | 'date';

export function fieldKind(field: string): FieldKind {
  // What a search of the knowledge base says about whether it found anything.
  if (field === 'contact.is_new' || /^vars\.[a-z][a-z0-9_]*\.found$/.test(field)) return 'flag';
  if (field === 'time.weekday' || field === 'time.hour') return 'number';
  if (field === 'time.date') return 'date';
  return 'text';
}

const OPS: Record<FieldKind, ConditionOp[]> = {
  text: ['contains_any', 'contains', 'equals', 'not_equals', 'starts_with', 'exists'],
  number: ['equals', 'not_equals', 'gte', 'lte', 'gt', 'lt', 'in'],
  flag: ['equals'],
  date: ['equals', 'not_equals', 'starts_with'],
};

/** The comparisons offered for a field. A variable of an earlier step is free text. */
export function opsFor(field: string): ConditionOp[] {
  if (field.startsWith('vars.') && fieldKind(field) !== 'flag')
    return [...OPS.text, 'gte', 'lte', 'gt', 'lt'];
  return OPS[fieldKind(field)];
}

export const LIST_OPS: ConditionOp[] = ['contains_any', 'in'];
export const NUMBER_OPS: ConditionOp[] = ['gt', 'gte', 'lt', 'lte'];

// --- drafts: the rule as the form holds it ---------------------------------------------

export interface ConditionDraft {
  field: string;
  op: ConditionOp;
  /** Texts, numbers and lists (separated by commas). */
  text: string;
  /** The value of a yes/no field. */
  flag: boolean;
}

export interface GuardDraft {
  enabled: boolean;
  match: 'all' | 'any';
  conditions: ConditionDraft[];
}

export type SchemaType = 'string' | 'number' | 'integer' | 'boolean';

export interface SchemaField {
  name: string;
  type: SchemaType;
  /** For a text: the only values it may take, separated by commas. */
  values: string;
  required: boolean;
}

export interface InputDraft {
  label: string;
  value: string;
}

export interface StepDraft {
  /** Identifies the step in the form; it never reaches the API. */
  key: string;
  type: AutomationActionType;
  guard: GuardDraft;
  text: string;
  subject: string;
  body: string;
  connector: string;
  operation: string;
  /** The text of each argument, by name (it may use {{fields}}). */
  args: Record<string, string>;
  /** The type each argument has in the operation, to send it as a number or a boolean. */
  argTypes: Record<string, string>;
  as: string;
  reason: string;
  prompt: string;
  inputs: InputDraft[];
  fields: SchemaField[];
  /** "provider:model"; empty uses the model of the plan. */
  model: string;
  maxTokens: string;
  days: string;
  /** knowledge_search: what is looked for, and how many passages (empty: 4). */
  query: string;
  limit: string;
  /** whatsapp_template: the template, who it goes to (empty: the contact) and its values. */
  template: string;
  to: string;
  values: string[];
  /** wait: how long, as typed, and in what unit. */
  amount: string;
  unit: WaitUnit;
}

export type WaitUnit = 'minutes' | 'hours' | 'days';

export const WAIT_UNITS: Record<WaitUnit, number> = { minutes: 1, hours: 60, days: 1440 };
export const MAX_WAIT_MINUTES = 7 * 24 * 60;
export const MAX_WAITS = 2;

/** A wait as a number and a unit, in the biggest unit that has no remainder. */
export function waitParts(minutes: number): { amount: string; unit: WaitUnit } {
  if (minutes % 1440 === 0) return { amount: String(minutes / 1440), unit: 'days' };
  if (minutes % 60 === 0) return { amount: String(minutes / 60), unit: 'hours' };
  return { amount: String(minutes), unit: 'minutes' };
}

export interface RuleDraft {
  id?: string;
  name: string;
  enabled: boolean;
  trigger: 'message_received' | 'schedule';
  at: string;
  weekdays: number[];
  timezone: string;
  match: 'all' | 'any';
  conditions: ConditionDraft[];
  steps: StepDraft[];
  cooldown: string;
  /** The budget of a run in USD, as typed. */
  budget: string;
}

let counter = 0;
const nextKey = () => `step-${++counter}`;

export function emptyCondition(trigger: RuleDraft['trigger']): ConditionDraft {
  return trigger === 'message_received'
    ? { field: 'message.text', op: 'contains_any', text: '', flag: true }
    : { field: 'time.hour', op: 'gte', text: '', flag: true };
}

export function emptyGuard(): GuardDraft {
  return { enabled: false, match: 'all', conditions: [] };
}

export function emptyStep(type: AutomationActionType): StepDraft {
  return {
    key: nextKey(),
    type,
    guard: emptyGuard(),
    text: '',
    subject: '',
    body: '',
    connector: '',
    operation: '',
    args: {},
    argTypes: {},
    as: '',
    reason: '',
    prompt: '',
    inputs: [],
    fields: [],
    model: '',
    maxTokens: '',
    days: '7',
    query: '',
    limit: '',
    template: '',
    to: '',
    values: [],
    amount: '1',
    unit: 'hours',
  };
}

export function emptyRule(kind: 'plain' | 'ai' = 'plain'): RuleDraft {
  const steps = kind === 'ai' ? [emptyStep('ai_extract')] : [emptyStep('reply')];
  return {
    name: '',
    enabled: true,
    trigger: 'message_received',
    at: '09:00',
    weekdays: [],
    timezone: DEFAULT_TIMEZONE,
    match: 'all',
    conditions: [emptyCondition('message_received')],
    steps,
    cooldown: '',
    budget: '',
  };
}

export const AI_ACTIONS: AutomationActionType[] = ['ai_analyze', 'ai_extract'];

export function isAIAction(type: AutomationActionType): boolean {
  return AI_ACTIONS.includes(type);
}

/** True when a step of the rule asks a model: those rules are the "con IA" ones. */
export function usesAI(rule: Pick<AutomationInput, 'actions'>): boolean {
  return rule.actions.some((a) => isAIAction(a.type));
}

// --- from the API to a draft ----------------------------------------------------------------

function textOf(v: ConditionValue | undefined): string {
  if (Array.isArray(v)) return v.join(', ');
  if (v === undefined) return '';
  // A yes/no value is written as text: the field a model extracted is compared with "true" or "false".
  return String(v);
}

function conditionToDraft(c: AutomationCondition): ConditionDraft {
  return {
    field: c.field,
    op: c.op,
    text: textOf(c.value),
    flag: c.value === false ? false : true,
  };
}

function guardToDraft(g: AutomationGuard | undefined): GuardDraft {
  if (!g) return emptyGuard();
  return { enabled: true, match: g.match ?? 'all', conditions: g.conditions.map(conditionToDraft) };
}

function fieldsOf(schema: Record<string, unknown> | undefined): SchemaField[] {
  const props = (schema?.properties ?? {}) as Record<string, Record<string, unknown>>;
  const required = Array.isArray(schema?.required) ? (schema.required as string[]) : [];
  return Object.entries(props).map(([name, p]) => ({
    name,
    type: (['string', 'number', 'integer', 'boolean'].includes(String(p.type))
      ? p.type
      : 'string') as SchemaType,
    values: Array.isArray(p.enum) ? p.enum.join(', ') : '',
    required: required.includes(name),
  }));
}

function stepToDraft(a: AutomationAction): StepDraft {
  const step = emptyStep(a.type);
  step.guard = guardToDraft(a.when);
  step.text = a.text ?? '';
  step.subject = a.subject ?? '';
  step.body = a.body ?? '';
  step.connector = a.connector ?? '';
  step.operation = a.operation ?? '';
  for (const [name, v] of Object.entries(a.arguments ?? {})) {
    step.args[name] =
      typeof v === 'string' ? v : v === null || v === undefined ? '' : JSON.stringify(v);
    step.argTypes[name] =
      typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : 'string';
  }
  step.as = a.as ?? '';
  step.reason = a.reason ?? '';
  step.prompt = a.prompt ?? '';
  step.inputs = Object.entries(a.inputs ?? {}).map(([label, value]) => ({ label, value }));
  step.fields = fieldsOf(a.schema);
  step.model = a.model ?? '';
  step.maxTokens = a.max_tokens ? String(a.max_tokens) : '';
  step.days = a.days ? String(a.days) : '7';
  step.query = a.query ?? '';
  step.limit = a.limit ? String(a.limit) : '';
  step.template = a.template ?? '';
  step.to = a.to ?? '';
  step.values = [...(a.values ?? [])];
  if (a.minutes) {
    const w = waitParts(a.minutes);
    step.amount = w.amount;
    step.unit = w.unit;
  }
  return step;
}

export function ruleToDraft(r: AutomationRule): RuleDraft {
  const s = r.trigger.schedule;
  return {
    id: r.id,
    name: r.name,
    enabled: r.enabled,
    trigger: r.trigger.type,
    at: s?.at ?? '09:00',
    weekdays: s?.weekdays ? [...s.weekdays] : [],
    timezone: s?.timezone ?? r.timezone ?? DEFAULT_TIMEZONE,
    match: r.match,
    conditions: r.conditions.map(conditionToDraft),
    steps: r.actions.map(stepToDraft),
    cooldown: r.cooldown_minutes ? String(r.cooldown_minutes) : '',
    budget: r.ai_budget_micro ? String(r.ai_budget_micro / 1_000_000).replace('.', ',') : '',
  };
}

// --- from a draft to the API -------------------------------------------------------------------

export type RuleError =
  | 'name'
  | 'time'
  | 'weekdays'
  | 'conditionValue'
  | 'noSteps'
  | 'tooManySteps'
  | 'conversationOnly'
  | 'twoReplies'
  | 'twoHandoffs'
  | 'reply'
  | 'subject'
  | 'body'
  | 'connector'
  | 'operation'
  | 'variable'
  | 'variableTaken'
  | 'prompt'
  | 'promptFields'
  | 'inputLabel'
  | 'schemaEmpty'
  | 'schemaName'
  | 'schemaValues'
  | 'maxTokens'
  | 'days'
  | 'knowledgeQuery'
  | 'knowledgeLimit'
  | 'template'
  | 'phone'
  | 'templateValue'
  | 'waitTime'
  | 'waitLast'
  | 'tooManyWaits'
  | 'unknownField'
  | 'unclosed'
  | 'undefinedVariable'
  | 'modelInCall'
  | 'guardEmpty'
  | 'guardVariable'
  | 'budget'
  | 'cooldown';

export type RuleResult =
  | { ok: true; input: AutomationInput }
  /** `step` is the position (from 0) of the step at fault; `detail` names the field or condition. */
  | { ok: false; error: RuleError; step?: number; detail?: string };

const IDENTIFIER = /^[a-z][a-z0-9_]{0,23}$/;
const SCHEMA_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,39}$/;
const LABEL = /^[A-Za-z][A-Za-z0-9 _-]{0,39}$/;
const PLACEHOLDER = /\{\{\s*([A-Za-z_][A-Za-z0-9_.]*)\s*\}\}/g;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_STEPS = 10;
/** The steps that do something and keep nothing: they have no variable to name. */
const NO_RESULT: AutomationActionType[] = [
  'reply',
  'email_business',
  'handoff',
  'whatsapp_template',
  'wait',
];

function parseNumber(text: string): number | null {
  const clean = text.trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(clean)) return null;
  return Number(clean);
}

function splitList(text: string): string[] {
  return text
    .split(/[,\n]+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** The value of a condition as the API wants it, or null when it is not valid. */
function conditionValue(c: ConditionDraft): { value?: ConditionValue } | null {
  const kind = fieldKind(c.field);
  if (c.op === 'exists') return {};
  if (kind === 'flag') return { value: c.flag };
  if (LIST_OPS.includes(c.op)) {
    const items = splitList(c.text);
    if (!items.length || items.length > 50) return null;
    if (kind === 'number') {
      const nums = items.map(parseNumber);
      return nums.every((n) => n !== null) ? { value: nums } : null;
    }
    return { value: items };
  }
  if (NUMBER_OPS.includes(c.op) || kind === 'number') {
    const n = parseNumber(c.text);
    return n === null ? null : { value: n };
  }
  const text = c.text.trim();
  return text && text.length <= 200 ? { value: text } : null;
}

function toCondition(c: ConditionDraft): AutomationCondition | null {
  const v = conditionValue(c);
  return v ? { field: c.field, op: c.op, ...(v.value !== undefined && { value: v.value }) } : null;
}

/** The names a rule can write in {{ }}: the event, and the variables of earlier steps. */
function placeholderProblem(
  text: string,
  trigger: RuleDraft['trigger'],
  vars: Set<string>,
): RuleError | null {
  const opens = text.split('{{').length - 1;
  const closes = text.split('}}').length - 1;
  if (opens !== closes) return 'unclosed';
  for (const m of text.matchAll(PLACEHOLDER)) {
    const path = m[1] ?? '';
    if ((TIME_FIELDS as readonly string[]).includes(path)) continue;
    if (path === 'time.time') continue;
    if ((MESSAGE_FIELDS as readonly string[]).includes(path) && trigger === 'message_received')
      continue;
    if (path.startsWith('vars.')) {
      const name = path.slice(5).split('.')[0] ?? '';
      if (vars.has(name)) continue;
      return 'undefinedVariable';
    }
    return 'unknownField';
  }
  return null;
}

function schemaOf(fields: SchemaField[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const f of fields) {
    const values = f.type === 'string' ? splitList(f.values) : [];
    properties[f.name] = { type: f.type, ...(values.length && { enum: values }) };
    if (f.required) required.push(f.name);
  }
  return { type: 'object', properties, ...(required.length && { required }) };
}

interface Built {
  action?: AutomationAction;
  error?: RuleError;
  detail?: string;
}

function coerce(text: string, type: string | undefined): unknown {
  const t = text.trim();
  if ((type === 'number' || type === 'integer') && !t.includes('{{')) {
    const n = parseNumber(t);
    return n === null ? text : n;
  }
  if (type === 'boolean' && (t === 'true' || t === 'false')) return t === 'true';
  return text;
}

/** Checks one step against what the rule has defined before it, and builds its action. */
function buildStep(
  s: StepDraft,
  trigger: RuleDraft['trigger'],
  vars: Set<string>,
  fromModel: Set<string>,
): Built {
  const need = (cond: boolean, error: RuleError, detail?: string): Built | null =>
    cond ? null : { error, ...(detail !== undefined && { detail }) };
  const texts = (...ts: string[]): RuleError | null => {
    for (const t of ts) {
      const p = placeholderProblem(t, trigger, vars);
      if (p) return p;
    }
    return null;
  };
  const fail = (error: RuleError, detail?: string): Built => ({
    error,
    ...(detail !== undefined && { detail }),
  });

  if ((s.type === 'reply' || s.type === 'handoff') && trigger !== 'message_received') {
    return fail('conversationOnly');
  }

  const action: AutomationAction = { type: s.type };
  switch (s.type) {
    case 'reply': {
      const text = s.text.trim();
      if (!text || text.length > 1000) return fail('reply');
      const p = texts(text);
      if (p) return fail(p);
      action.text = text;
      break;
    }
    case 'email_business': {
      if (!s.subject.trim() || s.subject.length > 150) return fail('subject');
      if (!s.body.trim() || s.body.length > 4000) return fail('body');
      const p = texts(s.subject, s.body);
      if (p) return fail(p);
      action.subject = s.subject.trim();
      action.body = s.body.trim();
      break;
    }
    case 'connector_call': {
      const bad = need(!!s.connector, 'connector') ?? need(!!s.operation, 'operation');
      if (bad) return bad;
      const args: Record<string, unknown> = {};
      for (const [name, text] of Object.entries(s.args)) {
        if (!text.trim()) continue;
        const p = texts(text);
        if (p) return fail(p, name);
        for (const m of text.matchAll(PLACEHOLDER)) {
          const v = (m[1] ?? '').startsWith('vars.') ? (m[1] ?? '').slice(5).split('.')[0] : '';
          if (v && fromModel.has(v)) return fail('modelInCall', name);
        }
        args[name] = coerce(text, s.argTypes[name]);
      }
      action.connector = s.connector;
      action.operation = s.operation;
      if (Object.keys(args).length) action.arguments = args;
      break;
    }
    case 'handoff': {
      if (s.reason.length > 300) return fail('reply');
      const p = texts(s.reason);
      if (p) return fail(p);
      if (s.reason.trim()) action.reason = s.reason.trim();
      break;
    }
    case 'ai_analyze':
    case 'ai_extract': {
      const prompt = s.prompt.trim();
      if (!prompt || prompt.length > 1500) return fail('prompt');
      if (prompt.includes('{{')) return fail('promptFields');
      if (s.inputs.length > 8) return fail('inputLabel');
      const inputs: Record<string, string> = {};
      for (const i of s.inputs) {
        if (!LABEL.test(i.label) || i.label in inputs) return fail('inputLabel', i.label);
        const p = texts(i.value);
        if (p) return fail(p, i.label);
        inputs[i.label] = i.value;
      }
      if (s.model) action.model = s.model;
      const tokens = s.maxTokens.trim();
      if (tokens) {
        const n = parseNumber(tokens);
        if (n === null || !Number.isInteger(n) || n < 50 || n > 1500) return fail('maxTokens');
        action.max_tokens = n;
      }
      action.prompt = prompt;
      if (Object.keys(inputs).length) action.inputs = inputs;
      if (s.type === 'ai_extract') {
        if (!s.fields.length || s.fields.length > 12) return fail('schemaEmpty');
        const names = new Set<string>();
        for (const f of s.fields) {
          if (!SCHEMA_NAME.test(f.name) || names.has(f.name)) return fail('schemaName', f.name);
          names.add(f.name);
          if (f.type !== 'string' && f.values.trim()) return fail('schemaValues', f.name);
        }
        action.schema = schemaOf(s.fields);
      }
      break;
    }
    case 'knowledge_search': {
      const query = s.query.trim();
      if (!query || query.length > 500) return fail('knowledgeQuery');
      const p = texts(query);
      if (p) return fail(p);
      action.query = query;
      if (s.limit.trim()) {
        const n = parseNumber(s.limit);
        if (n === null || !Number.isInteger(n) || n < 1 || n > 8) return fail('knowledgeLimit');
        action.limit = n;
      }
      break;
    }
    case 'ignis_stats': {
      const n = parseNumber(s.days);
      if (n === null || !Number.isInteger(n) || n < 1 || n > 90) return fail('days');
      action.days = n;
      break;
    }
    case 'whatsapp_template': {
      if (!s.template) return fail('template');
      const to = s.to.trim();
      if (to && !/^[0-9]{8,15}$/.test(to)) return fail('phone');
      if (!to && trigger !== 'message_received') return fail('phone');
      if (s.values.length > 20) return fail('templateValue');
      for (const [i, v] of s.values.entries()) {
        if (!v.trim() || v.length > 1024) return fail('templateValue', String(i + 1));
        const p = texts(v);
        if (p) return fail(p);
      }
      action.template = s.template;
      if (to) action.to = to;
      action.values = s.values.map((v) => v.trim());
      break;
    }
    case 'wait': {
      const n = parseNumber(s.amount);
      const minutes = n === null ? NaN : n * WAIT_UNITS[s.unit];
      if (n === null || !Number.isInteger(minutes) || minutes < 1 || minutes > MAX_WAIT_MINUTES) {
        return fail('waitTime');
      }
      action.minutes = minutes;
      break;
    }
  }

  if (s.type === 'connector_call' ? !!s.as : !NO_RESULT.includes(s.type)) {
    if (!IDENTIFIER.test(s.as)) return fail('variable');
    if (vars.has(s.as)) return fail('variableTaken', s.as);
    action.as = s.as;
  }
  return { action };
}

function buildGuard(
  s: StepDraft,
  trigger: RuleDraft['trigger'],
  vars: Set<string>,
): { guard?: AutomationGuard; error?: RuleError; detail?: string } {
  if (!s.guard.enabled) return {};
  if (!s.guard.conditions.length || s.guard.conditions.length > 10) return { error: 'guardEmpty' };
  const conditions: AutomationCondition[] = [];
  for (const c of s.guard.conditions) {
    if (c.field.startsWith('vars.')) {
      const name = c.field.slice(5).split('.')[0] ?? '';
      // The answer of a reply goes out before any step runs, so it cannot read a variable.
      if (!vars.has(name) || s.type === 'reply') return { error: 'guardVariable', detail: c.field };
    }
    const built = toCondition(c);
    if (!built) return { error: 'conditionValue', detail: c.field };
    conditions.push(built);
  }
  return { guard: { match: s.guard.match, conditions } };
}

/** The rule as the API wants it, or the first thing that is wrong with it. */
export function draftToInput(d: RuleDraft): RuleResult {
  const name = d.name.trim();
  if (!name || name.length > 80) return { ok: false, error: 'name' };

  const trigger: AutomationInput['trigger'] =
    d.trigger === 'schedule'
      ? {
          type: 'schedule',
          schedule: {
            at: d.at,
            timezone: d.timezone,
            ...(d.weekdays.length && { weekdays: [...d.weekdays].sort() }),
          },
        }
      : { type: 'message_received' };
  if (d.trigger === 'schedule') {
    if (!CLOCK.test(d.at)) return { ok: false, error: 'time' };
    if (new Set(d.weekdays).size !== d.weekdays.length || d.weekdays.some((w) => w < 1 || w > 7)) {
      return { ok: false, error: 'weekdays' };
    }
  }

  const conditions: AutomationCondition[] = [];
  for (const c of d.conditions) {
    const built = toCondition(c);
    if (!built) return { ok: false, error: 'conditionValue', detail: c.field };
    conditions.push(built);
  }

  if (!d.steps.length) return { ok: false, error: 'noSteps' };
  if (d.steps.length > MAX_STEPS) return { ok: false, error: 'tooManySteps' };

  const vars = new Set<string>();
  const fromModel = new Set<string>();
  const actions: AutomationAction[] = [];
  let replies = 0;
  let handoffs = 0;
  let waits = 0;
  for (const [i, s] of d.steps.entries()) {
    const guard = buildGuard(s, d.trigger, vars);
    if (guard.error)
      return {
        ok: false,
        error: guard.error,
        step: i,
        ...(guard.detail && { detail: guard.detail }),
      };
    const built = buildStep(s, d.trigger, vars, fromModel);
    if (built.error || !built.action) {
      return {
        ok: false,
        error: built.error ?? 'noSteps',
        step: i,
        ...(built.detail && { detail: built.detail }),
      };
    }
    if (guard.guard) built.action.when = guard.guard;
    if (s.type === 'reply') replies++;
    if (s.type === 'handoff') handoffs++;
    if (s.type === 'wait') {
      waits++;
      if (i === d.steps.length - 1) return { ok: false, error: 'waitLast', step: i };
    }
    if (built.action.as) {
      vars.add(built.action.as);
      if (isAIAction(s.type)) fromModel.add(built.action.as);
    }
    actions.push(built.action);
  }
  if (replies > 1) return { ok: false, error: 'twoReplies' };
  if (handoffs > 1) return { ok: false, error: 'twoHandoffs' };
  if (waits > MAX_WAITS) return { ok: false, error: 'tooManyWaits' };

  const input: AutomationInput = {
    name,
    enabled: d.enabled,
    trigger,
    match: d.match,
    conditions,
    actions,
  };

  if (d.cooldown.trim()) {
    const n = parseNumber(d.cooldown);
    if (n === null || !Number.isInteger(n) || n < 0 || n > 1440)
      return { ok: false, error: 'cooldown' };
    if (n > 0) input.cooldown_minutes = n;
  }
  if (d.budget.trim()) {
    const usd = parseNumber(d.budget);
    if (usd === null || usd < 0 || usd > 0.5) return { ok: false, error: 'budget' };
    if (usd > 0) input.ai_budget_micro = Math.round(usd * 1_000_000);
  }
  return { ok: true, input };
}

// --- reading ------------------------------------------------------------------------------------

/** The names the steps before position `index` define, to offer them as fields. */
export function varsBefore(steps: StepDraft[], index: number): string[] {
  const names: string[] = [];
  for (const s of steps.slice(0, index)) {
    const takes = s.type === 'connector_call' ? !!s.as : !NO_RESULT.includes(s.type);
    if (takes && s.as) names.push(s.as);
  }
  return names;
}

/** What a step of an extraction offers its successors: `vars.<name>.<field>`. */
export function extractedFields(steps: StepDraft[], index: number): string[] {
  const out: string[] = [];
  for (const s of steps.slice(0, index)) {
    if (s.type === 'ai_extract' && s.as)
      for (const f of s.fields) if (f.name) out.push(`vars.${s.as}.${f.name}`);
    if (s.type === 'knowledge_search' && s.as) out.push(`vars.${s.as}.found`, `vars.${s.as}.text`);
  }
  return out;
}

export function microToUsd(micro: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(micro / 1_000_000);
}

/** A stored rule as the API takes it back, to change one thing of it (turn it on or off). */
export function ruleToInput(
  r: AutomationRule,
  over: Partial<AutomationInput> = {},
): AutomationInput {
  return {
    name: r.name,
    enabled: r.enabled,
    trigger: r.trigger,
    match: r.match,
    conditions: r.conditions,
    actions: r.actions,
    ...(r.timezone && { timezone: r.timezone }),
    ...(r.ai_budget_micro && { ai_budget_micro: r.ai_budget_micro }),
    ...(r.cooldown_minutes && { cooldown_minutes: r.cooldown_minutes }),
    ...over,
  };
}
