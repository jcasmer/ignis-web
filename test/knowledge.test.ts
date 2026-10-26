import { describe, expect, it } from 'vitest';

import { knowledgeClient } from '@/api/knowledge';
import type { Http } from '@/api/http';
import { clip, scoreText, strategyKey } from '@/utils/knowledge';

describe('knowledge helpers', () => {
  it('names how a document was cut by its format', () => {
    expect(strategyKey('markdown')).toBe('markdown');
    expect(strategyKey('paged')).toBe('paged');
  });

  it('writes the score with four decimals', () => {
    expect(scoreText(0.032258)).toBe('0.0323');
  });

  it('cuts a long passage at a word and leaves a short one alone', () => {
    expect(clip('corto')).toBe('corto');
    const out = clip('palabra '.repeat(80), 100);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(101);
    expect(out).not.toMatch(/palabr…$/);
  });
});

describe('knowledgeClient', () => {
  const calls: string[] = [];
  const http = {
    get: (url: string) => {
      calls.push(`GET ${url}`);
      return Promise.resolve({ items: [] });
    },
    post: (url: string) => {
      calls.push(`POST ${url}`);
      return Promise.resolve({});
    },
    del: (url: string) => {
      calls.push(`DELETE ${url}`);
      return Promise.resolve(undefined);
    },
  } as unknown as Http;

  it('only the operator client can look inside a base', async () => {
    expect(knowledgeClient(http, '/knowledge').chunks).toBeUndefined();
    expect(knowledgeClient(http, '/knowledge').search).toBeUndefined();

    const ops = knowledgeClient(http, '/ops/tenants/t1/knowledge', { inspect: true });
    await ops.chunks?.('doc 1');
    await ops.search?.('horario sábado', 3);
    expect(calls).toContain('GET /ops/tenants/t1/knowledge/documents/doc%201/chunks');
    expect(calls).toContain('GET /ops/tenants/t1/knowledge/search?q=horario+s%C3%A1bado&limit=3');
  });
});
