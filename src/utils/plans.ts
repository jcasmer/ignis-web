import type { Plan, PlanInput } from '@/api/ops';
import { majorToMinor } from '@/utils/validate';

/** The limit that holds the AI credit a plan includes each period, in micro-USD. */
export const ALLOWANCE_KEY = 'llm.plan_allowance_micro';

/** What a plan includes of AI each period, in micro-USD. */
export const creditOf = (p: Pick<Plan, 'limits'>): number => p.limits[ALLOWANCE_KEY] ?? 0;

/** Whether a plan includes the assistant with AI, the AI steps of automations, or neither. */
export function aiOf(p: Pick<Plan, 'modules'>): 'none' | 'assistant' | 'full' {
  if (p.modules.includes('automations.ai')) return 'full';
  return p.modules.includes('agents') ? 'assistant' : 'none';
}

const PLAN_ID = /^[a-z][a-z0-9-]{1,39}$/;

/** A suggestion for the id of a plan from its name: lowercase, ASCII, dashes. */
export function planIdFrom(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^[^a-z]+/, '')
    .replace(/-+$/g, '')
    .slice(0, 40);
}

export interface PlanForm {
  id: string;
  name: string;
  description: string;
  kind: 'standard' | 'custom';
  price: string;
  currency: string;
  /** AI credit per period, in USD, as typed. */
  credit: string;
  modules: string[];
  /** The limits the form sets, by key. */
  limits: Record<string, number>;
  active: boolean;
}

export type PlanProblem = 'id' | 'name' | 'price' | 'currency' | 'credit';

/** What is wrong with the form, if anything; the API checks everything again. */
export function planProblems(f: PlanForm, creating: boolean): PlanProblem[] {
  const out: PlanProblem[] = [];
  if (creating && !PLAN_ID.test(f.id)) out.push('id');
  if (!f.name.trim() || f.name.trim().length > 80) out.push('name');
  if (majorToMinor(f.price) === null) out.push('price');
  if (!/^[A-Z]{3}$/.test(f.currency.trim().toUpperCase())) out.push('currency');
  if (usd(f.credit) === null) out.push('credit');
  return out;
}

function usd(text: string): number | null {
  const clean = text.trim().replace(/\s/g, '').replace(',', '.');
  if (clean === '') return 0;
  if (!/^\d+(\.\d{1,6})?$/.test(clean)) return null;
  const [whole, frac = ''] = clean.split('.');
  return Number(whole) * 1_000_000 + Number(frac.padEnd(6, '0'));
}

/** The form for an existing plan, or the empty one. */
export function formOf(p?: Plan): PlanForm {
  if (!p) {
    return {
      id: '',
      name: '',
      description: '',
      kind: 'standard',
      price: '',
      currency: 'COP',
      credit: '0',
      modules: [],
      limits: {},
      active: true,
    };
  }
  const { [ALLOWANCE_KEY]: credit = 0, ...limits } = p.limits;
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    kind: p.kind,
    price: String(p.price_minor / 100),
    currency: p.currency,
    credit: String(credit / 1_000_000),
    modules: [...p.modules],
    limits,
    active: p.active,
  };
}

/** The body the API takes; null when the form has a problem. */
export function inputOf(f: PlanForm, creating: boolean): PlanInput | null {
  if (planProblems(f, creating).length) return null;
  const limits: Record<string, number> = { ...f.limits };
  limits[ALLOWANCE_KEY] = usd(f.credit) ?? 0;
  return {
    ...(creating && { id: f.id }),
    name: f.name.trim(),
    description: f.description.trim(),
    kind: f.kind,
    price_minor: majorToMinor(f.price) ?? 0,
    currency: f.currency.trim().toUpperCase(),
    modules: f.modules,
    limits,
    active: f.active,
  };
}
