import { describe, expect, it } from 'vitest';

import { actionKey, actionKeys, factsOf } from '@/utils/audit';

describe('audit', () => {
  it('names an action key without dots', () => {
    expect(actionKey('ops.plans.put')).toBe('audit.actions.ops_plans_put');
  });

  it('falls back from what the team did on a client to the action itself', () => {
    expect(actionKeys('ops.tenants.automations.put')).toEqual([
      'audit.actions.ops_tenants_automations_put',
      'audit.actions.automations_put',
    ]);
    expect(actionKeys('users.post')).toEqual(['audit.actions.users_post']);
  });

  it('lists the detail first and the ids of the path after, without the main id', () => {
    expect(
      factsOf({ detail: { plan_id: 'premium', empty: '' }, target: { id: 'abc', rule: 'r1' } }),
    ).toEqual(['plan_id: premium', 'rule: r1']);
  });
});
