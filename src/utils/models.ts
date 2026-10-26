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
