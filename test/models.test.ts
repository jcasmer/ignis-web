import { describe, expect, it } from 'vitest';

import { modelName, providerLabel, providersOf } from '@/utils/models';

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
