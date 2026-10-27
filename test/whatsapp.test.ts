import { describe, expect, it } from 'vitest';

import {
  bodyProblem,
  emptyTemplate,
  fitExamples,
  knownDetail,
  paramProblem,
  preview,
  slugify,
  templateProblems,
  validAccountId,
  validPhone,
  variablesOf,
} from '@/utils/whatsapp';

const ok = {
  ...emptyTemplate(),
  name: 'pedido_listo',
  body: 'Hola {{1}}, tu pedido {{2}} está listo.',
  examples: ['Ana', '1234'],
};

describe('the name of a template', () => {
  it('is made from what a person types', () => {
    expect(slugify('Pedido listo!')).toBe('pedido_listo');
    expect(slugify('  Confirmación de CITA  ')).toBe('confirmacion_de_cita');
    expect(slugify('¡¡¡')).toBe('');
    expect(slugify('a'.repeat(150))).toHaveLength(100);
  });
});

describe('the body of a template', () => {
  it('lists its variables in order', () => {
    expect(variablesOf('Hola {{1}} y {{ 2 }}')).toEqual([1, 2]);
    expect(variablesOf('sin variables')).toEqual([]);
  });

  it('follows the rules of Meta', () => {
    expect(bodyProblem(ok.body)).toBeNull();
    expect(bodyProblem('Hoy hay promoción.')).toBeNull();
    expect(bodyProblem('  ')).toBe('required');
    expect(bodyProblem('a'.repeat(1025))).toBe('long');
    expect(bodyProblem('Hola {nombre} y {{1}} ya')).toBeNull(); // single braces are plain text
    expect(bodyProblem('Hola {{nombre}} ya')).toBe('braces');
    expect(bodyProblem('Hola {{1}} ya }}')).toBe('braces');
    expect(bodyProblem('Hola {{2}} y {{1}} ya')).toBe('order');
    expect(bodyProblem('Hola {{1}} y {{3}} ya')).toBe('order');
    expect(bodyProblem('Hola {{1}}{{2}} ya')).toBe('adjacent');
    expect(bodyProblem('{{1}} hola {{2}} ya')).toBe('edge');
    expect(bodyProblem('Tu pedido {{1}} de {{2}}')).toBe('edge');
  });
});

describe('the preconditions the API explains', () => {
  it('are told apart from what Meta says', () => {
    expect(knownDetail('first enter the id of your WhatsApp Business account')).toBe('noAccount');
    expect(knownDetail('first connect your WhatsApp number in Channels')).toBe('noChannel');
    expect(knownDetail('only an approved template can be sent; this one is pending')).toBe(
      'notApproved',
    );
    expect(knownDetail('Meta said: Content in this language already exists.')).toBeNull();
    expect(knownDetail('')).toBeNull();
  });
});

describe('the form of a template', () => {
  it('has no problems when it is right', () => {
    expect(templateProblems(ok)).toEqual({});
    expect(
      templateProblems({ ...emptyTemplate(), name: 'aviso', body: 'Hoy hay promoción.' }),
    ).toEqual({});
  });

  it('says what is wrong, field by field', () => {
    expect(
      templateProblems({
        ...ok,
        name: 'Pedido listo',
        footer: 'x'.repeat(61),
        examples: ['Ana'],
      }),
    ).toEqual({ name: 'name', footer: 'footer', examples: 'examples' });
    expect(templateProblems({ ...ok, body: '{{1}} hola {{2}} ya' })).toEqual({ body: 'edge' });
    expect(templateProblems({ ...ok, examples: ['Ana', ' '] })).toEqual({ examples: 'examples' });
    expect(templateProblems({ ...ok, footer: 'Hola {{1}}' })).toEqual({ footer: 'footer' });
  });

  it('keeps one example for each variable', () => {
    expect(fitExamples('Hola {{1}} y {{2}} ya', ['Ana'])).toEqual(['Ana', '']);
    expect(fitExamples('Hola {{1}} ya', ['Ana', 'sobra'])).toEqual(['Ana']);
    expect(fitExamples('sin variables', ['x'])).toEqual([]);
  });

  it('shows the message with the examples in place', () => {
    expect(preview(ok.body, ['Ana', '1234'])).toBe('Hola Ana, tu pedido 1234 está listo.');
    expect(preview(ok.body, ['Ana', ''])).toBe('Hola Ana, tu pedido {{2}} está listo.');
  });
});

describe('what is sent with a template', () => {
  it('accepts a value on one line', () => {
    expect(paramProblem('Ana')).toBeNull();
    expect(paramProblem(' ')).toBe('required');
    expect(paramProblem('uno\ndos')).toBe('lines');
    expect(paramProblem('uno\tdos')).toBe('lines');
    expect(paramProblem('uno     dos')).toBe('spaces');
    expect(paramProblem('a'.repeat(1025))).toBe('long');
  });

  it('needs a number with the country code', () => {
    expect(validPhone('573001234567')).toBe(true);
    expect(validPhone(' 573001234567 ')).toBe(true);
    expect(validPhone('+57 300 1234567')).toBe(false);
    expect(validPhone('123')).toBe(false);
  });

  it('knows the account id of Meta is only digits', () => {
    expect(validAccountId('109876543210')).toBe(true);
    expect(validAccountId('')).toBe(true);
    expect(validAccountId('abc')).toBe(false);
    expect(validAccountId('1'.repeat(41))).toBe(false);
  });
});
