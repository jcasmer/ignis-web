import type { ModelPriceItem } from '@/api/ops';

import { usdToMicro } from './plan';

/** The providers the platform can talk to, as the API names them. */
export const PROVIDERS = ['anthropic', 'openai', 'gemini', 'deepseek'] as const;

export const PROVIDER_LABEL: Record<string, string> = {
  anthropic: 'Claude (Anthropic)',
  openai: 'OpenAI',
  gemini: 'Gemini (Google)',
  deepseek: 'DeepSeek',
};

export interface ModelGroup {
  provider: string;
  model: string;
  /** The price charged today, if any. */
  current: ModelPriceItem | null;
  /** Prices that begin later, soonest first. */
  scheduled: ModelPriceItem[];
}

/** Every model once, with the price in force and the ones still to come. */
export function groupByModel(items: ModelPriceItem[], now = new Date()): ModelGroup[] {
  const groups = new Map<string, ModelGroup>();
  for (const p of items) {
    const key = `${p.provider}/${p.model}`;
    let g = groups.get(key);
    if (!g) {
      g = { provider: p.provider, model: p.model, current: null, scheduled: [] };
      groups.set(key, g);
    }
    if (p.in_force) g.current = p;
    else if (new Date(p.effective_from) > now) g.scheduled.push(p);
  }
  for (const g of groups.values()) {
    g.scheduled.sort((a, b) => a.effective_from.localeCompare(b.effective_from));
  }
  return [...groups.values()].sort(
    (a, b) => a.provider.localeCompare(b.provider) || a.model.localeCompare(b.model),
  );
}

export interface PriceForm {
  provider: string;
  model: string;
  input: string;
  output: string;
  /** `now` starts at once; otherwise `from` is the day it begins. */
  start: 'now' | 'date';
  from: string;
  sourceUrl: string;
  verifiedOn: string;
}

export type PriceFormError = 'model' | 'amount' | 'date' | 'source' | 'verified';

/** The form as the API wants it, or what is wrong with it. */
export function toPriceBody(
  f: PriceForm,
  now = new Date(),
): { ok: true; body: Omit<ModelPriceItem, 'in_force'> } | { ok: false; error: PriceFormError } {
  const model = f.model.trim();
  if (!f.provider || !/^[\w.:/-]{1,100}$/.test(model)) return { ok: false, error: 'model' };
  const input = usdToMicro(f.input);
  const output = usdToMicro(f.output);
  if (input === null || output === null) return { ok: false, error: 'amount' };

  let effective: Date;
  if (f.start === 'now') {
    // A minute back: the clocks of the browser and the server never agree exactly.
    effective = new Date(now.getTime() - 60_000);
  } else {
    effective = new Date(`${f.from}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.from) || Number.isNaN(effective.getTime())) {
      return { ok: false, error: 'date' };
    }
  }

  try {
    const u = new URL(f.sourceUrl.trim());
    if (u.protocol !== 'https:') return { ok: false, error: 'source' };
  } catch {
    return { ok: false, error: 'source' };
  }

  const verified = new Date(`${f.verifiedOn}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(f.verifiedOn) ||
    Number.isNaN(verified.getTime()) ||
    verified > now
  ) {
    return { ok: false, error: 'verified' };
  }

  return {
    ok: true,
    body: {
      provider: f.provider,
      model,
      input_micro_per_mtok: input,
      output_micro_per_mtok: output,
      effective_from: effective.toISOString(),
      source_url: f.sourceUrl.trim(),
      verified_on: f.verifiedOn,
    },
  };
}

export function today(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
