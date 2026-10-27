import { describe, expect, it } from 'vitest';

import {
  draftFrom,
  emptyDraft,
  LIMITS,
  placeholderProblem,
  problems,
  rulesOf,
  sameProfile,
  toInput,
} from '@/utils/assistant';

const vars = ['business_name', 'language'];

describe('the rules of the assistant', () => {
  it('are one per line, trimmed and without empty lines', () => {
    expect(rulesOf('  Ofrece el menú \r\n\n  \nNo des precios')).toEqual([
      'Ofrece el menú',
      'No des precios',
    ]);
    expect(rulesOf('')).toEqual([]);
  });

  it('go out as lists and come back as lines', () => {
    const d = {
      ...emptyDraft(),
      businessName: ' Luna ',
      tone: 'formal' as const,
      always: 'a\nb',
      never: 'c',
    };
    const input = toInput(d);
    expect(input).toMatchObject({
      business_name: 'Luna',
      tone: 'formal',
      always: ['a', 'b'],
      never: ['c'],
    });
    expect(draftFrom({ ...input }).always).toBe('a\nb');
  });
});

describe('placeholders', () => {
  it('accept the variables the API offers, with or without spaces', () => {
    expect(placeholderProblem('Hola {{business_name}} y {{ language }}', vars)).toBeNull();
    expect(placeholderProblem('sin variables', vars)).toBeNull();
  });

  it('point at what is not allowed or left open', () => {
    expect(placeholderProblem('Hola {{nombre}}', vars)).toBe('{{nombre}}');
    expect(placeholderProblem('Hola {{business_name', vars)).toBe('{{');
    expect(placeholderProblem('Hola }} mundo', vars)).toBe('}}');
  });
});

describe('the form of the profile', () => {
  it('has no problems when empty', () => {
    expect(problems(emptyDraft(), vars)).toEqual({});
  });

  it('refuses what the API would refuse, field by field', () => {
    const d = {
      ...emptyDraft(),
      businessName: 'a'.repeat(LIMITS.businessName + 1),
      about: 'Hola {{nope}}',
      greeting: 'g'.repeat(LIMITS.greeting + 1),
      always: Array.from({ length: LIMITS.rules + 1 }, () => 'x').join('\n'),
      never: 'y'.repeat(LIMITS.rule + 1),
      extra: '{{business_name',
    };
    expect(problems(d, vars)).toEqual({
      businessName: 'long',
      about: 'placeholder',
      greeting: 'long',
      always: 'many',
      never: 'longRule',
      extra: 'placeholder',
    });
  });

  it('counts characters, not bytes', () => {
    const d = { ...emptyDraft(), businessName: 'ñ'.repeat(LIMITS.businessName) };
    expect(problems(d, vars)).toEqual({});
  });

  it('knows when what is on the form is what is saved', () => {
    const saved = toInput({ ...emptyDraft(), about: 'Café', always: 'a' });
    expect(sameProfile(saved, toInput({ ...emptyDraft(), about: ' Café ', always: 'a\n\n' }))).toBe(
      true,
    );
    expect(sameProfile(saved, toInput({ ...emptyDraft(), about: 'Té', always: 'a' }))).toBe(false);
  });
});
