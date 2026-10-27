import { describe, expect, it } from 'vitest';

import type { Connector } from '@/api/tenant';
import {
  argumentsTemplate,
  draftFromConnector,
  effectiveRisk,
  emptyConnector,
  emptyOperation,
  failureText,
  hostOf,
  isDefaultBase,
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

describe('argumentsTemplate', () => {
  it('offers the required arguments with a value of the right type', () => {
    const text = argumentsTemplate({
      type: 'object',
      required: ['id', 'count', 'when', 'flag', 'tags', 'kind'],
      properties: {
        id: { type: 'string' },
        count: { type: 'integer', minimum: 1 },
        when: { type: 'string', format: 'date' },
        flag: { type: 'boolean' },
        tags: { type: 'array' },
        kind: { type: 'string', enum: ['a', 'b'] },
        optional: { type: 'string' },
      },
    });
    const args = JSON.parse(text);
    expect(Object.keys(args)).toEqual(['id', 'count', 'when', 'flag', 'tags', 'kind']);
    expect(args).toMatchObject({ id: '', count: 1, flag: false, tags: [], kind: 'a' });
    expect(args.when).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('is an empty object when nothing is required', () => {
    expect(argumentsTemplate({ type: 'object', properties: { q: { type: 'string' } } })).toBe('{}');
  });
});

describe('failureText', () => {
  it.each([
    ['the system could not be reached', /No se pudo conectar/],
    ['the system refused the credentials of the connector', /rechazó la credencial/],
    ['the connector has no credentials configured', /no tiene una credencial/],
    ['the system redirected the call, which is not allowed', /redirigió/],
    ['the system answered 503; try again later', /respondió 503. Inténtalo más tarde/],
    [
      'the system refused to renew the access of the connector: the Ignis team has to authorize it again',
      /autorizarlo de nuevo/,
    ],
    [
      'the system that gives access could not be reached; try again later',
      /entrega los tokens\. Inténtalo/,
    ],
    ['the system that gives access failed; try again later', /entrega los tokens falló/],
  ])('translates %s', (message, expected) => {
    expect(failureText(message)).toMatch(expected);
  });

  it('keeps what the client system said, word for word', () => {
    expect(failureText('the system answered 404: {"error":"No such customer"}')).toBe(
      'El sistema respondió 404: {"error":"No such customer"}',
    );
    expect(failureText('something else')).toBe('something else');
  });
});

describe('small helpers', () => {
  it('knows the default risk of a method', () => {
    expect(effectiveRisk({ method: 'GET' })).toBe('read');
    expect(effectiveRisk({ method: 'POST' })).toBe('write');
    expect(effectiveRisk({ method: 'POST', risk: 'read' })).toBe('read');
  });

  it('tells the address the form starts with from one that was typed', () => {
    expect(isDefaultBase('https://')).toBe(true);
    expect(isDefaultBase(' ')).toBe(true);
    expect(isDefaultBase('https://api.agenda.co')).toBe(false);
  });

  it('shows the host of an address', () => {
    expect(hostOf('https://api.agenda.co/v1')).toBe('api.agenda.co');
    expect(hostOf('nope')).toBe('nope');
  });
});

describe('an OAuth2 connector', () => {
  const zoho = (over: Partial<ConnectorDraft> = {}) =>
    valid({
      authType: 'oauth2',
      secret: '',
      tokenUrl: 'https://accounts.zoho.com/oauth/v2/token',
      scheme: 'Zoho-oauthtoken',
      clientId: ' 1000.ABC ',
      clientSecret: 'shh',
      refreshToken: '1000.refresh',
      ...over,
    });

  it('sends where tokens come from and the credentials as an object', () => {
    const r = toConnectorInput(zoho());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.auth).toEqual({
      type: 'oauth2',
      token_url: 'https://accounts.zoho.com/oauth/v2/token',
      grant: 'refresh_token',
      scheme: 'Zoho-oauthtoken',
    });
    expect(r.input.secret).toEqual({
      client_id: '1000.ABC',
      client_secret: 'shh',
      refresh_token: '1000.refresh',
    });
  });

  it('asks for the scope only when there is one, and Bearer when no word is given', () => {
    const r = toConnectorInput(zoho({ scope: ' ZohoCRM.modules.ALL ', scheme: ' ' }));
    expect(r.ok && r.input.auth).toMatchObject({ scope: 'ZohoCRM.modules.ALL', scheme: 'Bearer' });
  });

  it('needs no refresh token with client credentials, and does not send it', () => {
    const r = toConnectorInput(zoho({ grant: 'client_credentials', refreshToken: 'ignored' }));
    expect(r.ok && r.input.secret).toEqual({ client_id: '1000.ABC', client_secret: 'shh' });
    expect(toConnectorInput(zoho({ grant: 'client_credentials', refreshToken: '' })).ok).toBe(true);
  });

  it('refuses a token address that is not https, has credentials or is not an address', () => {
    for (const tokenUrl of ['http://a.com/t', 'https://u:p@a.com/t', 'accounts.zoho.com', '']) {
      const r = toConnectorInput(zoho({ tokenUrl }));
      expect(r.ok ? 'ok' : r.error, tokenUrl).toBe('tokenUrl');
    }
  });

  it('refuses a bad word before the token and a scope with quotes', () => {
    expect((toConnectorInput(zoho({ scheme: 'a b' })) as { error?: string }).error).toBe('scheme');
    expect((toConnectorInput(zoho({ scope: 'a"b' })) as { error?: string }).error).toBe('scope');
  });

  it('needs every credential on a new connector, and all of them if any is typed on an old one', () => {
    for (const over of [{ clientId: '' }, { clientSecret: '' }, { refreshToken: '' }]) {
      const r = toConnectorInput(zoho(over));
      expect(r.ok ? 'ok' : r.error).toBe('oauthSecret');
    }
    const stored = {
      name: 'zoho',
      base_url: 'https://www.zohoapis.com/crm/v6',
      auth: { type: 'oauth2', token_url: 'https://accounts.zoho.com/oauth/v2/token' },
      has_secret: true,
      token_expires_at: '2026-10-27T05:00:00Z',
      updated_at: '2026-10-26T00:00:00Z',
      enabled: true,
      operations: valid().operations.map((o) => ({
        name: o.name,
        description: o.description,
        method: o.method,
        path: o.path,
        params: JSON.parse(o.params) as Record<string, unknown>,
      })),
    } as Connector;
    const d = draftFromConnector(stored);
    expect(d.tokenExpiresAt).toBe('2026-10-27T05:00:00Z');
    // Editing without typing credentials keeps the stored ones: nothing goes out.
    const kept = toConnectorInput(d);
    expect(kept.ok).toBe(true);
    expect(kept.ok && 'secret' in kept.input).toBe(false);
    // Typing only one of them is not enough.
    expect(toConnectorInput({ ...d, clientId: 'x' }).ok).toBe(false);
  });

  it('knows the Zoho regions and Google', async () => {
    const { OAUTH_PRESETS } = await import('@/utils/connectors');
    const eu = OAUTH_PRESETS.find((p) => p.id === 'zoho-eu');
    expect(eu?.tokenUrl).toBe('https://accounts.zoho.eu/oauth/v2/token');
    expect(eu?.scheme).toBe('Zoho-oauthtoken');
    expect(eu?.baseUrl).toBe('https://www.zohoapis.eu/crm/v6');
    expect(OAUTH_PRESETS.find((p) => p.id === 'google')?.scheme).toBe('Bearer');
    expect(OAUTH_PRESETS.every((p) => p.tokenUrl.startsWith('https://'))).toBe(true);
  });
});
