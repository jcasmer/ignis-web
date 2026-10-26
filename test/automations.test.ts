import { describe, expect, it } from 'vitest';

import type { AutomationRule } from '@/api/automations';
import {
  draftToInput,
  emptyCondition,
  emptyRule,
  emptyStep,
  extractedFields,
  fieldKind,
  opsFor,
  ruleToDraft,
  usesAI,
  varsBefore,
  type RuleDraft,
  type StepDraft,
} from '@/utils/automations';

function step(type: StepDraft['type'], over: Partial<StepDraft> = {}): StepDraft {
  return { ...emptyStep(type), ...over };
}

function rule(over: Partial<RuleDraft> = {}): RuleDraft {
  return {
    ...emptyRule('plain'),
    name: 'Horario',
    conditions: [{ field: 'message.text', op: 'contains_any', text: 'horario, hora', flag: true }],
    steps: [step('reply', { text: 'Abrimos de 9 a 6, {{contact.name}}.' })],
    ...over,
  };
}

function ok(d: RuleDraft) {
  const r = draftToInput(d);
  if (!r.ok) throw new Error(`expected a rule, got ${r.error} (${r.detail ?? ''})`);
  return r.input;
}

const error = (d: RuleDraft) => {
  const r = draftToInput(d);
  return r.ok ? null : r;
};

describe('draftToInput', () => {
  it('builds a rule of a message with a list of words and a fixed reply', () => {
    const input = ok(rule());
    expect(input).toEqual({
      name: 'Horario',
      enabled: true,
      trigger: { type: 'message_received' },
      match: 'all',
      conditions: [{ field: 'message.text', op: 'contains_any', value: ['horario', 'hora'] }],
      actions: [{ type: 'reply', text: 'Abrimos de 9 a 6, {{contact.name}}.' }],
    });
  });

  it('builds a schedule with its days sorted, its zone, a cooldown and a budget', () => {
    const input = ok(
      rule({
        trigger: 'schedule',
        at: '08:30',
        weekdays: [5, 1],
        timezone: 'America/Bogota',
        conditions: [],
        steps: [step('email_business', { subject: 'Resumen', body: 'Hola' })],
        cooldown: '30',
        budget: '0,25',
      }),
    );
    expect(input.trigger).toEqual({
      type: 'schedule',
      schedule: { at: '08:30', weekdays: [1, 5], timezone: 'America/Bogota' },
    });
    expect(input.cooldown_minutes).toBe(30);
    expect(input.ai_budget_micro).toBe(250_000);
  });

  it('turns the values of a condition into what each field and operator expect', () => {
    const input = ok(
      rule({
        conditions: [
          { field: 'contact.is_new', op: 'equals', text: '', flag: false },
          { field: 'time.hour', op: 'gte', text: '9', flag: true },
          { field: 'time.weekday', op: 'in', text: '1, 2,3', flag: true },
          { field: 'contact.name', op: 'exists', text: '', flag: true },
          { field: 'message.channel', op: 'equals', text: ' whatsapp ', flag: true },
        ],
      }),
    );
    expect(input.conditions).toEqual([
      { field: 'contact.is_new', op: 'equals', value: false },
      { field: 'time.hour', op: 'gte', value: 9 },
      { field: 'time.weekday', op: 'in', value: [1, 2, 3] },
      { field: 'contact.name', op: 'exists' },
      { field: 'message.channel', op: 'equals', value: 'whatsapp' },
    ]);
  });

  it('sends the arguments of a call with the type the operation gives them', () => {
    const input = ok(
      rule({
        steps: [
          step('connector_call', {
            connector: 'crm',
            operation: 'find',
            as: 'c',
            args: { id: '42', activo: 'true', q: '{{contact.name}}', vacio: '  ' },
            argTypes: { id: 'integer', activo: 'boolean', q: 'string', vacio: 'string' },
          }),
        ],
      }),
    );
    expect(input.actions[0]).toEqual({
      type: 'connector_call',
      connector: 'crm',
      operation: 'find',
      as: 'c',
      arguments: { id: 42, activo: true, q: '{{contact.name}}' },
    });
  });

  it('builds the model steps with their instruction, inputs, schema and the condition on their answer', () => {
    const input = ok(
      rule({
        steps: [
          step('ignis_stats', { as: 's', days: '14' }),
          step('ai_extract', {
            as: 'c',
            prompt: 'Clasifica la queja.',
            inputs: [
              { label: 'Mensaje', value: '{{message.text}}' },
              { label: 'Cifras', value: '{{vars.s}}' },
            ],
            fields: [
              { name: 'urgencia', type: 'string', values: 'alta, media, baja', required: true },
              { name: 'tema', type: 'string', values: '', required: false },
              { name: 'monto', type: 'number', values: '', required: false },
            ],
            maxTokens: '300',
          }),
          step('email_business', {
            subject: 'Queja {{vars.c.urgencia}}',
            body: 'b',
            guard: {
              enabled: true,
              match: 'all',
              conditions: [{ field: 'vars.c.urgencia', op: 'equals', text: 'alta', flag: true }],
            },
          }),
        ],
      }),
    );
    expect(input.actions[0]).toEqual({ type: 'ignis_stats', as: 's', days: 14 });
    expect(input.actions[1]).toMatchObject({
      type: 'ai_extract',
      as: 'c',
      prompt: 'Clasifica la queja.',
      inputs: { Mensaje: '{{message.text}}', Cifras: '{{vars.s}}' },
      max_tokens: 300,
      schema: {
        type: 'object',
        required: ['urgencia'],
        properties: {
          urgencia: { type: 'string', enum: ['alta', 'media', 'baja'] },
          tema: { type: 'string' },
          monto: { type: 'number' },
        },
      },
    });
    expect(input.actions[2]?.when).toEqual({
      match: 'all',
      conditions: [{ field: 'vars.c.urgencia', op: 'equals', value: 'alta' }],
    });
  });

  it.each([
    ['name', { name: ' ' }],
    ['time', { trigger: 'schedule' as const, at: '9:00' }],
    ['weekdays', { trigger: 'schedule' as const, conditions: [], weekdays: [1, 1] }],
    ['noSteps', { steps: [] }],
    ['cooldown', { cooldown: '2000' }],
    ['budget', { budget: '0,6' }],
    [
      'conditionValue',
      { conditions: [{ field: 'time.hour', op: 'gte' as const, text: 'nueve', flag: true }] },
    ],
    [
      'conditionValue',
      { conditions: [{ field: 'message.text', op: 'contains' as const, text: ' ', flag: true }] },
    ],
  ])('refuses %s', (code, over) => {
    expect(error(rule(over as Partial<RuleDraft>))?.error).toBe(code);
  });

  it('refuses a rule with more than ten steps', () => {
    const steps = Array.from({ length: 11 }, () =>
      step('email_business', { subject: 'a', body: 'b' }),
    );
    expect(error(rule({ steps }))?.error).toBe('tooManySteps');
  });

  it('points at the step that is wrong', () => {
    const d = rule({
      steps: [step('reply', { text: 'ok' }), step('email_business', { subject: '', body: 'b' })],
    });
    expect(error(d)).toMatchObject({ error: 'subject', step: 1 });
  });

  it.each([
    ['reply', { steps: [step('reply', { text: ' ' })] }],
    ['body', { steps: [step('email_business', { subject: 'a', body: '' })] }],
    ['connector', { steps: [step('connector_call')] }],
    ['operation', { steps: [step('connector_call', { connector: 'crm' })] }],
    ['variable', { steps: [step('ai_analyze', { prompt: 'Resume.', as: 'Mal Nombre' })] }],
    ['prompt', { steps: [step('ai_analyze', { prompt: ' ', as: 'r' })] }],
    [
      'promptFields',
      { steps: [step('ai_analyze', { prompt: 'Resume {{message.text}}', as: 'r' })] },
    ],
    [
      'inputLabel',
      {
        steps: [
          step('ai_analyze', {
            prompt: 'Resume.',
            as: 'r',
            inputs: [{ label: '1 mal', value: 'x' }],
          }),
        ],
      },
    ],
    ['schemaEmpty', { steps: [step('ai_extract', { prompt: 'Clasifica.', as: 'r' })] }],
    [
      'schemaName',
      {
        steps: [
          step('ai_extract', {
            prompt: 'C.',
            as: 'r',
            fields: [{ name: 'dos palabras', type: 'string', values: '', required: false }],
          }),
        ],
      },
    ],
    [
      'schemaValues',
      {
        steps: [
          step('ai_extract', {
            prompt: 'C.',
            as: 'r',
            fields: [{ name: 'n', type: 'number', values: '1,2', required: false }],
          }),
        ],
      },
    ],
    ['maxTokens', { steps: [step('ai_analyze', { prompt: 'R.', as: 'r', maxTokens: '10' })] }],
    ['days', { steps: [step('ignis_stats', { as: 's', days: '91' })] }],
    ['variable', { steps: [step('ignis_stats', { as: '', days: '7' })] }],
  ])('refuses a step with %s', (code, over) => {
    expect(error(rule(over as Partial<RuleDraft>))?.error).toBe(code);
  });

  it('refuses the same variable twice, an unknown field, an unclosed brace and a variable nobody defined', () => {
    const twice = [step('ignis_stats', { as: 's' }), step('ignis_stats', { as: 's' })];
    expect(error(rule({ steps: twice }))?.error).toBe('variableTaken');
    expect(error(rule({ steps: [step('reply', { text: 'Hola {{contact.phone}}' })] }))?.error).toBe(
      'unknownField',
    );
    expect(error(rule({ steps: [step('reply', { text: 'Hola {{contact.name' })] }))?.error).toBe(
      'unclosed',
    );
    expect(error(rule({ steps: [step('reply', { text: 'Hola {{vars.x.y}}' })] }))?.error).toBe(
      'undefinedVariable',
    );
  });

  it('refuses what only makes sense in a conversation on a schedule, and two replies or handoffs', () => {
    const scheduled = { trigger: 'schedule' as const, conditions: [] };
    expect(error(rule({ ...scheduled, steps: [step('reply', { text: 'x' })] }))?.error).toBe(
      'conversationOnly',
    );
    expect(error(rule({ ...scheduled, steps: [step('handoff')] }))?.error).toBe('conversationOnly');
    expect(
      error(
        rule({
          ...scheduled,
          steps: [step('email_business', { subject: 'a', body: '{{message.text}}' })],
        }),
      )?.error,
    ).toBe('unknownField');
    expect(
      error(rule({ steps: [step('reply', { text: 'a' }), step('reply', { text: 'b' })] }))?.error,
    ).toBe('twoReplies');
    expect(error(rule({ steps: [step('handoff'), step('handoff')] }))?.error).toBe('twoHandoffs');
  });

  it('never lets what a model wrote be an argument of a call to a system', () => {
    const d = rule({
      steps: [
        step('ai_analyze', { prompt: 'Resume.', as: 'r' }),
        step('connector_call', {
          connector: 'crm',
          operation: 'find',
          args: { q: 'buscar {{vars.r}}' },
          argTypes: { q: 'string' },
        }),
      ],
    });
    expect(error(d)).toMatchObject({ error: 'modelInCall', step: 1, detail: 'q' });
    // What a system or the activity returned is fine.
    d.steps[0] = step('ignis_stats', { as: 'r' });
    expect(error(d)).toBeNull();
  });

  it('checks the condition of a step against the variables before it', () => {
    const guard = (field: string) => ({
      enabled: true,
      match: 'all' as const,
      conditions: [{ field, op: 'equals' as const, text: 'alta', flag: true }],
    });
    const early = rule({
      steps: [step('email_business', { subject: 'a', body: 'b', guard: guard('vars.c.urgencia') })],
    });
    expect(error(early)).toMatchObject({ error: 'guardVariable', step: 0 });
    const reply = rule({
      steps: [
        step('ignis_stats', { as: 'c' }),
        step('reply', { text: 'x', guard: guard('vars.c.urgencia') }),
      ],
    });
    expect(error(reply)?.error).toBe('guardVariable');
    const empty = rule({
      steps: [step('reply', { text: 'x', guard: { enabled: true, match: 'all', conditions: [] } })],
    });
    expect(error(empty)?.error).toBe('guardEmpty');
  });
});

describe('ruleToDraft', () => {
  const stored: AutomationRule = {
    id: 'r1',
    name: 'Clasificar',
    enabled: false,
    trigger: { type: 'message_received' },
    match: 'any',
    conditions: [{ field: 'message.text', op: 'contains_any', value: ['queja', 'reclamo'] }],
    actions: [
      { type: 'reply', text: 'Recibimos tu queja.' },
      {
        type: 'connector_call',
        connector: 'crm',
        operation: 'find',
        as: 'c',
        arguments: { id: 7, activo: true, q: '{{contact.name}}' },
      },
      {
        type: 'ai_extract',
        as: 'x',
        prompt: 'Clasifica.',
        inputs: { Mensaje: '{{message.text}}' },
        schema: {
          type: 'object',
          required: ['u'],
          properties: { u: { type: 'string', enum: ['alta', 'baja'] } },
        },
        max_tokens: 300,
        when: { match: 'any', conditions: [{ field: 'vars.c.plan', op: 'equals', value: 'gold' }] },
      },
    ],
    ai_budget_micro: 250_000,
    cooldown_minutes: 15,
    version: 3,
    created_at: '2026-10-26T00:00:00Z',
    updated_at: '2026-10-26T00:00:00Z',
  };

  it('opens as a draft that goes back to the same rule', () => {
    const d = ruleToDraft(stored);
    expect(d).toMatchObject({
      id: 'r1',
      enabled: false,
      match: 'any',
      cooldown: '15',
      budget: '0,25',
    });
    expect(d.steps[1]?.argTypes).toEqual({ id: 'number', activo: 'boolean', q: 'string' });
    expect(d.steps[2]?.fields).toEqual([
      { name: 'u', type: 'string', values: 'alta, baja', required: true },
    ]);

    const input = ok(d);
    expect(input.conditions).toEqual(stored.conditions);
    expect(input.actions).toEqual(stored.actions);
    expect(input.ai_budget_micro).toBe(250_000);
    expect(input.cooldown_minutes).toBe(15);
    expect(input.enabled).toBe(false);
  });

  it('opens a schedule with its time, days and zone', () => {
    const d = ruleToDraft({
      ...stored,
      trigger: {
        type: 'schedule',
        schedule: { at: '07:15', weekdays: [1, 3], timezone: 'America/Lima' },
      },
      conditions: [],
      actions: [{ type: 'email_business', subject: 'a', body: 'b' }],
    });
    expect(d).toMatchObject({
      trigger: 'schedule',
      at: '07:15',
      weekdays: [1, 3],
      timezone: 'America/Lima',
    });
  });
});

describe('what the form reads', () => {
  it('knows the kind of each field and the comparisons that fit it', () => {
    expect(fieldKind('contact.is_new')).toBe('flag');
    expect(fieldKind('time.hour')).toBe('number');
    expect(fieldKind('time.date')).toBe('date');
    expect(fieldKind('message.text')).toBe('text');
    expect(opsFor('contact.is_new')).toEqual(['equals']);
    expect(opsFor('time.hour')).toContain('gte');
    expect(opsFor('message.text')).toContain('contains_any');
    expect(opsFor('vars.c.urgencia')).toContain('equals');
  });

  it('offers the variables of the steps before one, and the fields an extraction gives', () => {
    const steps = [
      step('ignis_stats', { as: 's' }),
      step('reply', { text: 'x' }),
      step('ai_extract', {
        as: 'c',
        fields: [{ name: 'urgencia', type: 'string', values: '', required: true }],
      }),
      step('email_business'),
    ];
    expect(varsBefore(steps, 3)).toEqual(['s', 'c']);
    expect(varsBefore(steps, 1)).toEqual(['s']);
    expect(extractedFields(steps, 3)).toEqual(['vars.c.urgencia']);
    expect(extractedFields(steps, 2)).toEqual([]);
  });

  it('tells a rule that asks a model from one that does not', () => {
    expect(usesAI({ actions: [{ type: 'reply' }, { type: 'ignis_stats' }] })).toBe(false);
    expect(usesAI({ actions: [{ type: 'reply' }, { type: 'ai_analyze' }] })).toBe(true);
    expect(emptyCondition('schedule').field).toBe('time.hour');
    expect(emptyRule('ai').steps[0]?.type).toBe('ai_extract');
  });
});

describe('the model of a step', () => {
  const aiRule = (model: string) =>
    rule({
      steps: [step('ai_analyze', { as: 'resumen', prompt: 'Resume la queja.', model })],
    });

  it('is sent when chosen and left out when the plan decides', () => {
    expect(ok(aiRule('google:gemini-2.5-flash')).actions[0]?.model).toBe('google:gemini-2.5-flash');
    expect(ok(aiRule('')).actions[0]).not.toHaveProperty('model');
  });

  it('comes back into the draft', () => {
    const input = ok(aiRule('deepseek:deepseek-chat'));
    const stored = { ...input, id: 'r1', version: 1 } as unknown as AutomationRule;
    expect(ruleToDraft(stored).steps[0]?.model).toBe('deepseek:deepseek-chat');
  });
});

describe('the knowledge search step', () => {
  const search = (over: Partial<StepDraft> = {}) =>
    step('knowledge_search', { as: 'k', query: '{{message.text}}', ...over });

  it('is sent with its question, and the limit only when it was chosen', () => {
    const a = ok(rule({ steps: [search(), step('reply', { text: 'Hola' })] })).actions[0];
    expect(a).toEqual({ type: 'knowledge_search', query: '{{message.text}}', as: 'k' });
    const b = ok(rule({ steps: [search({ limit: '6' })] })).actions[0];
    expect(b?.limit).toBe(6);
  });

  it('asks for a question, a valid limit and a name for the result', () => {
    const err = (s: StepDraft) => {
      const r = draftToInput(rule({ steps: [s] }));
      return r.ok ? null : r.error;
    };
    expect(err(search({ query: '  ' }))).toBe('knowledgeQuery');
    expect(err(search({ query: 'x'.repeat(501) }))).toBe('knowledgeQuery');
    expect(err(search({ limit: '9' }))).toBe('knowledgeLimit');
    expect(err(search({ limit: '2.5' }))).toBe('knowledgeLimit');
    expect(err(search({ as: '' }))).toBe('variable');
    expect(err(search({ query: '{{nada.x}}' }))).toBe('unknownField');
  });

  it('offers what it found to the steps after it, and `found` as a yes/no condition', () => {
    const steps = [search(), step('reply', { text: 'Hola' })];
    expect(varsBefore(steps, 1)).toEqual(['k']);
    expect(extractedFields(steps, 1)).toEqual(['vars.k.found', 'vars.k.text']);
    expect(fieldKind('vars.k.found')).toBe('flag');
    expect(opsFor('vars.k.found')).toEqual(['equals']);
    expect(fieldKind('vars.k.text')).toBe('text');
  });

  it('comes back into the draft', () => {
    const input = ok(rule({ steps: [search({ limit: '3' })] }));
    const d = ruleToDraft({ ...input, id: 'r1', version: 1 } as unknown as AutomationRule);
    expect(d.steps[0]).toMatchObject({
      type: 'knowledge_search',
      query: '{{message.text}}',
      limit: '3',
      as: 'k',
    });
  });

  it('can be guarded by whether it found something', () => {
    const guarded = step('email_business', {
      subject: 'Sin respuesta',
      body: 'Nada sobre {{message.text}}',
      guard: {
        enabled: true,
        match: 'all',
        conditions: [{ field: 'vars.k.found', op: 'equals', text: '', flag: false }],
      },
    });
    const a = ok(rule({ steps: [search(), guarded] })).actions[1];
    expect(a?.when?.conditions[0]).toMatchObject({
      field: 'vars.k.found',
      op: 'equals',
      value: false,
    });
  });
});
