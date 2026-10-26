import { describe, expect, it } from 'vitest';

import type { Connector } from '@/api/tenant';
import {
  draftFromConnector,
  effectiveRisk,
  emptyConnector,
  emptyOperation,
  hostOf,
  toConnectorInput,
  type ConnectorDraft,
} from '@/utils/connectors';

function valid(over: Partial<ConnectorDraft> = {}): ConnectorDraft {
  const op = {
    ...emptyOperation(),
    name: 'find_booking',
    description: 'Busca una reserva',
    path: '/bookings/{id}',
    params: '{"type":"object","properties":{"id":{"type":"string"}},"required":["id"]}',
  };
  return {
    ...emptyConnector(),
    name: 'agenda',
    baseUrl: 'https://api.agenda.co/v1',
    secret: 'token-123',
    operations: [op],
    ...over,
  };
}

describe('toConnectorInput', () => {
  it('builds what the API expects and sends only the secret that was typed', () => {
    const r = toConnectorInput(valid());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.base_url).toBe('https://api.agenda.co/v1');
    expect(r.input.auth).toEqual({ type: 'bearer' });
    expect(r.input.secret).toBe('token-123');
    expect(r.input.operations[0]).toMatchObject({ name: 'find_booking', method: 'GET' });
    expect(r.input.operations[0]).not.toHaveProperty('risk');
    expect(r.input.operations[0]).not.toHaveProperty('response_fields');
  });

  it('keeps the stored secret when editing without typing one', () => {
    const r = toConnectorInput(valid({ isNew: false, secret: '', hasSecret: true }));
    expect(r.ok && 'secret' in r.input).toBe(false);
  });

  it('sends no secret and no header when there is no authentication', () => {
    const r = toConnectorInput(valid({ authType: 'none', secret: 'ignored' }));
    expect(r.ok && r.input.secret).toBeFalsy();
    expect(r.ok && r.input.auth).toEqual({ type: 'none' });
  });

  it('takes the response fields and the risk of an operation', () => {
    const base = valid();
    const op = {
      ...base.operations[0]!,
      risk: 'read' as const,
      fields: 'data.id, data.name\nstatus',
    };
    const r = toConnectorInput({ ...base, operations: [{ ...op, method: 'POST' }] });
    expect(r.ok && r.input.operations[0]).toMatchObject({
      method: 'POST',
      risk: 'read',
      response_fields: ['data.id', 'data.name', 'status'],
    });
  });

  it.each([
    ['name', { name: 'Agenda' }],
    ['name', { name: '1agenda' }],
    ['name', { name: 'a'.repeat(25) }],
    ['baseUrl', { baseUrl: 'http://api.agenda.co' }],
    ['baseUrl', { baseUrl: 'https://user:pass@api.agenda.co' }],
    ['baseUrl', { baseUrl: 'https://api.agenda.co/v1?key=1' }],
    ['baseUrl', { baseUrl: 'not a url' }],
    ['header', { authType: 'header' as const, header: '' }],
    ['header', { authType: 'header' as const, header: 'Content-Type' }],
    ['secret', { secret: ' ' }],
    ['operations', { operations: [] }],
  ])('rejects %s for %j', (error, over) => {
    expect(toConnectorInput(valid(over))).toMatchObject({ ok: false, error });
  });

  it('accepts a header authentication with a valid header name', () => {
    const r = toConnectorInput(valid({ authType: 'header', header: 'X-Api-Key' }));
    expect(r.ok && r.input.auth).toEqual({ type: 'header', header: 'X-Api-Key' });
  });

  it('points at the operation that is wrong', () => {
    const good = valid().operations[0]!;
    const bad = (over: object) =>
      toConnectorInput(valid({ operations: [good, { ...good, name: 'second', ...over }] }));
    expect(bad({ name: 'Bad Name' })).toEqual({ ok: false, error: 'opName', op: 1 });
    expect(bad({ description: ' ' })).toEqual({ ok: false, error: 'opDescription', op: 1 });
    expect(bad({ path: 'no-slash' })).toEqual({ ok: false, error: 'opPath', op: 1 });
    expect(bad({ path: '/a/../b' })).toEqual({ ok: false, error: 'opPath', op: 1 });
    expect(bad({ path: '/a?x=1' })).toEqual({ ok: false, error: 'opPath', op: 1 });
    expect(bad({ params: '{oops' })).toEqual({ ok: false, error: 'opParams', op: 1 });
    expect(bad({ params: '[]' })).toEqual({ ok: false, error: 'opParams', op: 1 });
    expect(bad({ params: '{"type":"string"}' })).toEqual({ ok: false, error: 'opParams', op: 1 });
    expect(bad({ fields: 'a..b' })).toEqual({ ok: false, error: 'opFields', op: 1 });
    expect(bad({ name: 'find_booking' })).toEqual({ ok: false, error: 'duplicate', op: 1 });
  });

  it('requires every {segment} of the path to be a required property', () => {
    const op = valid().operations[0]!;
    const noProp = { ...op, params: '{"type":"object","properties":{},"required":[]}' };
    expect(toConnectorInput(valid({ operations: [noProp] }))).toMatchObject({
      error: 'opPlaceholder',
    });
    const notRequired = {
      ...op,
      params: '{"type":"object","properties":{"id":{"type":"string"}},"required":[]}',
    };
    expect(toConnectorInput(valid({ operations: [notRequired] }))).toMatchObject({
      error: 'opPlaceholder',
    });
  });
});

describe('the form of a stored connector', () => {
  const stored: Connector = {
    name: 'agenda',
    description: 'La agenda',
    base_url: 'https://api.agenda.co/v1',
    auth: { type: 'bearer' },
    enabled: true,
    has_secret: true,
    updated_at: '2026-10-26T00:00:00Z',
    operations: [
      {
        name: 'find_booking',
        description: 'Busca',
        method: 'GET',
        path: '/bookings/{id}',
        params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        response_fields: ['data.id'],
      },
    ],
  };

  it('opens as a draft that sends back the same connector without a secret', () => {
    const d = draftFromConnector(stored);
    expect(d).toMatchObject({ isNew: false, hasSecret: true, secret: '', name: 'agenda' });
    const r = toConnectorInput(d);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.operations).toEqual(stored.operations);
    expect(r.input).not.toHaveProperty('secret');
  });
});

describe('small helpers', () => {
  it('knows the default risk of a method', () => {
    expect(effectiveRisk({ method: 'GET' })).toBe('read');
    expect(effectiveRisk({ method: 'POST' })).toBe('write');
    expect(effectiveRisk({ method: 'POST', risk: 'read' })).toBe('read');
  });

  it('shows the host of an address', () => {
    expect(hostOf('https://api.agenda.co/v1')).toBe('api.agenda.co');
    expect(hostOf('nope')).toBe('nope');
  });
});
