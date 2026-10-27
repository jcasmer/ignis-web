import { describe, expect, it } from 'vitest';

import type { AutomationTemplate, TemplateParam } from '@/api/automations';
import { answerProblem, answerProblems, defaultAnswers, inCategory } from '@/utils/templates';

const param = (kind: TemplateParam['kind']): TemplateParam => ({
  id: 'x',
  label: 'X',
  kind,
  default: '',
});

const tpl = (id: string, category: AutomationTemplate['category']): AutomationTemplate => ({
  id,
  name: id,
  summary: '',
  category,
  trigger: 'message_received',
  needs: [],
  params: [
    { id: 'open', label: 'Apertura', kind: 'hour', default: '8' },
    { id: 'text', label: 'Mensaje', kind: 'longtext', default: 'Hola' },
  ],
});

describe('the answers of a template', () => {
  it('start with what each question suggests', () => {
    expect(defaultAnswers(tpl('a', 'alerts'))).toEqual({ open: '8', text: 'Hola' });
  });

  it('are required whatever the kind', () => {
    for (const k of ['text', 'longtext', 'hour', 'time', 'list'] as const) {
      expect(answerProblem(param(k), '   ')).toBe('required');
    }
  });

  it('check an hour from 0 to 23', () => {
    expect(answerProblem(param('hour'), '0')).toBeNull();
    expect(answerProblem(param('hour'), '23')).toBeNull();
    expect(answerProblem(param('hour'), '24')).toBe('hour');
    expect(answerProblem(param('hour'), '8am')).toBe('hour');
    expect(answerProblem(param('hour'), '-1')).toBe('hour');
  });

  it('check a time as HH:MM', () => {
    expect(answerProblem(param('time'), '07:30')).toBeNull();
    expect(answerProblem(param('time'), '7:30')).toBe('time');
    expect(answerProblem(param('time'), '24:00')).toBe('time');
  });

  it('check that a list has words, not only commas, and not too many', () => {
    expect(answerProblem(param('list'), 'precio, horario')).toBeNull();
    expect(answerProblem(param('list'), ' , , ')).toBe('words');
    expect(answerProblem(param('list'), Array.from({ length: 21 }, () => 'a').join(','))).toBe(
      'words',
    );
  });

  it('are reported by question', () => {
    expect(answerProblems(tpl('a', 'alerts'), { open: '99', text: 'Hola' })).toEqual({
      open: 'hour',
    });
    expect(answerProblems(tpl('a', 'alerts'), { open: '8', text: 'Hola' })).toEqual({});
  });
});

describe('the gallery', () => {
  const all = [tpl('a', 'alerts'), tpl('b', 'reports'), tpl('c', 'alerts')];

  it('filters by category and shows all by default', () => {
    expect(inCategory(all, 'all')).toHaveLength(3);
    expect(inCategory(all, 'alerts').map((t) => t.id)).toEqual(['a', 'c']);
    expect(inCategory(all, 'attention')).toEqual([]);
  });
});
