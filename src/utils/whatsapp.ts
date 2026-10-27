import type { WhatsAppTemplateInput } from '@/api/whatsapp';

// The rules Meta applies to a template, so the form says what is wrong before asking.
export const LIMITS = {
  name: 100,
  body: 1024,
  footer: 60,
  example: 150,
  param: 1024,
  variables: 20,
} as const;

/** The languages offered; Meta accepts others, which an operator can still write in the API. */
export const LANGUAGES = [
  'es',
  'es_CO',
  'es_MX',
  'es_AR',
  'es_ES',
  'en',
  'en_US',
  'pt_BR',
] as const;

const VARIABLE = /\{\{\s*(\d+)\s*\}\}/g;

/** The numbers of the variables a body has, in the order they appear. */
export function variablesOf(body: string): number[] {
  return [...body.matchAll(VARIABLE)].map((m) => Number(m[1]));
}

/**
 * A name Meta accepts from what a person typed: lowercase, without accents, words joined by
 * underscores. "Pedido listo!" gives "pedido_listo".
 */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, LIMITS.name);
}

export type BodyProblem = 'required' | 'long' | 'braces' | 'order' | 'adjacent' | 'edge' | 'many';

/** What is wrong with the body, if anything. */
export function bodyProblem(body: string): BodyProblem | null {
  const text = body.trim();
  if (text === '') return 'required';
  if ([...text].length > LIMITS.body) return 'long';
  const found = [...text.matchAll(VARIABLE)];
  if ((text.match(/\{\{|\}\}/g) ?? []).length !== found.length * 2) return 'braces';
  if (found.length > LIMITS.variables) return 'many';
  let previousEnd = -1;
  for (const [i, m] of found.entries()) {
    if (Number(m[1]) !== i + 1) return 'order';
    const start = m.index;
    if (start === previousEnd) return 'adjacent';
    previousEnd = start + m[0].length;
  }
  const first = found[0];
  const last = found[found.length - 1];
  if (first && last && (first.index === 0 || previousEnd === text.length)) return 'edge';
  return null;
}

export type TemplateField = 'name' | 'body' | 'footer' | 'examples';
export type TemplateProblem = BodyProblem | 'name' | 'footer' | 'examples';

/** What is wrong with the form, field by field; an empty object when it can be sent. */
export function templateProblems(
  t: WhatsAppTemplateInput,
): Partial<Record<TemplateField, TemplateProblem>> {
  const found: Partial<Record<TemplateField, TemplateProblem>> = {};
  if (!/^[a-z0-9_]{1,100}$/.test(t.name)) found.name = 'name';
  const body = bodyProblem(t.body);
  if (body) found.body = body;
  else {
    const n = variablesOf(t.body.trim()).length;
    const examples = t.examples.slice(0, n);
    if (
      t.examples.length !== n ||
      examples.some((e) => e.trim() === '' || [...e].length > LIMITS.example || /[\r\n\t]/.test(e))
    ) {
      found.examples = 'examples';
    }
  }
  if ([...t.footer].length > LIMITS.footer || t.footer.includes('{{') || t.footer.includes('\n')) {
    found.footer = 'footer';
  }
  return found;
}

/** The body as the contact will read it, with the examples where the variables are. */
export function preview(body: string, examples: string[]): string {
  return body.replace(VARIABLE, (_all, n: string) => examples[Number(n) - 1]?.trim() || `{{${n}}}`);
}

export type ParamProblem = 'required' | 'long' | 'lines' | 'spaces';

/** What is wrong with a value a template is sent with, if anything. */
export function paramProblem(value: string): ParamProblem | null {
  if (value.trim() === '') return 'required';
  if ([...value].length > LIMITS.param) return 'long';
  if (/[\r\n\t]/.test(value)) return 'lines';
  if (/ {5,}/.test(value)) return 'spaces';
  return null;
}

/** Whether a number is written as Meta wants it: digits with the country code. */
export const validPhone = (to: string): boolean => /^[0-9]{8,15}$/.test(to.trim());

/** The number of the account Meta shows: digits only. */
export const validAccountId = (id: string): boolean => id === '' || /^[0-9]{1,40}$/.test(id);

/** A fresh form. */
export const emptyTemplate = (): WhatsAppTemplateInput => ({
  name: '',
  language: 'es',
  category: 'utility',
  body: '',
  examples: [],
  footer: '',
});

/** The examples of a form kept the size of the variables of its body. */
export function fitExamples(body: string, examples: string[]): string[] {
  const n = variablesOf(body).length;
  return Array.from({ length: n }, (_, i) => examples[i] ?? '');
}
