import type { AssistantProfile, AssistantProfileInput, AssistantTone } from '@/api/assistant';

// The limits of the API, so a form says what is wrong before asking.
export const LIMITS = {
  businessName: 80,
  about: 1000,
  greeting: 300,
  language: 40,
  rules: 10,
  rule: 200,
  extra: 1500,
} as const;

export const TONES: AssistantTone[] = ['friendly', 'formal', 'enthusiastic', 'neutral'];

/** What the form edits: the rules are a text with one per line. */
export interface ProfileDraft {
  businessName: string;
  about: string;
  tone: AssistantTone | '';
  language: string;
  greeting: string;
  always: string;
  never: string;
  extra: string;
}

export const emptyDraft = (): ProfileDraft => ({
  businessName: '',
  about: '',
  tone: '',
  language: '',
  greeting: '',
  always: '',
  never: '',
  extra: '',
});

export const draftFrom = (p: AssistantProfileInput): ProfileDraft => ({
  businessName: p.business_name,
  about: p.about,
  tone: p.tone,
  language: p.language,
  greeting: p.greeting,
  always: p.always.join('\n'),
  never: p.never.join('\n'),
  extra: p.extra,
});

/** The rules of a text: one per line, without empty lines. */
export const rulesOf = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '');

export const toInput = (d: ProfileDraft): AssistantProfileInput => ({
  business_name: d.businessName.trim(),
  about: d.about.trim(),
  tone: d.tone,
  language: d.language.trim(),
  greeting: d.greeting.trim(),
  always: rulesOf(d.always),
  never: rulesOf(d.never),
  extra: d.extra.trim(),
});

export type ProfileField =
  'businessName' | 'about' | 'language' | 'greeting' | 'always' | 'never' | 'extra';

const len = (s: string) => [...s.trim()].length;

/** The placeholders of a text that are not among the allowed ones, and whether one is left open. */
export function placeholderProblem(text: string, allowed: readonly string[]): string | null {
  let rest = text;
  for (;;) {
    const open = rest.indexOf('{{');
    if (open < 0) return /}}/.test(rest) ? '}}' : null;
    if (/}}/.test(rest.slice(0, open))) return '}}';
    const close = rest.indexOf('}}', open + 2);
    if (close < 0) return '{{';
    const name = rest.slice(open + 2, close).trim();
    if (!allowed.includes(name)) return `{{${name}}}`;
    rest = rest.slice(close + 2);
  }
}

/**
 * What is wrong with the form, field by field; an empty object when it can be sent.
 * `variables` are the placeholders the API says may be used.
 */
export function problems(
  d: ProfileDraft,
  variables: readonly string[],
): Partial<Record<ProfileField, string>> {
  const found: Partial<Record<ProfileField, string>> = {};
  if (len(d.businessName) > LIMITS.businessName) found.businessName = 'long';
  if (len(d.language) > LIMITS.language) found.language = 'long';
  const long: [ProfileField, string, number][] = [
    ['about', d.about, LIMITS.about],
    ['greeting', d.greeting, LIMITS.greeting],
    ['extra', d.extra, LIMITS.extra],
  ];
  for (const [field, text, max] of long) {
    if (len(text) > max) found[field] = 'long';
    else if (placeholderProblem(text, variables)) found[field] = 'placeholder';
  }
  for (const [field, text] of [
    ['always', d.always],
    ['never', d.never],
  ] as const) {
    const rules = rulesOf(text);
    if (rules.length > LIMITS.rules) found[field] = 'many';
    else if (rules.some((r) => [...r].length > LIMITS.rule)) found[field] = 'longRule';
    else if (rules.some((r) => placeholderProblem(r, variables))) found[field] = 'placeholder';
  }
  return found;
}

/** The same profile, for comparing what is saved with what is on the form. */
export const sameProfile = (a: AssistantProfileInput, b: AssistantProfileInput): boolean =>
  JSON.stringify(toInput(draftFrom(a))) === JSON.stringify(toInput(draftFrom(b)));

export const profileIsEmpty = (p: Pick<AssistantProfile, 'is_default'>): boolean => p.is_default;
