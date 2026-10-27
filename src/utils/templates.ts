import type { AutomationTemplate, TemplateParam } from '@/api/automations';

export const CATEGORIES: AutomationTemplate['category'][] = ['attention', 'alerts', 'reports'];

/** The answers a template starts with: what each question suggests. */
export const defaultAnswers = (tpl: AutomationTemplate): Record<string, string> =>
  Object.fromEntries(tpl.params.map((p) => [p.id, p.default]));

export type AnswerProblem = 'required' | 'hour' | 'time' | 'words';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** What is wrong with one answer, so the form says it before asking the server; null when it is fine. */
export function answerProblem(p: TemplateParam, value: string): AnswerProblem | null {
  const v = value.trim();
  if (v === '') return 'required';
  switch (p.kind) {
    case 'hour':
      return /^\d{1,2}$/.test(v) && Number(v) <= 23 ? null : 'hour';
    case 'time':
      return TIME.test(v) ? null : 'time';
    case 'list': {
      const words = v.split(',').filter((w) => w.trim() !== '');
      return words.length >= 1 && words.length <= 20 ? null : 'words';
    }
    default:
      return null;
  }
}

/** The questions that have a problem, by id. */
export function answerProblems(
  tpl: AutomationTemplate,
  answers: Record<string, string>,
): Record<string, AnswerProblem> {
  const found: Record<string, AnswerProblem> = {};
  for (const p of tpl.params) {
    const why = answerProblem(p, answers[p.id] ?? '');
    if (why) found[p.id] = why;
  }
  return found;
}

/** The templates of a category, or all of them. */
export const inCategory = (
  list: AutomationTemplate[],
  category: AutomationTemplate['category'] | 'all',
): AutomationTemplate[] =>
  category === 'all' ? list : list.filter((t) => t.category === category);
