import type { ModelProvider } from '@/api/automations';

/** The providers an AI model can come from, with the name people know them by. */
const NAMES: Record<string, string> = {
  google: 'Google',
  gemini: 'Google',
  anthropic: 'Anthropic',
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
};

export const providerLabel = (provider: string): string =>
  NAMES[provider] ?? provider.charAt(0).toUpperCase() + provider.slice(1);

/** "google:gemini-2.5-flash" → "gemini-2.5-flash". */
export const modelName = (ref: string): string => ref.slice(ref.indexOf(':') + 1);

/** The providers of a list of "provider:model", in the order they first appear, once each. */
export function providersOf(models: string[]): string[] {
  const out: string[] = [];
  for (const m of models) {
    const p = m.split(':', 1)[0] ?? '';
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
}

export interface ProviderOption {
  value: string;
  label: string;
  disable: boolean;
}

/**
 * The providers to offer: every one the platform knows, in its order. One that cannot be
 * chosen is shown disabled with the reason; the one already in use stays enabled so a saved
 * choice is never lost. Without the platform's list, the providers of the models.
 */
export function providerOptions(
  providers: ModelProvider[],
  models: string[],
  current: string,
  reasons: Record<ModelProvider['status'], string>,
): ProviderOption[] {
  const known: ModelProvider[] = providers.length
    ? providers
    : providersOf(models).map((id) => ({ id, status: 'available' as const }));
  const out = known.map((p) => {
    const usable = p.status === 'available' || p.id === current;
    return {
      value: p.id,
      label: usable ? providerLabel(p.id) : `${providerLabel(p.id)} — ${reasons[p.status]}`,
      disable: !usable,
    };
  });
  if (current && !out.some((o) => o.value === current)) {
    out.push({ value: current, label: providerLabel(current), disable: false });
  }
  return out;
}
