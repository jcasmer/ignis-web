import { describe, expect, it } from 'vitest';

import { modelName, providerLabel, providerOptions, providersOf } from '@/utils/models';

describe('models', () => {
  it('names the providers people know', () => {
    expect(providerLabel('google')).toBe('Google');
    expect(providerLabel('deepseek')).toBe('DeepSeek');
    expect(providerLabel('mistral')).toBe('Mistral');
  });

  it('splits provider and model, and lists each provider once in order', () => {
    expect(modelName('google:gemini-2.5-flash')).toBe('gemini-2.5-flash');
    expect(providersOf(['openai:a', 'google:b', 'openai:c'])).toEqual(['openai', 'google']);
  });
});

describe('providerOptions', () => {
  const reasons = { available: '', not_configured: 'sin clave', no_price: 'sin precio' };
  const platform = [
    { id: 'gemini', status: 'available' as const },
    { id: 'anthropic', status: 'not_configured' as const },
    { id: 'deepseek', status: 'no_price' as const },
  ];

  it('shows every provider and disables the ones that cannot be chosen, with the reason', () => {
    const out = providerOptions(platform, ['gemini:a'], '', reasons);
    expect(out.map((o) => o.value)).toEqual(['gemini', 'anthropic', 'deepseek']);
    expect(out.map((o) => o.disable)).toEqual([false, true, true]);
    expect(out[1]?.label).toBe('Anthropic — sin clave');
    expect(out[2]?.label).toBe('DeepSeek — sin precio');
  });

  it('keeps enabled the provider already in use, so a saved choice is not lost', () => {
    const out = providerOptions(platform, [], 'anthropic', reasons);
    expect(out[1]).toEqual({ value: 'anthropic', label: 'Anthropic', disable: false });
  });

  it('falls back to the providers of the models when the platform sends none', () => {
    const out = providerOptions([], ['openai:x', 'google:y', 'openai:z'], '', reasons);
    expect(out.map((o) => o.value)).toEqual(['openai', 'google']);
    expect(out.every((o) => !o.disable)).toBe(true);
  });
});
