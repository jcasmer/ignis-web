import { createI18n } from 'vue-i18n';
import { describe, expect, it, vi } from 'vitest';

import messages from '@/i18n';

function leaves(node: unknown, path: string, out: [string, string][]) {
  if (typeof node === 'string') out.push([path, node]);
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) leaves(v, path ? `${path}.${k}` : k, out);
  }
}

describe('i18n messages', () => {
  it("every message compiles (a literal {{ must be written as {'{{'})", () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const i18n = createI18n({ legacy: false, locale: 'es-ES', messages });
    const all: [string, string][] = [];
    leaves(messages['es-ES'], '', all);
    const broken: string[] = [];
    for (const [path] of all) {
      try {
        i18n.global.t(path, { n: 1, count: 1 });
      } catch {
        broken.push(path);
      }
    }
    warn.mockRestore();
    expect(broken).toEqual([]);
  });
});
