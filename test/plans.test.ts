import { describe, expect, it } from 'vitest';

import type { Plan } from '@/api/ops';
import { aiOf, creditOf, formOf, inputOf, planIdFrom, planProblems } from '@/utils/plans';

const plan: Plan = {
  id: 'con-ia',
  name: 'Con IA',
  description: 'Asistente',
  kind: 'standard',
  price_minor: 19_900_000,
  currency: 'COP',
  modules: ['agents', 'knowledge'],
  limits: { users: 5, 'llm.plan_allowance_micro': 5_000_000 },
  active: true,
  tenants: 2,
  updated_at: '2026-10-27T00:00:00Z',
};

describe('plans', () => {
  it('reads the credit and the kind of AI a plan includes', () => {
    expect(creditOf(plan)).toBe(5_000_000);
    expect(creditOf({ limits: {} })).toBe(0);
    expect(aiOf({ modules: ['automations'] })).toBe('none');
    expect(aiOf(plan)).toBe('assistant');
    expect(aiOf({ modules: ['agents', 'automations.ai'] })).toBe('full');
  });

  it('suggests an id from the name', () => {
    expect(planIdFrom('Plan Básico 2026')).toBe('plan-basico-2026');
    expect(planIdFrom('  ¡Premium!  ')).toBe('premium');
    expect(planIdFrom('123')).toBe('');
  });

  it('turns a plan into a form and back without losing anything', () => {
    const f = formOf(plan);
    expect(f.price).toBe('199000');
    expect(f.credit).toBe('5');
    expect(f.limits).toEqual({ users: 5 });
    const body = inputOf(f, false);
    expect(body).toMatchObject({
      price_minor: 19_900_000,
      currency: 'COP',
      modules: ['agents', 'knowledge'],
    });
    expect(body?.limits).toEqual({ users: 5, 'llm.plan_allowance_micro': 5_000_000 });
    expect(body && 'id' in body).toBe(false);
  });

  it('asks for an id only when creating', () => {
    const f = { ...formOf(), name: 'Nuevo', price: '100' };
    expect(planProblems(f, true)).toEqual(['id']);
    expect(planProblems({ ...f, id: 'nuevo' }, true)).toEqual([]);
    expect(planProblems(f, false)).toEqual([]);
    expect(inputOf({ ...f, id: 'nuevo' }, true)?.id).toBe('nuevo');
  });

  it('flags a name, a price, a currency and a credit that make no sense', () => {
    const f = { ...formOf(), id: 'x1', name: ' ', price: 'abc', currency: 'pesos', credit: '-3' };
    expect(planProblems(f, true)).toEqual(['name', 'price', 'currency', 'credit']);
    expect(inputOf(f, true)).toBeNull();
  });
});
