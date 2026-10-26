import { describe, expect, it } from 'vitest';

import { newDemoSession, SESSION_PATTERN, SUGGESTIONS } from '@/utils/demo';

describe('demo helpers', () => {
  it('makes sessions the API accepts, all different', () => {
    const a = newDemoSession();
    const b = newDemoSession();
    expect(SESSION_PATTERN.test(a)).toBe(true);
    expect(a).not.toBe(b);
  });

  it('offers starting messages that fit the limit of a message', () => {
    expect(SUGGESTIONS.length).toBeGreaterThanOrEqual(4);
    for (const s of SUGGESTIONS)
      expect(new TextEncoder().encode(s).length).toBeLessThanOrEqual(1000);
  });
});
